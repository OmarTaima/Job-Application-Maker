// hooks/queries/useApplicants.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applicantsService } from "../../services/applicantsService";
import { useAuth } from "../../context/AuthContext";
import type {
  CreateApplicantRequest,
  UpdateApplicantRequest,
  UpdateStatusRequest,
  ScheduleInterviewRequest,
  UpdateInterviewStatusRequest,
  AddCommentRequest,
  SendMessageRequest,
  Applicant,
  Activity,
  Interview,
  InterviewAnswer,
} from "../../types/applicants";
import { ApiError } from "../../services/companiesService";
import Swal from "../../utils/swal";
import { useLocale } from "../../context/LocaleContext";

// Query keys
export const applicantsKeys = {
  all: ["applicants"] as const,
  lists: () => [...applicantsKeys.all, "list"] as const,
  list: (params?: {
    companyId?: string[];
    jobPositionId?: string | string[];
    search?: string;
    status?: string | string[];
    fields?: string | string[];
    departmentId?: string[];
    skipPopulation?: boolean;
  }) => [...applicantsKeys.lists(), params] as const,
  detail: (id: string) => [...applicantsKeys.all, "detail", id] as const,
  rejectionInsights: (companyId?: string[]) => [...applicantsKeys.all, "rejection-insights", companyId] as const,
  byPhone: (phone: string) => [...applicantsKeys.all, "by-phone", phone] as const,
};

// ===== Interview intent registry (optimistic structural truth) ============
//
// The backend read path can lag its own writes (replica lag), so a GET that
// lands right after a save may still return the PRE-save question list —
// resurrecting just-deleted groups/questions or dropping just-added ones.
// Filtering inside the QUERY FUNCTION means stale structure is corrected
// BEFORE it ever enters the cache: background refetches stay fully
// invisible and the optimistic UI state is never visually reverted.

const INTERVIEW_INTENT_GRACE_MS = 90_000;

type InterviewIntentEntry = {
  /** questionId -> timestamp the client deleted it. */
  removedIds: Map<string, number>;
  /** questionId -> the full question the client added. */
  addedQuestions: Map<string, InterviewAnswer>;
};

const interviewIntents = new Map<string, InterviewIntentEntry>();

const interviewIntentKey = (applicantId: string, interviewId: string) =>
  `${String(applicantId)}::${String(interviewId)}`;

const getInterviewIntent = (
  applicantId: string,
  interviewId: string,
): InterviewIntentEntry => {
  const key = interviewIntentKey(applicantId, interviewId);
  let entry = interviewIntents.get(key);
  if (!entry) {
    entry = { removedIds: new Map(), addedQuestions: new Map() };
    interviewIntents.set(key, entry);
  }
  return entry;
};

/** Mark questions as recently deleted — refetches will prune them. */
export function recordQuestionRemovals(
  applicantId: string,
  interviewId: string,
  questionIds: string[],
) {
  if (!applicantId || !interviewId || questionIds.length === 0) return;
  const entry = getInterviewIntent(applicantId, interviewId);
  const now = Date.now();
  questionIds.forEach((id) => {
    const clean = String(id || '');
    if (!clean) return;
    entry.removedIds.set(clean, now);
    entry.addedQuestions.delete(clean);
  });
}

/** Register recently added questions — refetches will re-append them. */
export function recordQuestionAdditions(
  applicantId: string,
  interviewId: string,
  questions: InterviewAnswer[],
) {
  if (!applicantId || !interviewId || questions.length === 0) return;
  const entry = getInterviewIntent(applicantId, interviewId);
  questions.forEach((q) => {
    const id = String((q as { id?: string; _id?: string })?.id || (q as { _id?: string })?._id || '');
    if (!id) return;
    entry.addedQuestions.set(id, q);
    entry.removedIds.delete(id);
  });
}

export function clearInterviewIntent(applicantId: string, interviewId: string) {
  interviewIntents.delete(interviewIntentKey(applicantId, interviewId));
}

/** Content signature used to recognise a question across id-space swaps. */
const questionSignature = (q: unknown): string => {
  const c = q as { question?: string; score?: number; answerType?: string };
  return `${String(c?.question ?? '').trim().toLowerCase()}|${Number(c?.score ?? 0)}|${String(c?.answerType ?? '')}`;
};

/**
 * Optimistic ghosts appended by the intent layer carry this flag; the
 * mutation layer strips them so a lagging-read phantom can NEVER be
 * persisted back (which would turn it into a permanent duplicate).
 */
const GHOST_FLAG = '_optimisticGhost';

export function stripOptimisticGhosts<T>(questions: unknown): T[] | unknown {
  if (!Array.isArray(questions)) return questions;
  return (questions as Array<Record<string, unknown>>).filter(
    (q) => q?.[GHOST_FLAG] !== true,
  );
}

/**
 * Reconcile a freshly fetched applicant against recent client intents so a
 * lagging read can never overwrite optimistic structural changes. Runs on
 * every fetch of the detail query, whatever triggered it.
 */
function applyInterviewIntent<T extends Applicant | undefined>(
  applicantId: string,
  data: T,
): T {
  if (!data || !Array.isArray(data.interviews)) return data;
  const now = Date.now();
  let touched = false;
  const interviews = (data as Applicant).interviews.map((iv) => {
    const ivId = String(iv?._id || iv?.id || '');
    if (!ivId) return iv;

    // Unconditional heal: dedupe the fetched list by id AND content
    // signature. Earlier phantom appends may already be persisted; identical
    // copies are noise and get collapsed on every fetch.
    const incoming = Array.isArray(iv.questions) ? iv.questions : [];
    const seenIds = new Set<string>();
    const seenSigs = new Set<string>();
    const deduped: unknown[] = [];
    incoming.forEach((q) => {
      const id = String(q?.id || q?._id || '');
      const sig = questionSignature(q);
      if (id && seenIds.has(id)) return;
      if (seenSigs.has(sig)) return;
      if (id) seenIds.add(id);
      seenSigs.add(sig);
      deduped.push(q);
    });

    const entry = interviewIntents.get(interviewIntentKey(applicantId, ivId));

    // Expire stale tombstones first.
    if (entry) {
      entry.removedIds.forEach((ts, id) => {
        if (now - ts > INTERVIEW_INTENT_GRACE_MS) entry.removedIds.delete(id);
      });

      const incomingById = new Map<string, unknown>();
      deduped.forEach((q) => {
        const id = String(q?.id || q?._id || '');
        if (id) incomingById.set(id, q);
      });

      // Tombstone confirmations: if the server no longer returns a deleted
      // question, the deletion is committed — stop pruning for it (also
      // unblocks legitimately re-adding the same question later).
      entry.removedIds.forEach((_ts, id) => {
        if (!incomingById.has(id)) entry.removedIds.delete(id);
      });
    }

    let questions: unknown[] = deduped;
    let changed = deduped.length !== incoming.length;

    if (entry) {
      // 1. Prune anything the client just deleted (server read lagged).
      if (entry.removedIds.size > 0 && questions.length > 0) {
        const filtered = questions.filter((q) => {
          const qid = String(q?.id || q?._id || '');
          return !entry!.removedIds.has(qid);
        });
        if (filtered.length !== questions.length) {
          questions = filtered;
          changed = true;
        }
      }

      // 2. Re-append anything the client just added that the lagging read is
      //    missing. Match by id OR content signature so a swapped id-space
      //    recognises the server twin instead of appending a phantom
      //    duplicate. Appended stand-ins are flagged and stripped from any
      //    outgoing save payload.
      if (entry.addedQuestions.size > 0) {
        const byId = new Set<string>();
        const bySig = new Set<string>();
        questions.forEach((q) => {
          const id = String((q as { id?: string; _id?: string })?.id || (q as { _id?: string })?._id || '');
          if (id) byId.add(id);
          bySig.add(questionSignature(q));
        });
        entry.addedQuestions.forEach((added, id) => {
          const sig = questionSignature(added);
          if (byId.has(id) || bySig.has(sig)) {
            // Server twin present — registration fulfilled.
            entry.addedQuestions.delete(id);
            return;
          }
          questions = [...questions, { ...(added as object), [GHOST_FLAG]: true }];
          changed = true;
          byId.add(String((added as { id?: string; _id?: string })?.id || (added as { _id?: string })?._id || ''));
          bySig.add(sig);
        });
      }
    }

    if (changed) {
      touched = true;
      return { ...iv, questions };
    }
    return iv;
  });
  return touched ? ({ ...(data as Applicant), interviews } as T) : data;
}

// Helper to get user's company IDs from AuthContext
function getUserCompanyIds(user: any): string[] | undefined {
  const roleName = user?.roleId?.name?.toLowerCase?.();
  if (roleName === "admin" || roleName === "super admin") return undefined;

  const fromCompanies = user?.companies?.map((c: any) =>
    typeof c?.companyId === "string" ? c.companyId : c?.companyId?._id
  ).filter(Boolean) ?? [];

  const fromAssigned = user?.assignedcompanyId?.filter(Boolean) ?? [];
  const merged = [...new Set([...fromCompanies, ...fromAssigned])];
  return merged.length > 0 ? merged : undefined;
}

/**
 * Safely merge a mutation response into the cached applicant.
 *
 * Many of our endpoints (schedule interview, add comment, send message)
 * return a STRIPPED applicant — or only the newly-created sub-document
 * (an interview / comment object) instead of the full applicant. Blindly
 * overwriting the cache with that response would wipe `phone`, `email`,
 * `customResponses`, `fullName`, etc.
 *
 * This helper:
 *  - Reads the previously-cached applicant.
 *  - If the response looks like a full applicant (matching `_id` and at
 *    least one identifying field), shallow-merges only the response keys
 *    that have a real value on top of the previous applicant. Non-empty
 *    previous arrays are NOT overwritten by empty response arrays.
 *  - If the response is just a new sub-document (interview, comment),
 *    appends it to the appropriate array on the previous applicant.
 *  - If there is no previous cache, falls back to writing the response.
 */
function mergeApplicantResponseIntoCache(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  response: unknown,
  options: { appendKey?: 'interviews' | 'comments' | 'activities' } = {},
): void {
  const previous = queryClient.getQueryData<Applicant | undefined>(
    applicantsKeys.detail(id),
  );

  if (!response || typeof response !== 'object') {
    if (!previous) {
      return;
    }
    return;
  }

  const resp = response as Record<string, unknown>;
  const respId = String((resp._id as string | undefined) || (resp.id as string | undefined) || '');

  const looksLikeFullApplicant =
    respId === id &&
    (resp.fullName !== undefined ||
      resp.firstName !== undefined ||
      resp.email !== undefined ||
      resp.phone !== undefined ||
      resp.status !== undefined ||
      Array.isArray(resp.customResponses) ||
      Array.isArray(resp.interviews));

  if (!previous) {
    queryClient.setQueryData(applicantsKeys.detail(id), response);
    return;
  }

  if (looksLikeFullApplicant) {
    const merged: Record<string, unknown> = { ...(previous as unknown as Record<string, unknown>) };
    for (const key of Object.keys(resp)) {
      const value = resp[key];
      if (value === undefined) continue;
      const prevValue = (previous as unknown as Record<string, unknown>)[key];
      if (
        Array.isArray(value) &&
        value.length === 0 &&
        Array.isArray(prevValue) &&
        (prevValue as unknown[]).length > 0
      ) {
        continue;
      }
      merged[key] = value;
    }
    queryClient.setQueryData(applicantsKeys.detail(id), merged as Applicant);
    return;
  }

  // Response is not a full applicant. If the caller told us which array to
  // append into, do that; otherwise fall back to merging an `interviews`
  // array if the response carries one.
  const appendKey = options.appendKey;
  const respHasInterviewsArray = Array.isArray(resp.interviews);

  if (appendKey) {
    const existing = Array.isArray((previous as unknown as Record<string, unknown>)[appendKey])
      ? ((previous as unknown as Record<string, unknown>)[appendKey] as unknown[])
      : [];
    queryClient.setQueryData(applicantsKeys.detail(id), {
      ...(previous as object),
      [appendKey]: [...existing, response],
    } as unknown as Applicant);
    return;
  }

  if (respHasInterviewsArray) {
    const existingInterviews = Array.isArray((previous as Applicant).interviews)
      ? (previous as Applicant).interviews
      : [];
    const byId = new Map<string, unknown>();
    (existingInterviews || []).forEach((iv) => {
      const k = String((iv as { _id?: string; id?: string })?._id || (iv as { _id?: string; id?: string })?.id || '');
      if (k) byId.set(k, iv);
    });
    (resp.interviews as unknown[]).forEach((iv) => {
      const k = String((iv as { _id?: string; id?: string })?._id || (iv as { _id?: string; id?: string })?.id || '');
      if (k) byId.set(k, { ...(byId.get(k) as object | undefined), ...(iv as object) });
    });
    queryClient.setQueryData(applicantsKeys.detail(id), {
      ...(previous as object),
      interviews: Array.from(byId.values()),
    } as Applicant);
    return;
  }

  // Last resort: don't touch the cache (avoid wiping good data with a
  // shape we don't understand).
}

// Get all applicants
export function useApplicants(params?: {
  companyId?: string[];
  jobPositionId?: string | string[];
  departmentId?: string[];
  status?: string | string[];
  fields?: string | string[];
  enabled?: boolean;
  search?: string;
  skipPopulation?: boolean; // new param to skip population of related fields
}) {
  const { user } = useAuth();
  const userCompanyIds = getUserCompanyIds(user);
  const effectiveCompanyId = params?.companyId?.length ? params.companyId : userCompanyIds;

  const isSearch = !!params?.search;

  return useQuery({
    queryKey: applicantsKeys.list({
      companyId: effectiveCompanyId,
      jobPositionId: params?.jobPositionId,
      departmentId: params?.departmentId,
      status: params?.status,
      search: params?.search,
      fields: params?.fields,
      skipPopulation: params?.skipPopulation,
    }),
    queryFn: () => {
      if (isSearch) {
        const companyIds = effectiveCompanyId?.length ? effectiveCompanyId : undefined;
        return applicantsService.searchApplicants({
          q: params!.search!,
          companyId: companyIds,
          page: 1,
          limit: 9999,
        });
      }
      return applicantsService.getAllApplicants({
        companyId: effectiveCompanyId,
        jobPositionId: params?.jobPositionId,
        departmentId: params?.departmentId,
        status: params?.status,
        search: params?.search,
        fields: params?.fields,
        skipPopulation: params?.skipPopulation,
      });
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    enabled: params?.enabled ?? true,
  });
}

// Get applicant by ID
export function useApplicant(id: string, options?: {
  initialData?: Applicant;
  enabled?: boolean;
  staleTime?: number;
  fields?: string;
}) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [...applicantsKeys.detail(id), { fields: options?.fields }],
    queryFn: async () => {
      const data = await applicantsService.getApplicantById(id, options?.fields);
      // Reconcile BEFORE the response enters the cache: a lagging backend
      // read must never resurrect deleted questions/groups or drop added
      // ones. This keeps background refetches completely invisible.
      return applyInterviewIntent(id, data);
    },
    enabled: !!id && (options?.enabled ?? true),
    // Fresh (non-zero) staleTime is critical: optimistic updates from
    // interview mutations write directly into this cache entry. A zero
    // staleTime marks the data instantly stale, so any refocus/remount
    // refetch races ahead of the server commit and overwrites the
    // optimistic state (startedAt / questions / removed groups) with the
    // PRE-mutation server payload.
    staleTime: options?.staleTime ?? 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    placeholderData: options?.initialData ?? (() => {
      const queryCache = queryClient.getQueryCache();
      const listQueries = queryCache.findAll({ queryKey: applicantsKeys.lists() });
      for (const query of listQueries) {
        const data = query.state.data;
        if (Array.isArray(data)) {
          const found = (data as Applicant[]).find(a => a._id === id);
          if (found) return found;
        }
      }
      return undefined;
    }),
  });
}

// Get applicant status insights
export function useApplicantStatuses(params?: {
  companyId?: string[];
  jobPositionId?: string;
  enabled?: boolean;
}) {
  const { user } = useAuth();
  const userCompanyIds = getUserCompanyIds(user);
  const effectiveCompanyId = params?.companyId?.length ? params.companyId : userCompanyIds;

  return useQuery({
    queryKey: [...applicantsKeys.list({ companyId: effectiveCompanyId, jobPositionId: params?.jobPositionId }), 'statuses'],
    queryFn: () => applicantsService.getApplicantStatuses({
      companyId: effectiveCompanyId,
      status: params?.jobPositionId,
    }),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    enabled: params?.enabled ?? true,
  });
}

// Batch update applicant status
export function useBatchUpdateApplicantStatus() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: (updates: Array<{ applicantId: string; status: string; notes?: string; reasons?: string[] }>) =>
      applicantsService.batchUpdateStatus(updates),
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: applicantsKeys.lists() });

      const previousLists: Record<string, any[] | undefined> = {};
      const queryCache = queryClient.getQueryCache();
      const listQueries = queryCache.findAll({ queryKey: applicantsKeys.lists(), type: 'active' });
      listQueries.forEach((query) => {
        previousLists[JSON.stringify(query.queryKey)] = query.state.data as any[] | undefined;
        queryClient.setQueryData(query.queryKey, (old: any[] | undefined) => {
          if (!old) return old;
          const updateMap = new Map(updates.map((u) => [u.applicantId, u.status]));
          return old.map((a) => {
            if (updateMap.has(a._id)) {
              return { ...a, status: updateMap.get(a._id) };
            }
            return a;
          });
        });
      });

      return { previousLists };
    },
    onSuccess: (result, _updates) => {
      if (result && typeof result === 'object') {
        const data = (result as any).data ?? result;
        if (Array.isArray(data)) {
          data.forEach((item: any) => {
            if (item?._id) {
              queryClient.setQueryData(applicantsKeys.detail(item._id), item);
            }
          });
        }
      }
      showSuccessToast(t('statusesUpdated', 'common'), t);
    },
    onError: (error: ApiError, _updates, context) => {
      if (context?.previousLists) {
        Object.entries(context.previousLists).forEach(([key, data]) => {
          if (data !== undefined) {
            queryClient.setQueryData(JSON.parse(key), data);
          }
        });
      }
      showErrorToast(error.message, t('statusesUpdateFailed', 'common'), t);
    },
  });
}

// Create applicant
export function useCreateApplicant() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: (data: CreateApplicantRequest) => applicantsService.createApplicant(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicantsKeys.lists() });
      showSuccessToast(t('applicantCreated', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('applicantCreateFailed', 'common'), t);
    },
  });
}

// Update applicant
export function useUpdateApplicant() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateApplicantRequest }) =>
      applicantsService.updateApplicant(id, data),
    onSuccess: (updatedApplicant, { id }) => {
      // If the response is a full applicant object, update the cache directly.
      // Otherwise, invalidate the cache so the latest data is fetched.
      const looksLikeApplicant =
        updatedApplicant &&
        typeof updatedApplicant === 'object' &&
        (updatedApplicant as Partial<Applicant>)._id &&
        ((updatedApplicant as Partial<Applicant>).fullName !== undefined ||
          (updatedApplicant as Partial<Applicant>).firstName !== undefined ||
          (updatedApplicant as Partial<Applicant>).email !== undefined ||
          (updatedApplicant as Partial<Applicant>).phone !== undefined ||
          (updatedApplicant as Partial<Applicant>).status !== undefined);

      if (looksLikeApplicant) {
        queryClient.setQueryData(applicantsKeys.detail(id), updatedApplicant);
        queryClient.setQueryData<Applicant[]>(applicantsKeys.list(), (old) => {
          if (!old) return [updatedApplicant as Applicant];
          return old.map((applicant) =>
            applicant._id === id ? (updatedApplicant as Applicant) : applicant
          );
        });
      } else {
        queryClient.invalidateQueries({ queryKey: applicantsKeys.detail(id) });
        queryClient.invalidateQueries({ queryKey: applicantsKeys.lists() });
      }

      showSuccessToast(t('applicantUpdated', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('applicantUpdateFailed', 'common'), t);
    },
  });
}

// Mark applicant as seen
export function useMarkApplicantSeen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => applicantsService.markAsSeen(id),
    onSuccess: (_, id) => {
      // Silently update - no toast needed
      queryClient.invalidateQueries({ queryKey: applicantsKeys.detail(id) });
    },
    onError: (error: ApiError) => {
      console.error("Failed to mark as seen:", error.message);
    },
  });
}

// Update applicant status
type UpdateStatusVariables = { id: string; data: UpdateStatusRequest; silent?: boolean };
type UpdateStatusContext = { previousLists: Record<string, Applicant[] | undefined>; previousDetailData: Record<string, any> };

export function useUpdateApplicantStatus() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation<Applicant, ApiError, UpdateStatusVariables, UpdateStatusContext>({
    mutationFn: ({ id, data }: UpdateStatusVariables) =>
      applicantsService.updateApplicantStatus(id, data),
    onMutate: async ({ id, data, silent }) => {
      await queryClient.cancelQueries({ queryKey: applicantsKeys.all });

      const previousLists: Record<string, Applicant[] | undefined> = {};
      const queryCache = queryClient.getQueryCache();
      const listQueries = queryCache.findAll({ queryKey: applicantsKeys.lists(), type: 'active' });
      listQueries.forEach((query) => {
        previousLists[JSON.stringify(query.queryKey)] = query.state.data as Applicant[] | undefined;
        queryClient.setQueryData(query.queryKey, (old: Applicant[] | undefined) => {
          if (!old) return old;
          return old.map((a) => a._id === id ? { ...a, status: data.status } : a);
        });
      });

      const previousDetailData: Record<string, any> = {};
      queryClient.setQueriesData({ queryKey: applicantsKeys.detail(id) }, (old: any) => {
        if (!old) return old;
        previousDetailData[JSON.stringify(queryClient.getQueryCache().find({ queryKey: applicantsKeys.detail(id) })?.queryKey)] = old;
        return { ...old, status: data.status };
      });

      if (!silent) showSuccessToast(t('statusUpdated', 'common'), t);

      return { previousLists, previousDetailData };
    },
    onSuccess: (updatedApplicant, { id }) => {
      const looksLikeApplicant =
        updatedApplicant &&
        typeof updatedApplicant === 'object' &&
        (updatedApplicant as Partial<Applicant>)._id &&
        ((updatedApplicant as Partial<Applicant>).fullName !== undefined ||
          (updatedApplicant as Partial<Applicant>).firstName !== undefined ||
          (updatedApplicant as Partial<Applicant>).email !== undefined ||
          (updatedApplicant as Partial<Applicant>).phone !== undefined ||
          (updatedApplicant as Partial<Applicant>).status !== undefined);

      if (looksLikeApplicant) {
        queryClient.setQueriesData({ queryKey: applicantsKeys.detail(id) }, updatedApplicant);
      }
    },
    onError: (error: ApiError, _variables, context) => {
      if (context?.previousDetailData) {
        Object.entries(context.previousDetailData).forEach(([key, data]) => {
          if (data !== undefined) {
            queryClient.setQueryData(JSON.parse(key), data);
          }
        });
      }
      if (context?.previousLists) {
        Object.entries(context.previousLists).forEach(([key, data]) => {
          if (data !== undefined) {
            queryClient.setQueryData(JSON.parse(key), data);
          }
        });
      }
      showErrorToast(error.message, t('statusUpdateFailed', 'common'), t);
    },
  });
}

// Delete applicant
export function useDeleteApplicant() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: (id: string) => applicantsService.deleteApplicant(id),
    onSuccess: (_, id) => {
      // Remove from list cache
      queryClient.setQueryData<Applicant[]>(applicantsKeys.list(), (old) => {
        if (!old) return [];
        return old.filter(applicant => applicant._id !== id);
      });
      
      // Remove detail cache
      queryClient.removeQueries({ queryKey: applicantsKeys.detail(id) });
      
      showSuccessToast(t('applicantDeleted', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('applicantDeleteFailed', 'common'), t);
    },
  });
}

// Schedule interview
export function useScheduleInterview() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ScheduleInterviewRequest }) =>
      applicantsService.scheduleInterview(id, data),
    onSuccess: (response, { id }) => {
      const res = response as Record<string, unknown>;
      const succeeded = res.succeeded as Array<Record<string, unknown>> | undefined;
      const unwrapped = succeeded?.[0] ?? res;
      mergeApplicantResponseIntoCache(queryClient, id, unwrapped);
      showSuccessToast(t('interviewScheduled', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('interviewScheduleFailed', 'common'), t);
    },
  });
}

// Schedule bulk interviews
export function useScheduleBulkInterviews() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: (payload: { interviews: Array<any> } | Array<any>) =>
      applicantsService.scheduleBulkInterviews(payload),
    onSuccess: (_, payload) => {
      const items = Array.isArray(payload) ? payload : (payload as any).interviews ?? [];
      items.forEach((item: any) => {
        if (item?.applicantId) {
          queryClient.invalidateQueries({ queryKey: applicantsKeys.detail(item.applicantId) });
        }
      });
      showSuccessToast(t('interviewsScheduled', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('interviewsScheduleFailed', 'common'), t);
    },
  });
}

// Update interview status
type UpdateInterviewStatusVars = {
  applicantId: string;
  interviewId: string;
  data: UpdateInterviewStatusRequest;
  /** Field-level autosaves pass true to avoid refetch churn while typing. */
  skipBackgroundRefetch?: boolean;
};
type UpdateInterviewStatusContext = { previousApplicant?: Applicant };

export function useUpdateInterviewStatus() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation<
    Awaited<ReturnType<typeof applicantsService.updateInterviewStatus>>,
    ApiError,
    UpdateInterviewStatusVars,
    UpdateInterviewStatusContext
  >({
    mutationFn: ({ applicantId, interviewId, data }: UpdateInterviewStatusVars) => {
      // Never persist optimistic ghosts: a lagging-read stand-in that leaks
      // into an autosave payload would be written as a real second copy,
      // permanently duplicating the question server-side.
      const payload: Record<string, unknown> = { ...(data as Record<string, unknown>) };
      if (Array.isArray(payload.questions)) {
        payload.questions = stripOptimisticGhosts(payload.questions);
      }
      return applicantsService.updateInterviewStatus(applicantId, interviewId, payload as UpdateInterviewStatusRequest);
    },
    onMutate: async ({ applicantId, interviewId, data }) => {
      await queryClient.cancelQueries({ queryKey: applicantsKeys.detail(applicantId) });
      const previousApplicant = queryClient.getQueryData<Applicant | undefined>(
        applicantsKeys.detail(applicantId),
      );
      if (previousApplicant && Array.isArray(previousApplicant.interviews)) {
        const nextInterviews = previousApplicant.interviews.map((iv) => {
          if ((iv?._id || iv?.id) !== interviewId) return iv;
          return { ...iv, ...data };
        });
        queryClient.setQueryData(applicantsKeys.detail(applicantId), {
          ...previousApplicant,
          interviews: nextInterviews,
        });
      }
      return { previousApplicant };
    },
    onSuccess: async (_response, { applicantId, skipBackgroundRefetch }) => {
      // Structural authority = the optimistically-patched cache. Do NOT
      // graft the mutation response into the cache: the backend can echo a
      // pre-save question list in the response body, which would visibly
      // wipe just-added groups/questions for a moment until the next GET.
      // Convergence happens exclusively via reconciled background refetches
      // (applyInterviewIntent filters them in queryFn).
      if (!skipBackgroundRefetch && applicantId) {
        await queryClient.invalidateQueries({ queryKey: applicantsKeys.detail(applicantId) });
      }
    },
    onError: (error: ApiError, _variables, context) => {
      if (context?.previousApplicant) {
        const previous = context.previousApplicant;
        const { applicantId } = _variables;
        queryClient.setQueryData(applicantsKeys.detail(applicantId), previous);
      }
      showErrorToast(error.message, t('interviewUpdateFailed', 'common'), t);
    },
  });
}

// Delete interview
export function useDeleteInterview() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({ applicantId, interviewId }: {
      applicantId: string;
      interviewId: string;
    }) => applicantsService.deleteInterview(applicantId, interviewId),
    onSuccess: (updatedApplicant, { applicantId }) => {
      // Only write the response when it looks like a full applicant;
      // partial/stripped payloads would visibly wipe cached detail data
      // until the background refetch below restores it.
      const res = updatedApplicant as Partial<Applicant> | undefined;
      const looksLikeFullApplicant =
        res &&
        typeof res === 'object' &&
        (res.fullName !== undefined ||
          res.firstName !== undefined ||
          res.email !== undefined ||
          res.phone !== undefined) &&
        Array.isArray(res.interviews);
      if (looksLikeFullApplicant) {
        queryClient.setQueryData(applicantsKeys.detail(applicantId), updatedApplicant);
      }
      queryClient.invalidateQueries({ queryKey: applicantsKeys.detail(applicantId) });
      showSuccessToast(t('interviewDeleted', 'common'), t);
    },
    onError: (error: ApiError) => {
      showErrorToast(error.message, t('interviewDeleteFailed', 'common'), t);
    },
  });
}

// Add comment
export function useAddComment() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AddCommentRequest }) =>
      applicantsService.addComment(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: applicantsKeys.detail(id) });
      const previousApplicant = queryClient.getQueryData<Applicant | undefined>(
        applicantsKeys.detail(id),
      );
      if (previousApplicant) {
        const tempComment = {
          _id: `temp_comment_${Date.now()}`,
          text: data.text || '',
          createdAt: new Date().toISOString(),
          userId: data.userId,
        };
        queryClient.setQueryData(applicantsKeys.detail(id), {
          ...previousApplicant,
          comments: [...(previousApplicant.comments || []), tempComment],
        });
      }
      return { previousApplicant };
    },
    onSuccess: (response, { id }) => {
      mergeApplicantResponseIntoCache(queryClient, id, response, {
        appendKey: 'comments',
      });
      showSuccessToast(t('commentAdded', 'common'), t);
    },
    onError: (error: ApiError, { id }, context) => {
      if (context?.previousApplicant) {
        queryClient.setQueryData(applicantsKeys.detail(id), context.previousApplicant);
      }
      showErrorToast(error.message, t('commentAddFailed', 'common'), t);
    },
  });
}

// Send message
export function useSendMessage() {
  const queryClient = useQueryClient();
  const { t } = useLocale();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SendMessageRequest }) =>
      applicantsService.sendMessage(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: applicantsKeys.detail(id) });
      const previousApplicant = queryClient.getQueryData<Applicant | undefined>(
        applicantsKeys.detail(id),
      );
      if (previousApplicant) {
        const tempActivity = {
          id: `temp_msg_${Date.now()}`,
          type: (data.type || 'email') as Activity['type'],
          title: data.subject || data.content || data.comment || '',
          description: data.content || data.comment || '',
          timestamp: new Date().toISOString(),
        };
        queryClient.setQueryData(applicantsKeys.detail(id), {
          ...previousApplicant,
          activities: [...(previousApplicant.activities || []), tempActivity],
        });
      }
      return { previousApplicant };
    },
    onSuccess: (response, { id }) => {
      mergeApplicantResponseIntoCache(queryClient, id, response);
      showSuccessToast(t('messageSent', 'common'), t);
    },
    onError: (error: ApiError, { id }, context) => {
      if (context?.previousApplicant) {
        queryClient.setQueryData(applicantsKeys.detail(id), context.previousApplicant);
      }
      showErrorToast(error.message, t('messageSendFailed', 'common'), t);
    },
  });
}

export function useRejectionInsights(params?: { companyId?: string[]; enabled?: boolean }) {
  const { user } = useAuth();
  const userCompanyIds = getUserCompanyIds(user);
  const effectiveCompanyId = params?.companyId?.length ? params.companyId : userCompanyIds;

  return useQuery({
    queryKey: applicantsKeys.rejectionInsights(effectiveCompanyId),
    queryFn: () => applicantsService.getRejectionInsights({ companyId: effectiveCompanyId }),
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: params?.enabled ?? true,
    retry: false,
  });
}

// Get applicants by phone number
export function useApplicantsByPhone(phone?: string, options?: { enabled?: boolean; companyId?: string }) {
  return useQuery({
    queryKey: applicantsKeys.byPhone(phone || ''),
    queryFn: () => applicantsService.getApplicantsByPhone(phone || '', options?.companyId),
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: !!phone && (options?.enabled ?? true),
    retry: false,
  });
}

// ===== Toast Helpers =====
function showSuccessToast(message: string, t: (key: string, ns?: string) => string) {
  Swal.fire({
    title: t('success', 'common'),
    text: message,
    icon: "success",
    timer: 1500,
    showConfirmButton: false,
  });
}

function showErrorToast(message: string, fallback: string, t: (key: string, ns?: string) => string) {
  Swal.fire({
    title: t('error', 'common'),
    text: message || fallback,
    icon: "error",
  });
}