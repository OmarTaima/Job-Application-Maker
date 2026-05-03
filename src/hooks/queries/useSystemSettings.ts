// hooks/queries/useSystemSettings.ts
import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { systemSettingsService } from "../../services/systemSettingsService";
import { useAuth } from '../../context/AuthContext';
import type {
  CreateRecommendedFieldRequest,
  UpdateRecommendedFieldRequest,
  RecommendedField,
} from "../../types/SystemSettings";
import { TableLayout } from '../../types/auth';
import { ApiError } from "../../services/companiesService";
import Swal from "../../utils/swal";

// ===== Query Keys =====
export const systemSettingsKeys = {
  all: ["systemSettings"] as const,
  
  // Recommended Fields
  recommendedFields: () => [...systemSettingsKeys.all, "recommendedFields"] as const,
  recommendedFieldsList: () => [...systemSettingsKeys.recommendedFields(), "list"] as const,
  recommendedField: (id: string) => [...systemSettingsKeys.recommendedFields(), "detail", id] as const,
  
  // Table Layouts
  tableLayouts: () => [...systemSettingsKeys.all, "tableLayouts"] as const,
  tableLayout: (tableKey: string) => [...systemSettingsKeys.tableLayouts(), tableKey] as const,
};

const EMPTY_LAYOUT: TableLayout = {
  columnVisibility: {},
  columnSizing: {},
  columnOrder: [],
};

// ===== Recommended Fields Queries =====
export function useRecommendedFields(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: systemSettingsKeys.recommendedFieldsList(),
    queryFn: () => systemSettingsService.getAllRecommendedFields(),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useRecommendedField(fieldId: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: systemSettingsKeys.recommendedField(fieldId),
    queryFn: () => systemSettingsService.getRecommendedFieldById(fieldId),
    enabled: options?.enabled ?? !!fieldId,
    staleTime: 5 * 60 * 1000,
    initialData: () => {
      const cached = queryClient.getQueryData<RecommendedField[]>(systemSettingsKeys.recommendedFieldsList());
      return cached?.find(field => field.fieldId === fieldId);
    },
  });
}

// ===== Recommended Fields Mutations =====
export function useCreateRecommendedField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecommendedFieldRequest) => 
      systemSettingsService.createRecommendedField(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: systemSettingsKeys.recommendedFieldsList() });
      showSuccessToast("Recommended field created successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to create recommended field");
    },
  });
}

export function useUpdateRecommendedField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ fieldId, data }: { fieldId: string; data: UpdateRecommendedFieldRequest }) =>
      systemSettingsService.updateRecommendedField(fieldId, data),
    onSuccess: (updatedField, { fieldId }) => {
      queryClient.setQueryData(systemSettingsKeys.recommendedField(fieldId), updatedField);
      queryClient.invalidateQueries({ queryKey: systemSettingsKeys.recommendedFieldsList() });
      showSuccessToast("Recommended field updated successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to update recommended field");
    },
  });
}

export function useDeleteRecommendedField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fieldId: string) => systemSettingsService.deleteRecommendedField(fieldId),
    onSuccess: (_, fieldId) => {
      queryClient.setQueryData<RecommendedField[]>(systemSettingsKeys.recommendedFieldsList(), (old) => {
        if (!old) return [];
        return old.filter(field => field.fieldId !== fieldId);
      });
      queryClient.removeQueries({ queryKey: systemSettingsKeys.recommendedField(fieldId) });
      showSuccessToast("Recommended field deleted successfully");
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, "Failed to delete recommended field");
    },
  });
}

// ===== Table Layout Hooks =====
export const useTableLayout = (
  tableKey: string,
  defaultLayout: TableLayout = EMPTY_LAYOUT
) => {
  const { user } = useAuth();
  const userId = user?._id;
  const queryClient = useQueryClient();
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLayout = useRef<TableLayout | null>(null);

  const {
    data: fetchedLayout,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: systemSettingsKeys.tableLayout(tableKey),
    queryFn: () => systemSettingsService.getTableLayout(tableKey),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: (layout: TableLayout) => systemSettingsService.saveTableLayout(tableKey, layout),
    onError: (error: any) => {
      console.error('Failed to save layout:', error);
    },
  });

  const layout = {
    ...defaultLayout,
    ...(fetchedLayout || EMPTY_LAYOUT),
  };

  const saveLayout = useCallback(
    (updates: Partial<TableLayout>) => {
      if (!userId) return;

      const newLayout = { ...layout, ...updates };
      pendingLayout.current = newLayout;
      queryClient.setQueryData(systemSettingsKeys.tableLayout(tableKey), newLayout);

      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        if (pendingLayout.current) {
          saveMutation.mutate(pendingLayout.current);
          pendingLayout.current = null;
        }
      }, 2000);
    },
    [userId, tableKey, layout, queryClient, saveMutation]
  );

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  return {
    layout,
    saveLayout,
    isLoading: isLoading && !fetchedLayout,
    isError,
    error,
  };
};

// ===== Toast Helpers =====
function showSuccessToast(message: string) {
  Swal.fire({
    title: "Success",
    text: message,
    icon: "success",
    timer: 1500,
    showConfirmButton: false,
  });
}

function showErrorToast(message: string, fallback: string) {
  Swal.fire({
    title: "Error",
    text: message || fallback,
    icon: "error",
  });
}