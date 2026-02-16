import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { savedFieldsService } from "../../services/savedFieldsService";
import type {
  CreateSavedFieldRequest,
  UpdateSavedFieldRequest,
} from "../../services/savedFieldsService";

export const savedFieldsKeys = {
  all: ["savedFields"] as const,
  lists: () => [...savedFieldsKeys.all, "list"] as const,
  list: () => [...savedFieldsKeys.lists()] as const,
};

export function useSavedFields() {
  return useQuery({
    queryKey: savedFieldsKeys.list(),
    queryFn: () => savedFieldsService.getAllSavedFields(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateSavedField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSavedFieldRequest) => savedFieldsService.createSavedField(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: savedFieldsKeys.lists() }),
  });
}

export function useUpdateSavedField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fieldId, data }: { fieldId: string; data: UpdateSavedFieldRequest }) =>
      savedFieldsService.updateSavedField(fieldId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: savedFieldsKeys.lists() }),
  });
}

export function useDeleteSavedField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fieldId: string) => savedFieldsService.deleteSavedField(fieldId),
    onSuccess: () => qc.invalidateQueries({ queryKey: savedFieldsKeys.lists() }),
  });
}
