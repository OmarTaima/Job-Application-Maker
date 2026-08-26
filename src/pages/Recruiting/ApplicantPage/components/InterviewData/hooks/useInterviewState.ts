import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApplicant } from '../../../../../../hooks/queries';
import { useLocale } from '../../../../../../context/LocaleContext';
import Swal from '../../../../../../utils/swal';
import type { Applicant, Interview, InterviewAnswer } from '../../../../../../types/applicants';
import {
  isScheduled,
  getInterviewId,
  getQuestionId,
  computeAchievedScore,
  computeTotalScore,
} from '../utils/interviewUtils';
import { useGroupMeta } from './useGroupMeta';
import { useQuestionPool, type PoolGroup } from './useQuestionPool';

export type InterviewViewName =
  | 'selection'
  | 'interview-picker'
  | 'question-picker'
  | 'assessment';

type ExistingInterview = Interview;
type ExistingQuestion = InterviewAnswer;

export const resolveApplicantCompanyId = (applicant: Applicant | undefined): string => {
  if (!applicant) return '';
  const resolve = (v: unknown): string => {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
      const obj = v as { _id?: string; id?: string };
      return obj?._id || obj?.id || '';
    }
    return '';
  };
  const direct = applicant as { companyId?: string | { _id?: string; id?: string } };
  const nested = (applicant as { jobPositionId?: { companyId?: string | { _id?: string; id?: string } } })
    .jobPositionId;
  return (
    resolve(direct.companyId) ||
    resolve(nested?.companyId) ||
    ''
  );
};

export const useInterviewState = (
  applicantId: string,
  autoSelectInterviewId: string | null | undefined,
  externalApplicantData?: Applicant,
  currentUserId?: string
) => {
  const { data: fetchedData } = useApplicant(applicantId, { enabled: !!applicantId && !externalApplicantData });
  const applicantData = externalApplicantData ?? fetchedData;
  const companyId = useMemo(() => resolveApplicantCompanyId(applicantData), [applicantData]);
  const { pool: questionPool } = useQuestionPool(companyId);
  const { t } = useLocale();

  const allInterviews = useMemo<ExistingInterview[]>(
    () =>
      (Array.isArray((applicantData as { interviews?: ExistingInterview[] } | undefined)?.interviews)
        ? (applicantData as { interviews: ExistingInterview[] }).interviews
        : []),
    [applicantData]
  );

  const scheduledInterviews = useMemo<ExistingInterview[]>(
    () => allInterviews.filter((iv) => isScheduled(iv)),
    [allInterviews]
  );

  // View + selection state
  const [view, setView] = useState<InterviewViewName>('selection');
  const [selectedInterviewId, setSelectedInterviewId] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [achievedPercentages, setAchievedPercentages] = useState<Record<string, number>>({});
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [selectedTagsByQuestion, setSelectedTagsByQuestion] = useState<Record<string, string[]>>({});

  const selectedInterview = useMemo<ExistingInterview | null>(() => {
    if (!selectedInterviewId) return null;
    return (
      allInterviews.find((iv) => getInterviewId(iv) === selectedInterviewId) ?? null
    );
  }, [allInterviews, selectedInterviewId]);

  const questionTypeMap = useMemo(() => {
    const map: Record<string, { answerType: string; choices: { label: string; score: number }[]; tags?: string[] }> = {};
    questionPool.forEach((group) => {
      group.questions.forEach((q) => {
        const id = q._id || q.id;
        if (id) map[id] = { answerType: q.answerType, choices: q.choices, tags: q.tags };
      });
    });
    return map;
  }, [questionPool]);

  // Group meta (persisted) — must be declared before flatExistingQuestions
  const groupMeta = useGroupMeta(applicantId, selectedInterviewId ?? '');

  const flatExistingQuestions = useMemo<ExistingQuestion[]>(
    () => {
      const raw = selectedInterview && Array.isArray(selectedInterview.questions) ? selectedInterview.questions : [];
      return raw.map((q) => {
        const qId = (q as any)?._id || (q as any)?.id;
        const enriched = qId ? questionTypeMap[qId] : undefined;
        if (enriched) {
          return { ...q, answerType: enriched.answerType, choices: enriched.choices, tags: enriched.tags };
        }
        const meta = qId ? groupMeta.meta[qId] : undefined;
        const fallbackAnswerType = meta?.answerType || (q as any)?.answerType || 'text';
        if ((q as any)?.answerType !== fallbackAnswerType || (meta?.tags && Array.isArray(meta.tags))) {
          const fallbackTags = meta?.tags && meta.tags.length > 0 ? meta.tags : undefined;
          return {
            ...(q as any),
            answerType: fallbackAnswerType,
            ...(fallbackTags ? { tags: fallbackTags } : {}),
          };
        }
        return q;
      });
    },
    [selectedInterview, questionTypeMap, groupMeta.meta]
  );

  // Auto-load on first data arrival: pick a single interview directly, or
  // open the picker if there are multiple. Auto-select a newly created
  // interview once. We guard with a ref so subsequent cache updates
  // (e.g. after Start Interview / Save & Start) do NOT clobber the user's
  // current view — that was sending the user back to the picker.
  const lastConsumedAutoSelectRef = useRef<string | null>(null);
  const initialLoadDoneRef = useRef<boolean>(false);
  useEffect(() => {
    if (autoSelectInterviewId && autoSelectInterviewId !== lastConsumedAutoSelectRef.current) {
      const found = allInterviews.find((iv) => getInterviewId(iv) === autoSelectInterviewId);
      if (found) {
        lastConsumedAutoSelectRef.current = autoSelectInterviewId;
        initialLoadDoneRef.current = true;
        openInterview(found);
        if (found.status === 'in_progress') {
          const questions = Array.isArray(found.questions) ? found.questions : [];
          if (questions.length === 0) setView('assessment');
        }
        return;
      }
    }
    if (initialLoadDoneRef.current) return;
    if (allInterviews.length === 0) return;
    initialLoadDoneRef.current = true;
    if (allInterviews.length === 1) {
      openInterview(allInterviews[0]);
    } else {
      setView('interview-picker');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allInterviews, autoSelectInterviewId]);

  // When the selected interview changes (or its questions are replaced by an
  // optimistic update), seed local state from it. Uses useLayoutEffect so
  // groupMeta is populated BEFORE the first paint — otherwise
  // groupedQuestions collapses everything into __ungrouped__.
  //
  // We preserve the user's existing slider state for any question whose id
  // Seed group meta from loaded questions so answerType is available for
  // enrichment even before the question pool finishes loading.
  // Must run in useLayoutEffect: a background GET swaps question id-space
  // (client pool ids -> server document ids), which breaks groupMeta lookups
  // for exactly one painted frame if seeding happens post-paint — the
  // "blink". Re-seeding pre-paint means the browser never sees the
  // intermediate ungrouped state.
  useLayoutEffect(() => {
    if (!selectedInterview) return;
    const questions = Array.isArray(selectedInterview.questions) ? selectedInterview.questions : [];
    if (questions.length === 0) return;
    groupMeta.seedFromLoaded(questions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInterviewId]);

  // Background refetches return questions with regenerated server ids and
  // stripped group fields. Re-run the seeder whenever the question list
  // content changes so the stored __idx_N fallbacks re-map groups onto
  // fresh ids — pre-paint, so the swap is visually seamless.
  const questionsSignatureRef = useRef<string>('');
  useLayoutEffect(() => {
    const sig = flatExistingQuestions
      .map((q) => `${getQuestionId(q)}:${q?.score ?? ''}:${q?.question ?? ''}`)
      .join('|');
    if (sig === questionsSignatureRef.current) return;
    const isFirst = questionsSignatureRef.current === '';
    questionsSignatureRef.current = sig;
    if (!selectedInterview) return;
    if (flatExistingQuestions.length === 0) return;
    // First render for this interview is handled by the selectedInterviewId
    // effect above; this covers subsequent cache swaps (refetch landings).
    if (!isFirst) {
      groupMeta.seedFromLoaded(flatExistingQuestions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatExistingQuestions, selectedInterview]);
  
  // is still present, and only seed entries for new questions from their
  // achievedScore. This way, the slider responds to drags immediately after
  // a "Save & Start" replaces the question list.
  const seededQIdsRef = useRef<string>('');
  // Keeps the question text for every id we have seeded, so a value can be
  // preserved by text when a server round trip replaces question ids (while
  // leaving the text intact).
  const questionTextRef = useRef<Record<string, string>>({});
  // Hard-reset ALL per-interview answer state on interview switch, BEFORE
  // any seeder runs. Without this, opening another interview inherits the
  // previous interview's sliders/answers via the byText preservation logic
  // (same group -> same question wording) — cross-interview answer bleed.
  useLayoutEffect(() => {
    setAchievedPercentages({});
    setAnswers({});
    setSelectedTagsByQuestion({});
    setOpenGroups([]);
    seededQIdsRef.current = '';
    questionTextRef.current = {};
    questionsSignatureRef.current = '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInterviewId]);
  useLayoutEffect(() => {
    if (!selectedInterview) return;
    const questions = Array.isArray(selectedInterview.questions) ? selectedInterview.questions : [];
    if (questions.length === 0) {
      if (seededQIdsRef.current) {
        setAchievedPercentages({});
        setAnswers({});
        setOpenGroups([]);
        seededQIdsRef.current = '';
        questionTextRef.current = {};
      }
      return;
    }
    const key = questions.map((q) => {
      const qId = getQuestionId(q);
      return `${qId}:${q?.achievedScore ?? ''}:${q?.score ?? ''}:${q?.notes ?? ''}`;
    }).join('|');
    if (key === seededQIdsRef.current) return;
    seededQIdsRef.current = key;
    questions.forEach((q) => {
      const qId = getQuestionId(q);
      if (qId) questionTextRef.current[qId] = String(q?.question ?? '');
    });
    setAchievedPercentages((prev) => {
      const next: Record<string, number> = {};
      const byText: Record<string, number> = {};
      Object.entries(prev).forEach(([id, pct]) => {
        const text = questionTextRef.current[id];
        if (text) byText[text] = pct;
      });
      questions.forEach((q) => {
        const qId = getQuestionId(q);
        if (!qId) return;
        const score = Number(q?.score ?? 0);
        const achieved = Number(q?.achievedScore ?? 0);
        if (prev[qId] !== undefined) {
          next[qId] = prev[qId];
        } else {
          const matched = byText[String(q?.question ?? '')];
          if (matched !== undefined) {
            next[qId] = matched;
          } else if (score > 0) {
            next[qId] = Math.max(0, Math.min(100, (achieved / score) * 100));
          }
        }
      });
      return next;
    });
    setAnswers((prev) => {
      const next: Record<string, unknown> = {};
      const byText: Record<string, unknown> = {};
      Object.entries(prev).forEach(([id, value]) => {
        const text = questionTextRef.current[id];
        if (text) byText[text] = value;
      });
      questions.forEach((q) => {
        const qId = getQuestionId(q);
        if (!qId) return;
        if (prev[qId] !== undefined) {
          next[qId] = prev[qId];
        } else if (byText[String(q?.question ?? '')] !== undefined) {
          next[qId] = byText[String(q?.question ?? '')];
        } else if (q?.notes) {
          const raw = q.notes;
          if (raw === 'true') {
            next[qId] = true;
          } else if (raw === 'false') {
            next[qId] = false;
          } else if (raw.startsWith('[') || raw.startsWith('{')) {
            try {
              next[qId] = JSON.parse(raw);
            } catch {
              next[qId] = raw;
            }
          } else {
            next[qId] = raw;
          }
        }
      });
      return next;
    });
    setSelectedTagsByQuestion((prev) => {
      const next: Record<string, string[]> = {};
      const byText: Record<string, string[]> = {};
      Object.entries(prev).forEach(([id, tags]) => {
        const text = questionTextRef.current[id];
        if (text) byText[text] = tags;
      });
      questions.forEach((q) => {
        const qId = getQuestionId(q);
        if (!qId) return;
        if (prev[qId] !== undefined) {
          next[qId] = prev[qId];
        } else if (byText[String(q?.question ?? '')] !== undefined) {
          next[qId] = byText[String(q?.question ?? '')];
        } else if (Array.isArray(q?.tags)) {
          const qTags = (q.tags as any[])
            .map((tag) => String(tag ?? ''))
            .filter(Boolean);
          const fullList = questionTypeMap[qId]?.tags;
          const isFullList =
            Array.isArray(fullList) &&
            qTags.length === fullList.length &&
            fullList.every((tag) => qTags.includes(String(tag ?? '')));
          // A freshly built question carries the full predefined tag list
          // (the selection lives separately); only seed the selection when
          // the tags are NOT the full pool list (i.e. a saved subset).
          if (!isFullList) {
            next[qId] = qTags;
          }
        }
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInterviewId, flatExistingQuestions]);

  // ---- Actions ----------------------------------------------------------
  const resolveConductedById = (v: unknown): string => {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
      const obj = v as { _id?: unknown; id?: unknown };
      return String(obj._id || obj.id || '');
    }
    return String(v);
  };

  const openInterview = useCallback((interview: ExistingInterview) => {
    const id = getInterviewId(interview);
    if (!id) return;
    const status = String(interview.status || '').toLowerCase();
    const conductedById = resolveConductedById(interview.conductedBy);
    if (status === 'in_progress' && conductedById && currentUserId && conductedById !== currentUserId) {
      Swal.fire({
        icon: 'warning',
        title: t('interviewLocked', 'interview'),
        text: t('interviewLockedDescription', 'interview'),
        confirmButtonColor: '#3085d6',
      });
      return;
    }
    initialLoadDoneRef.current = true;
    setSelectedInterviewId(id);
    const questions = Array.isArray(interview.questions) ? interview.questions : [];
    if (questions.length === 0) {
      setView('question-picker');
    } else {
      setView('assessment');
    }
  }, [currentUserId, t]);

  const goBack = useCallback(() => {
    if (scheduledInterviews.length > 1) {
      setSelectedInterviewId(null);
      setView('interview-picker');
    } else {
      setSelectedInterviewId(null);
      setView('selection');
    }
  }, [scheduledInterviews.length]);

  const updateField = useCallback(
    (questionId: string, patch: { percentage?: number; answer?: unknown; selectedTags?: string[] }) => {
      if (patch.percentage !== undefined) {
        setAchievedPercentages((prev) => ({ ...prev, [questionId]: patch.percentage! }));
      }
      if (patch.answer !== undefined) {
        setAnswers((prev) => ({ ...prev, [questionId]: patch.answer }));
      }
      if (patch.selectedTags !== undefined) {
        setSelectedTagsByQuestion((prev) => ({ ...prev, [questionId]: patch.selectedTags! }));
      }
    },
    []
  );

  const toggleGroup = useCallback((groupKey: string) => {
    setOpenGroups((prev) =>
      prev.includes(groupKey) ? prev.filter((k) => k !== groupKey) : [...prev, groupKey]
    );
  }, []);

  // Build the questions payload to send to the backend. Combines the
  // server-side question shape (id, score, choices, etc.) with the user's
  // local percentages/answers/notes.
  const buildQuestionsPayload = useCallback((): InterviewAnswer[] => {
    if (!selectedInterview) return [];
    return flatExistingQuestions
      .map((q) => {
        const qId = getQuestionId(q);
        if (!qId) return null;
        const score = Number(q?.score ?? 0);
        const percent = Number(achievedPercentages[qId] || 0);
        const achieved = Math.round((score * percent) / 100);
        const notesValue = answers[qId];
        const meta = groupMeta.meta[qId];
        return {
          _id: q?._id,
          id: q?.id,
          question: q?.question || '',
          score,
          achievedScore: achieved,
          notes:
            notesValue === undefined || notesValue === null
              ? ''
              : typeof notesValue === 'string'
              ? notesValue
              : Array.isArray(notesValue)
              ? JSON.stringify(notesValue)
              : String(notesValue),
          answerType: q?.answerType,
          choices: Array.isArray(q?.choices) ? q?.choices : [],
          tags: Array.isArray(selectedTagsByQuestion[qId])
            ? selectedTagsByQuestion[qId]
            : [],
          groupKey: meta?.key || q?.groupKey,
          groupName: meta?.name || q?.groupName,
          groupSource: (meta?.source || q?.groupSource) as 'company' | 'user' | undefined,
        } as InterviewAnswer;
      })
      .filter((item): item is InterviewAnswer => item !== null);
  }, [selectedInterview, flatExistingQuestions, achievedPercentages, answers, groupMeta.meta]);

  // ---- Grouping (display) ----------------------------------------------
  const groupedQuestions = useMemo<
    Array<{
      key: string;
      name: string;
      source: 'company' | 'user';
      questions: ExistingQuestion[];
    }>
  >(() => {
    if (flatExistingQuestions.length === 0) return [];
    const groups: Record<
      string,
      { name: string; source: 'company' | 'user'; questions: ExistingQuestion[] }
    > = {};
    const order: string[] = [];
    flatExistingQuestions.forEach((q) => {
      const qId = getQuestionId(q);
      const meta = (qId && groupMeta.meta[qId]) || null;
      const key = meta?.key || q?.groupKey || '__ungrouped__';
      if (!groups[key]) {
        groups[key] = {
          name: meta?.name || q?.groupName || 'Questions',
          source:
            (meta?.source as 'company' | 'user') ||
            (q?.groupSource as 'company' | 'user') ||
            'company',
          questions: [],
        };
        order.push(key);
      }
      groups[key].questions.push(q);
    });
    return order.map((k) => ({ key: k, ...groups[k] }));
  }, [flatExistingQuestions, groupMeta.meta]);

  // ---- Totals -----------------------------------------------------------
  const totals = useMemo(() => {
    const questions = buildQuestionsPayload();
    const totalScore = computeTotalScore(questions);
    const achieved = computeAchievedScore(questions);
    const answered = questions.filter((q) => Number(q.achievedScore) > 0 || q.notes).length;
    const completion = questions.length === 0 ? 0 : (answered / questions.length) * 100;
    const performance = totalScore > 0 ? (achieved / totalScore) * 100 : 0;
    return {
      totalScore,
      achieved,
      answered,
      total: questions.length,
      completion,
      performance,
    };
  }, [buildQuestionsPayload]);

  return {
    // data
    applicant: applicantData,
    allInterviews,
    scheduledInterviews,
    selectedInterview,
    flatExistingQuestions,
    groupedQuestions,
    questionPool,
    companyId,
    // state
    view,
    setView,
    openGroups,
    setOpenGroups,
    toggleGroup,
    achievedPercentages,
    answers,
    selectedTagsByQuestion,
    selectedInterviewId,
    setSelectedInterviewId,
    // meta
    groupMeta,
    // totals
    totals,
    // actions
    openInterview,
    goBack,
    updateField,
    buildQuestionsPayload,
  };
};

export type InterviewState = ReturnType<typeof useInterviewState>;
export type { PoolGroup };
