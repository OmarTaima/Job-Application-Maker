import { useCallback, useRef, useState } from 'react';
import Swal from '../../../../../../utils/swal';
import { useLocale } from '../../../../../../context/LocaleContext';
import { useUpdateInterviewStatus } from '../../../../../../hooks/queries';
import type {
  Applicant,
  Interview,
  InterviewAnswer,
  UpdateInterviewStatusRequest,
} from '../../../../../../types/applicants';
import { computeAchievedScore, computeTotalScore } from '../utils/interviewUtils';

export type FieldSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type BuildQuestionsArg = InterviewAnswer[];

type UseInterviewActionsOptions = {
  applicantId: string;
  interview: Interview | null;
  onQuestionsPersisted?: (saved: InterviewAnswer[] | undefined, built: InterviewAnswer[]) => void;
  currentUserId?: string;
};

const resolveStringId = (v: unknown): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const obj = v as { _id?: unknown; id?: unknown };
    return String(obj._id || obj.id || '');
  }
  return String(v);
};

const extractInterview = (payload: unknown, interviewId: string): Interview | undefined => {
  if (!payload || typeof payload !== 'object') return undefined;
  const candidate = payload as Partial<Applicant> & { interviews?: Interview[] };
  if (Array.isArray(candidate.interviews)) {
    return candidate.interviews.find(
      (iv) => (iv?._id || iv?.id) === interviewId
    );
  }
  if (candidate && (candidate._id || (candidate as Partial<Interview>).id)) {
    return candidate as unknown as Interview;
  }
  return undefined;
};

export const useInterviewActions = ({
  applicantId,
  interview,
  onQuestionsPersisted,
  currentUserId,
}: UseInterviewActionsOptions) => {
  const { t } = useLocale();
  const mutation = useUpdateInterviewStatus();
  const [isPickerSaving, setIsPickerSaving] = useState(false);
  const [fieldSaveStatus] = useState<FieldSaveStatus>('idle');
  const debounceRef = useRef<number | null>(null);

  const interviewId = String(interview?._id || interview?.id || '');

  const clearDebounce = useCallback(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const [fieldSaveStatusMap, setFieldSaveStatusMap] = useState<Record<string, FieldSaveStatus>>({});
void setFieldSaveStatusMap;
  const saveQuestion = useCallback(
    async (builtQuestions: InterviewAnswer[]): Promise<boolean> => {
      if (!applicantId || !interviewId) return false;
      const payload: Record<string, unknown> = {
        questions: (q => q)(builtQuestions),
        totalScore: computeTotalScore(builtQuestions),
        achievedScore: computeAchievedScore(builtQuestions),
      };
      try {
        const response = await mutation.mutateAsync({
          applicantId,
          interviewId,
          data: payload as UpdateInterviewStatusRequest,
          // Field-level autosave: skip the post-commit background refetch
          // so rapid typing doesn't trigger a fetch storm. The optimistic
          // cache entry stays authoritative between structural saves.
          skipBackgroundRefetch: true,
        });
        const responseInterview = extractInterview(response, interviewId);
        onQuestionsPersisted?.(responseInterview?.questions, builtQuestions);
        return true;
      } catch {
        return false;
      }
    },
    [applicantId, interviewId, mutation, onQuestionsPersisted]
  );

  /**
   * Save the picked groups. Optionally start the timer too.
   * Returns true on success, false on failure.
   */
  const savePickedGroups = useCallback(
    async (builtQuestions: BuildQuestionsArg, startAfter: boolean, allowEmpty?: boolean): Promise<boolean> => {
      if (!applicantId || !interviewId) return false;
      if (builtQuestions.length === 0 && !allowEmpty) {
        await Swal.fire({
          icon: 'warning',
          title: t('noQuestionsBuilt', 'interview'),
          text: t('questionsEmptyDescription', 'interview'),
        });
        return false;
      }

      // Freshly built questions carry the full predefined tag list (used for
      // display + group meta seeding), but the server stores `tags` as the
      // interviewer's SELECTION only — so send an empty selection.
      const payload: Record<string, unknown> = {
        questions: (q => q)(builtQuestions.map((q) => ({ ...q, tags: [] as string[] }))),
        totalScore: computeTotalScore(builtQuestions),
        achievedScore: 0,
      };
      if (startAfter) {
        payload.startedAt = new Date().toISOString();
        payload.status = 'in_progress';
        if (currentUserId) {
          payload.conductedBy = currentUserId;
        } else if (interview?.conductedBy) {
          payload.conductedBy = resolveStringId(interview.conductedBy);
        }
      }

      setIsPickerSaving(true);
      try {
        const response = await mutation.mutateAsync({
          applicantId,
          interviewId,
          data: payload as UpdateInterviewStatusRequest,
        });
        const responseInterview = extractInterview(response, interviewId);
        onQuestionsPersisted?.(responseInterview?.questions, builtQuestions);
        return true;
      } catch (e) {
        void e;
        return false;
      } finally {
        setIsPickerSaving(false);
      }
    },
    [applicantId, interviewId, mutation, onQuestionsPersisted]
  );

  /**
   * Start the interview timer. LOCAL-ONLY: no network request is sent.
   * The orchestrator writes startedAt/status into the React Query cache
   * optimistically. The server only learns about start/end when the user
   * presses "End Interview" and endInterview() is called.
   */
  const startInterview = useCallback(async (): Promise<boolean> => {
    if (!applicantId || !interviewId) return false;
    if (interview?.startedAt) return true;
    return true;
  }, [applicantId, interviewId, interview?.startedAt]);

  /**
   * End the interview: set endedAt, status='completed', and persist the
   * final questions/totalScore/achievedScore. Shows a confirmation dialog
   * first.
   */
  const endInterview = useCallback(
    async (finalQuestions: InterviewAnswer[]): Promise<boolean> => {
      if (!applicantId || !interviewId) return false;
      const confirm = await Swal.fire({
        icon: 'question',
        title: t('endInterview', 'interview'),
        text: t('endInterviewDescription', 'interview'),
        showCancelButton: true,
        confirmButtonText: t('endInterviewConfirm', 'interview'),
        cancelButtonText: t('cancel', 'common'),
        confirmButtonColor: '#dc2626',
      });
      if (!confirm.isConfirmed) return false;

      const payload: Record<string, unknown> = {
        endedAt: new Date().toISOString(),
        status: 'completed',
        questions: (q => q)(finalQuestions),
        totalScore: computeTotalScore(finalQuestions),
        achievedScore: computeAchievedScore(finalQuestions),
      };
      // Forward the locally-captured startedAt (written into the React Query
      // cache by handleStart). The server never received it at start time ΓÇö
      // it's only persisted here, when the interview is ended.
      if (interview?.startedAt) {
        payload.startedAt = interview.startedAt;
      }
      try {
        await mutation.mutateAsync({
          applicantId,
          interviewId,
          data: payload as UpdateInterviewStatusRequest,
        });
        return true;
      } catch (e) {
        void e;
        return false;
      }
    },
    [applicantId, interviewId, mutation, interview?.startedAt]
  );

  return {
    savePickedGroups,
    startInterview,
    endInterview,
    saveQuestion,
    isPickerSaving,
    fieldSaveStatus,
    fieldSaveStatusMap,
    isMutating: mutation.isPending,
    clearDebounce,
  };
};
