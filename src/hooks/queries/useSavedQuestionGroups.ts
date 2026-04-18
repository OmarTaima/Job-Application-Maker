import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  savedQuestionGroupsService,
  type SavedQuestionGroup,
} from "../../services/savedQuestionGroupsService";

export const savedQuestionGroupsKeys = {
  all: ["savedQuestionGroups"] as const,
  lists: () => [...savedQuestionGroupsKeys.all, "list"] as const,
  list: () => [...savedQuestionGroupsKeys.lists()] as const,
};

export function useSavedQuestionGroups() {
  return useQuery<SavedQuestionGroup[]>({
    queryKey: savedQuestionGroupsKeys.list(),
    queryFn: () => savedQuestionGroupsService.getAllSavedQuestionGroups(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSavedQuestionGroups() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groups: SavedQuestionGroup[]) =>
      savedQuestionGroupsService.updateSavedQuestionGroups(groups),
    onMutate: async (groups) => {
      await queryClient.cancelQueries({ queryKey: savedQuestionGroupsKeys.list() });

      const previousGroups = queryClient.getQueryData<SavedQuestionGroup[]>(
        savedQuestionGroupsKeys.list()
      );

      queryClient.setQueryData(savedQuestionGroupsKeys.list(), groups);

      return { previousGroups };
    },
    onError: (_error, _groups, context) => {
      if (context?.previousGroups) {
        queryClient.setQueryData(savedQuestionGroupsKeys.list(), context.previousGroups);
      }
    },
    onSuccess: (groups) => {
      queryClient.setQueryData(savedQuestionGroupsKeys.list(), groups);
    },
  });
}

export function useDeleteSavedQuestionGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: string) =>
      savedQuestionGroupsService.deleteSavedQuestionGroup(groupId),
    onMutate: async (groupId) => {
      await queryClient.cancelQueries({ queryKey: savedQuestionGroupsKeys.list() });

      const previousGroups = queryClient.getQueryData<SavedQuestionGroup[]>(
        savedQuestionGroupsKeys.list()
      );

      queryClient.setQueryData<SavedQuestionGroup[] | undefined>(
        savedQuestionGroupsKeys.list(),
        (old) => {
          if (!Array.isArray(old)) return old;
          return old.filter((group) => group?._id !== groupId);
        }
      );

      return { previousGroups };
    },
    onError: (_error, _groupId, context) => {
      if (context?.previousGroups) {
        queryClient.setQueryData(savedQuestionGroupsKeys.list(), context.previousGroups);
      }
    },
  });
}
