import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { recommendedFieldsService } from "../../services/recommendedFieldsService";
import type {
  CreateRecommendedFieldRequest,
  UpdateRecommendedFieldRequest,
} from "../../services/recommendedFieldsService";

// Query keys
export const recommendedFieldsKeys = {
  all: ["recommendedFields"] as const,
  lists: () => [...recommendedFieldsKeys.all, "list"] as const,
  list: () => [...recommendedFieldsKeys.lists()] as const,
};

// Get all recommended fields
export function useRecommendedFields() {
  return useQuery({
    queryKey: recommendedFieldsKeys.list(),
    queryFn: () => recommendedFieldsService.getAllRecommendedFields(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Create recommended field
export function useCreateRecommendedField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecommendedFieldRequest) =>
      recommendedFieldsService.createRecommendedField(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: recommendedFieldsKeys.lists(),
      });
    },
  });
}

// Update recommended field
export function useUpdateRecommendedField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      name,
      data,
    }: {
      name: string;
      data: UpdateRecommendedFieldRequest;
    }) => recommendedFieldsService.updateRecommendedField(name, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: recommendedFieldsKeys.lists(),
      });
    },
  });
}

// Delete recommended field
export function useDeleteRecommendedField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      recommendedFieldsService.deleteRecommendedField(name),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: recommendedFieldsKeys.lists(),
      });
    },
  });
}
