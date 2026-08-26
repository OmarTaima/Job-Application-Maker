import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocale } from '../../../../../context/LocaleContext';
import type {
  Interview,
  InterviewAnswer,
  InterviewQuestionsProps,
} from '../../../../../types/applicants';
import { applicantsKeys } from '../../../../../hooks/queries/useApplicants';
import { useInterviewActions } from './hooks/useInterviewActions';
import { useInterviewState } from './hooks/useInterviewState';
import { useInterviewTimer } from './hooks/useInterviewTimer';
import {
  useDeleteInterview,
  recordQuestionRemovals,
  recordQuestionAdditions,
} from '../../../../../hooks/queries';
import Swal from '../../../../../utils/swal';
import { getInterviewId } from './utils/interviewUtils';
import { AssessmentView } from './views/AssessmentView';
import type { NewCustomQuestion } from './views/AssessmentView';
import { InterviewPickerView } from './views/InterviewPickerView';
import { QuestionPickerView } from './views/QuestionPickerView';
import { SelectionView } from './views/SelectionView';
import type { PoolGroup } from './hooks/useQuestionPool';
import type { FieldSaveStatus } from './hooks/useInterviewActions';

const formatScheduledAt = (iso: string | undefined, locale: string, t?: (key: string, ns?: string, params?: Record<string, string | number>) => string): string => {
  if (!iso) return t ? t('unscheduledTime', 'interview') : 'an unscheduled time';
  try {
    return new Date(iso).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return t ? t('unscheduledTime', 'interview') : 'an unscheduled time';
  }
};

const InterviewQuestions = ({
  applicantId = '',
  onRequestScheduleInterview,
  onRequestStartInterview,
  autoSelectInterviewId = null,
  applicantData,
  authUser,
}: InterviewQuestionsProps) => {
  const queryClient = useQueryClient();
  const { t, locale } = useLocale();
  const currentUserId = authUser?._id || authUser?.id || '';
  const state = useInterviewState(applicantId, autoSelectInterviewId, applicantData ?? undefined, currentUserId);
  const deleteInterview = useDeleteInterview();
  const actions = useInterviewActions({
    applicantId,
    interview: state.selectedInterview,
    currentUserId: currentUserId || undefined,
      onQuestionsPersisted: (saved, built) => {
        // Seed group meta from the built questions (which carry groupKey)
        // paired by index with the server response (which has the real IDs).
        // Without this, after refresh the server returns no groupKey and
        // groupMeta has no mapping, collapsing questions into __ungrouped__.
        if (saved && saved.length > 0 && built && built.length > 0) {
          state.groupMeta.seedFromSaved(built, saved);
        }
      },
  });

  // Timer (ticks when in-progress)
  const { elapsedMs } = useInterviewTimer(state.selectedInterview);

  // Picker local state
  const [pickerSelectedKeys, setPickerSelectedKeys] = useState<string[]>([]);
  const [pendingAddGroups, setPendingAddGroups] = useState<string[]>([]);
  const [newCustomQuestions, setNewCustomQuestions] = useState<NewCustomQuestion[]>([]);
  const [pendingRemoveIds, setPendingRemoveIds] = useState<string[]>([]);
  const [pendingRemoveGroups, setPendingRemoveGroups] = useState<string[]>([]);
  const saveInFlightRef = useRef(false);
  const pendingGenRef = useRef(0);
  const syncedRemoveGenRef = useRef(0);
  const saveQuestionInFlightRef = useRef(false);
  const [saveStatusByQuestion, setSaveStatusByQuestion] = useState<Record<string, FieldSaveStatus>>({});
  const autoSaveTimersRef = useRef<Record<string, number>>({});
  const autoSaveResetRef = useRef<number | null>(null);
  const pendingAutoSaveRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const scheduleSaveStatusReset = useCallback(() => {
    if (autoSaveResetRef.current !== null) window.clearTimeout(autoSaveResetRef.current);
    autoSaveResetRef.current = window.setTimeout(() => {
      autoSaveResetRef.current = null;
      setSaveStatusByQuestion((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((id) => {
          if (next[id] === 'saved' || next[id] === 'error') delete next[id];
        });
        return next;
      });
    }, 3000);
  }, []);

  const runAutoSave = useCallback(async () => {
    if (saveQuestionInFlightRef.current) {
      pendingAutoSaveRef.current = true;
      return;
    }
    saveQuestionInFlightRef.current = true;
    let ok = false;
    try {
      ok = await actionsRef.current.saveQuestion(stateRef.current.buildQuestionsPayload());
    } catch {
      ok = false;
    } finally {
      saveQuestionInFlightRef.current = false;
    }
    setSaveStatusByQuestion((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        if (next[id] === 'saving') next[id] = ok ? 'saved' : 'error';
      });
      return next;
    });
    scheduleSaveStatusReset();
    if (pendingAutoSaveRef.current) {
      pendingAutoSaveRef.current = false;
      runAutoSave();
    }
  }, [scheduleSaveStatusReset]);

  useEffect(() => {
    return () => {
      Object.values(autoSaveTimersRef.current).forEach((id) => window.clearTimeout(id));
      autoSaveTimersRef.current = {};
      if (autoSaveResetRef.current !== null) window.clearTimeout(autoSaveResetRef.current);
    };
  }, []);

  useEffect(() => {
    setSaveStatusByQuestion({});
  }, [state.selectedInterviewId]);


  // When entering the question picker, pre-select the currently attached
  // groups so the user can confirm their existing setup.
  useEffect(() => {
    if (state.view !== 'question-picker') return;
    const attached = state.flatExistingQuestions
      .map((q) => {
        const qId = getInterviewId({ _id: q.id || q._id } as Interview);
        const meta = (qId && state.groupMeta.meta[qId]) || null;
        return meta?.key || q?.groupKey;
      })
      .filter((k): k is string => Boolean(k));
    setPickerSelectedKeys(Array.from(new Set(attached)));
  }, [state.view, state.flatExistingQuestions, state.groupMeta.meta]);

  // ---- Derived flags ---------------------------------------------------
  const selectedInterview = state.selectedInterview;
  const isStarted = Boolean(selectedInterview?.startedAt);
  const isEnded = Boolean(selectedInterview?.endedAt);
  const isInteractive = isStarted && !isEnded;
  const canStart = Boolean(selectedInterview) && !isStarted && !isEnded;
  const canEnd = Boolean(selectedInterview) && isStarted && !isEnded;
  const canSaveProgress = isInteractive;

  // ---- Pool grouping ---------------------------------------------------
  const attachedGroupKeys = useMemo(() => {
    const set = new Set<string>();
    state.flatExistingQuestions.forEach((q) => {
      const qId = String(q?.id || q?._id || '');
      const meta = (qId && state.groupMeta.meta[qId]) || null;
      const key = meta?.key || q?.groupKey;
      if (key) set.add(key);
    });
    return set;
  }, [state.flatExistingQuestions, state.groupMeta.meta]);

  const availableGroups: PoolGroup[] = useMemo(() => {
    return state.questionPool.filter(
      (g) => !attachedGroupKeys.has(g.key) || pendingRemoveGroups.includes(g.key)
    );
  }, [state.questionPool, attachedGroupKeys, pendingRemoveGroups]);

  // ---- Question payload builders --------------------------------------
  const buildQuestionsFromGroups = useCallback(
    (keys: string[]): InterviewAnswer[] => {
      const out: InterviewAnswer[] = [];
      keys.forEach((key) => {
        const group = state.questionPool.find((g) => g.key === key);
        if (!group) return;
        group.questions.forEach((q) => {
          out.push({
            _id: q._id,
            id: q.id,
            question: q.question,
            score: q.score,
            achievedScore: 0,
            notes: '',
            answerType: q.answerType,
            choices: q.choices,
            tags: q.tags,
            groupKey: group.key,
            groupName: group.name,
            groupSource: group.source,
          });
        });
      });
      return out;
    },
    [state.questionPool]
  );

  const buildUpdatedQuestions = useCallback((): InterviewAnswer[] => {
    const deletedSet = new Set(pendingRemoveIds);
    const removedGroupsSet = new Set(pendingRemoveGroups);
    // Filter out deleted existing questions and questions in removed groups
    const existing = state.flatExistingQuestions.filter((q) => {
      const qId = String(q?.id || q?._id || '');
      if (deletedSet.has(qId)) return false;
      const meta = (qId && state.groupMeta.meta[qId]) || null;
    const gKey = meta?.key || q?.groupKey || '__ungrouped__';
    if (removedGroupsSet.has(gKey)) return false;
      return true;
    });
    // Add questions from pending groups
    pendingAddGroups.forEach((key) => {
      const group = state.questionPool.find((g) => g.key === key);
      if (!group) return;
      group.questions.forEach((q) => {
        existing.push({
          _id: q._id,
          id: q.id,
          question: q.question,
          score: q.score,
          achievedScore: 0,
          notes: '',
          answerType: q.answerType,
          choices: q.choices,
          tags: q.tags,
          groupKey: group.key,
          groupName: group.name,
          groupSource: group.source,
        });
      });
    });
    // Add new custom questions — no group, they render as standalone rows
    if (newCustomQuestions.length > 0) {
      const customPrefix = `free_${Date.now()}`;
      newCustomQuestions.forEach((q, idx) => {
        const renderId = `new_custom_${idx}`;
        const percent = Number(state.achievedPercentages[renderId] || 0);
        const achieved = Math.round((q.score * percent) / 100);
        const notesValue = state.answers[renderId];
        const notes =
          notesValue === undefined || notesValue === null
            ? ''
            : typeof notesValue === 'string'
            ? notesValue
            : String(notesValue);
        existing.push({
          id: `${customPrefix}_${idx}`,
          question: q.question,
          score: q.score,
          achievedScore: achieved,
          notes,
          answerType: q.answerType,
          choices: q.choices,
          groupKey: '__free__',
        });
      });
    }
    return existing;
  }, [state.flatExistingQuestions, state.questionPool, state.achievedPercentages, state.answers, state.groupMeta.meta, pendingAddGroups, newCustomQuestions, pendingRemoveIds, pendingRemoveGroups]);

  // ---- Handlers --------------------------------------------------------
  const togglePickerKey = useCallback((key: string) => {
    setPickerSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const handleAddGroup = useCallback((key: string) => {
    pendingGenRef.current++;
    setPendingAddGroups((prev) => [...prev, key]);
    setPendingRemoveGroups((prev) => prev.filter((k) => k !== key));
    // Clear answers/percentages for questions in the re-added group
    state.flatExistingQuestions.forEach((q) => {
      const qId = String(q?.id || q?._id || '');
      const meta = (qId && state.groupMeta.meta[qId]) || null;
      const gKey = meta?.key || q?.groupKey;
      if (gKey === key && qId) {
        state.updateField(qId, { percentage: 0, answer: '' });
      }
    });
  }, [state.flatExistingQuestions, state.groupMeta.meta, state.updateField]);

  const handleCreateQuestion = useCallback((q: NewCustomQuestion) => {
    pendingGenRef.current++;
    setNewCustomQuestions((prev) => [...prev, q]);
  }, []);

  const handleRemoveGroup = useCallback((groupKey: string) => {
    pendingGenRef.current++;
    setPendingAddGroups((prev) => prev.filter((k) => k !== groupKey));
    setPendingRemoveGroups((prev) =>
      prev.includes(groupKey) ? prev : [...prev, groupKey]
    );
  }, []);

  const handleDeleteQuestion = useCallback((questionId: string) => {
    pendingGenRef.current++;
    // Check if it's a custom pending question
    const customIdx = newCustomQuestions.findIndex(
      (_, i) => `new_custom_${i}` === questionId
    );
    if (customIdx !== -1) {
      setNewCustomQuestions((prev) => prev.filter((_, i) => i !== customIdx));
    } else {
      setPendingRemoveIds((prev) => [...prev, questionId]);
    }
  }, [newCustomQuestions]);

  const triggerBackgroundSave = useCallback(async () => {
    if (!state.selectedInterview) return;
    if (saveInFlightRef.current) return;
    const gen = pendingGenRef.current;
    const hasPending =
      pendingAddGroups.length > 0 ||
      pendingRemoveGroups.length > 0 ||
      pendingRemoveIds.length > 0 ||
      newCustomQuestions.length > 0;
    if (!hasPending) return;
    const updated = buildUpdatedQuestions();
    // Register structural intent BEFORE saving: any background refetch that
    // lands while the backend read still lags the write gets reconciled in
    // the query layer, so deleted groups/questions never visibly return and
    // added ones never visibly vanish.
    const interviewIdForIntent = getInterviewId(state.selectedInterview as Interview);
    if (applicantId && interviewIdForIntent) {
      const prevIds = new Set<string>(
        state.flatExistingQuestions
          .map((q) => String(q?.id || q?._id || ''))
          .filter(Boolean),
      );
      const removedIds: string[] = [];
      const addedQuestions: InterviewAnswer[] = [];
      const nextIds = new Set<string>();
      updated.forEach((q) => {
        const id = String(q?.id || q?._id || '');
        if (!id) return;
        nextIds.add(id);
        if (!prevIds.has(id)) addedQuestions.push(q);
      });
      prevIds.forEach((id) => {
        if (!nextIds.has(id)) removedIds.push(id);
      });
      if (removedIds.length > 0) {
        recordQuestionRemovals(applicantId, interviewIdForIntent, removedIds);
      }
      if (addedQuestions.length > 0) {
        recordQuestionAdditions(applicantId, interviewIdForIntent, addedQuestions);
      }
    }
    let cleared = false;
    void cleared;
    saveInFlightRef.current = true;
    try {
      const ok = await actions.savePickedGroups(updated, false, true);
      if (ok && gen === pendingGenRef.current) {
        syncedRemoveGenRef.current = pendingGenRef.current;
        setPendingAddGroups([]);
        setNewCustomQuestions([]);
        setPendingRemoveGroups([]);
        setPendingRemoveIds([]);
        cleared = true;
      }
    } catch {
      // silent background failure
    } finally {
      saveInFlightRef.current = false;
    }
  }, [state, buildUpdatedQuestions, pendingAddGroups, pendingRemoveGroups, pendingRemoveIds, newCustomQuestions, actions]);

  const registerPickerIntent = useCallback((built: InterviewAnswer[]) => {
    if (!state.selectedInterview || !applicantId) return;
    const interviewIdForIntent = getInterviewId(state.selectedInterview as Interview);
    if (!interviewIdForIntent || built.length === 0) return;
    recordQuestionAdditions(applicantId, interviewIdForIntent, built);
  }, [state.selectedInterview, applicantId]);

  const handleSaveQuestions = useCallback(async () => {
    if (!state.selectedInterview) return;
    const built = buildQuestionsFromGroups(pickerSelectedKeys);
    if (built.length === 0) return;
    registerPickerIntent(built);
    const ok = await actions.savePickedGroups(built, false);
    if (ok) {
      setPickerSelectedKeys([]);
      state.setView('assessment');
    }
  }, [state, pickerSelectedKeys, buildQuestionsFromGroups, actions, registerPickerIntent]);

  const handleSaveAndStart = useCallback(async () => {
    if (!state.selectedInterview) return;
    const built = buildQuestionsFromGroups(pickerSelectedKeys);
    if (built.length === 0) return;
    registerPickerIntent(built);
    const ok = await actions.savePickedGroups(built, true);
    if (ok) {
      setPickerSelectedKeys([]);
      state.setView('assessment');
      state.setOpenGroups(Array.from(new Set(built.map((q) => q.groupKey).filter(Boolean) as string[])));
    }
  }, [state, pickerSelectedKeys, buildQuestionsFromGroups, actions]);

  // Double-fire guards: prevent the mutation from being kicked off twice
  // when the button is clicked rapidly or React batches the event.
  const startInFlightRef = useRef(false);
  const endInFlightRef = useRef(false);

  const handleStart = useCallback(async () => {
    const interview = state.selectedInterview;
    if (!interview) return;
    if (interview.startedAt) return;
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;

    await actions.startInterview();
    startInFlightRef.current = false;
  }, [state.selectedInterview, actions]);

  const handleEnd = useCallback(async () => {
    if (!state.selectedInterview) return;
    if (endInFlightRef.current) return;
    endInFlightRef.current = true;
    Object.values(autoSaveTimersRef.current).forEach((id) => window.clearTimeout(id));
    autoSaveTimersRef.current = {};
    pendingAutoSaveRef.current = false;
    const finalQuestions = state.buildQuestionsPayload();
    actions.clearDebounce();
    try {
      const ok = await actions.endInterview(finalQuestions);
      if (ok && applicantId) {
        queryClient.invalidateQueries({ queryKey: applicantsKeys.detail(applicantId) });
      }
    } finally {
      endInFlightRef.current = false;
    }
  }, [state, actions, applicantId, queryClient]);

  const handleSaveProgress = useCallback(async () => {
    if (!state.selectedInterview) return;
    if (saveQuestionInFlightRef.current) return;
    saveQuestionInFlightRef.current = true;
    const finalQuestions = state.buildQuestionsPayload();
    actions.clearDebounce();
    try {
      await actions.saveQuestion(finalQuestions);
    } finally {
      saveQuestionInFlightRef.current = false;
    }
  }, [state, actions]);

  const handleDeleteInterview = useCallback(
    async (interview: Interview) => {
      if (!applicantId) return;
      const id = getInterviewId(interview);
      if (!id) return;
      const result = await Swal.fire({
        title: t('deleteInterviewTitle', 'interview'),
        text: t('deleteInterviewDescription', 'interview'),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        confirmButtonText: t('deleteConfirm', 'interview'),
        cancelButtonText: t('cancel', 'common'),
      });
      if (!result.isConfirmed) return;
      try {
        await deleteInterview.mutateAsync({ applicantId, interviewId: id });
        state.setSelectedInterviewId(null);
        state.setView('selection');
      } catch {
        // toast handled by mutation
      }
    },
    [applicantId, deleteInterview, state, t],
  );

  const handleQuestionChange = useCallback(
    (questionId: string, patch: { percentage?: number; answer?: unknown; selectedTags?: string[] }) => {
      state.updateField(questionId, patch);
      if (!questionId) return;
      setSaveStatusByQuestion((prev) => ({ ...prev, [questionId]: 'saving' }));
      const existing = autoSaveTimersRef.current[questionId];
      if (existing) window.clearTimeout(existing);
      autoSaveTimersRef.current[questionId] = window.setTimeout(() => {
        delete autoSaveTimersRef.current[questionId];
        runAutoSave();
      }, 1000);
    },
    [state, runAutoSave]
  );

  // ---- Background auto-save --------------------------------------------
  const triggerSaveRef = useRef(triggerBackgroundSave);
  triggerSaveRef.current = triggerBackgroundSave;
  useEffect(() => {
    const hasUnsyncedRemovals = syncedRemoveGenRef.current !== pendingGenRef.current;
    const hasPendingAdd =
      pendingAddGroups.length > 0 || newCustomQuestions.length > 0;
    if ((!hasPendingAdd && !hasUnsyncedRemovals) || isEnded) return;
    triggerSaveRef.current();
  }, [pendingAddGroups, pendingRemoveGroups, pendingRemoveIds, newCustomQuestions, isEnded]);

  // ---- Render ----------------------------------------------------------
  if (state.view === 'selection') {
    return (
      <SelectionView
        hasExistingInterview={state.scheduledInterviews.length > 0}
        interviewCount={state.scheduledInterviews.length}
        onSchedule={() => onRequestScheduleInterview?.()}
        onStart={() => { onRequestStartInterview?.(); }}
        onUseExisting={() => {
          if (state.scheduledInterviews.length === 1) {
            state.openInterview(state.scheduledInterviews[0]);
          } else {
            state.setView('interview-picker');
          }
        }}
        authUser={authUser}
      />
    );
  }

  if (state.view === 'interview-picker') {
    return (
      <InterviewPickerView
        interviews={state.scheduledInterviews as Interview[]}
        onBack={() => state.setView('selection')}
        onPick={(iv) => state.openInterview(iv)}
        onDelete={handleDeleteInterview}
        authUser={authUser}
      />
    );
  }

  if (state.view === 'question-picker' && state.selectedInterview) {
    return (
      <QuestionPickerView
        pool={state.questionPool}
        isLoading={state.questionPool.length === 0}
        selectedKeys={pickerSelectedKeys}
        onToggle={togglePickerKey}
        onBack={() => {
          // Always go to the interview picker if there are multiple
          // interviews, otherwise back to selection.
          if (state.scheduledInterviews.length > 1) {
            state.setView('interview-picker');
          } else {
            state.setView('selection');
          }
        }}
        onSaveOnly={handleSaveQuestions}
        onSaveAndStart={handleSaveAndStart}
        isSaving={actions.isPickerSaving || actions.isMutating}
        scheduledAtLabel={formatScheduledAt(state.selectedInterview.scheduledAt, locale, t)}
      />
    );
  }

  if (state.view === 'assessment' && state.selectedInterview) {
    return (
      <AssessmentView
        interview={state.selectedInterview}
        groupedQuestions={state.groupedQuestions}
        openGroups={state.openGroups}
        percentages={state.achievedPercentages}
        answers={state.answers}
        selectedTags={state.selectedTagsByQuestion}
        totals={state.totals}
        elapsedMs={elapsedMs}
        isInteractive={isInteractive}
        isStarted={isStarted}
        isEnded={isEnded}
        saveStatusByQuestion={saveStatusByQuestion}
        fieldSaveStatus={actions.fieldSaveStatus}
        isMutating={actions.isMutating}
        canStart={canStart}
        canEnd={canEnd}
        canSaveProgress={canSaveProgress}
        availableGroups={availableGroups}
        pendingAddGroups={pendingAddGroups}
        pendingRemoveIds={pendingRemoveIds}
        newCustomQuestions={newCustomQuestions}
        onAddGroup={handleAddGroup}
        onCreateQuestion={handleCreateQuestion}
        onDeleteQuestion={handleDeleteQuestion}
        onRemoveGroup={handleRemoveGroup}
        pendingRemoveGroups={pendingRemoveGroups}
        onBack={() => {
          if (state.scheduledInterviews.length > 1) {
            state.setSelectedInterviewId(null);
            state.setView('interview-picker');
          } else {
            state.setSelectedInterviewId(null);
            state.setView('selection');
          }
        }}
        onStart={handleStart}
        onEnd={handleEnd}
        onSaveProgress={handleSaveProgress}
        onToggleGroup={state.toggleGroup}
        onQuestionChange={handleQuestionChange}
        authUser={authUser}
      />
    );
  }

  // Fallback: selection view
  return (
    <SelectionView
      hasExistingInterview={state.scheduledInterviews.length > 0}
      interviewCount={state.scheduledInterviews.length}
      onSchedule={() => onRequestScheduleInterview?.()}
      onStart={() => { onRequestStartInterview?.(); }}
      onUseExisting={() => {
        if (state.scheduledInterviews.length === 1) {
          state.openInterview(state.scheduledInterviews[0]);
        } else {
          state.setView('interview-picker');
        }
      }}
    />
  );
};

export default InterviewQuestions;
