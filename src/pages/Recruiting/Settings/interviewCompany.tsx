import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  ClipboardList,
  PlusCircle,
  Save,
  Trash2,
  ArrowRight,
  ShieldCheck,
  CircleCheckBig,
  Settings,
  Mail,
  Layout,
  FileText,
  ChevronDown,
  ChevronRight,
  GripVertical,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createPortal } from 'react-dom';
import { useCompanyFilter } from '../../../context/CompanyFilterContext';
import Swal from '../../../utils/swal';
import PageMeta from '../../../components/common/PageMeta';
import PageBreadCrumb from '../../../components/common/PageBreadCrumb';
import { useAuth } from '../../../context/AuthContext';
import { useLocale } from '../../../context/LocaleContext';
import {
  useCompanies,
  useCompanyInterviewSettings,
  useUpdateCompanyInterviewSettings,
  companiesKeys,
} from '../../../hooks/queries/useCompanies';
import RejectionTab from './Rejectiontab';
import StatusSettings from './StatusSettings';
import EmailTemplates from './MailTemplate';
import type {
  InterviewAnswerType,
  InterviewGroup,
  InterviewQuestion,
  ChoiceItem,
} from '../../../services/companiesService';
import { normalizeChoices, normalizeChoicesToServer } from '../../../services/companiesService';
import ApplicantPagesSettings from './ApplicantsPagesTab';
import JobOffersTab from './JobOffersTab';
import ContractsTab from './ContractsTab';

type QuestionItem = InterviewQuestion & { _id: string };

const uid = () => `q_${Math.random().toString(36).slice(2, 9)}`;

type CompanyShape = {
  _id: string;
  name?: string | { en?: string; ar?: string };
  interviewSettings?: {
    groups?: InterviewGroup[];
  };
  settings?: {
    _id?: string;
    company?: string;
    interviewSettings?: {
      groups?: InterviewGroup[];
    };
  };
};

const ANSWER_TYPES: InterviewAnswerType[] = [
  'text',
  'number',
  'radio',
  'checkbox',
  'dropdown',
  'tags',
];

const EMPTY_QUESTION: QuestionItem = {
  _id: uid(),
  question: '',
  score: 0,
  answerType: 'text',
  tags: [],
};

const choicePct = (choiceScore: number, questionScore: number) =>
  questionScore > 0 ? Math.round((choiceScore / questionScore) * 100) : 0;

const autoFixChoiceScores = (question: any): ChoiceItem[] => {
  const choices = Array.isArray(question?.choices)
    ? (question.choices as ChoiceItem[])
    : [];
  const questionScore = Number(question?.score) || 0;

  if (question?.answerType === 'checkbox' && questionScore > 0) {
    const sum = choices.reduce((s, c) => s + (Number(c.score) || 0), 0);
    if (sum > questionScore) {
      const scale = questionScore / sum;
      const fixed = choices.map((c) => ({
        ...c,
        score: Math.round((Number(c.score) || 0) * scale),
      }));
      const fixedSum = fixed.reduce((s, c) => s + (Number(c.score) || 0), 0);
      const diff = questionScore - fixedSum;
      if (fixed.length > 0) {
        const last = fixed[fixed.length - 1];
        fixed[fixed.length - 1] = {
          ...last,
          score: Math.max(0, (Number(last.score) || 0) + diff),
        };
      }
      return fixed;
    }
    return choices;
  }

  if (question?.answerType === 'dropdown' && questionScore > 0) {
    return choices.map((c) => {
      const score = Number(c.score) || 0;
      return score > questionScore ? { ...c, score: questionScore } : c;
    });
  }

  return choices;
};

const normalizeQuestion = (
  question: Partial<InterviewQuestion & { _id?: string }> | undefined
): QuestionItem => {
  const answerType =
    question?.answerType && ANSWER_TYPES.includes(question.answerType)
      ? question.answerType
      : 'text';

  const score = Number(question?.score);
  return {
    _id: question?._id ?? uid(),
    question: String(question?.question ?? ''),
    score: Number.isFinite(score) ? score : 0,
    answerType,
    choices: normalizeChoices((question as any)?.choices),
    tags: Array.isArray((question as any)?.tags)
      ? ((question as any).tags as any[]).map((tag) => String(tag ?? '')).filter(Boolean)
      : [],
  };
};

const normalizeGroups = (
  groups: InterviewGroup[] | undefined | null
): InterviewGroup[] => {
  if (!Array.isArray(groups)) return [];

  return groups.map((group) => ({
    name: String(group?.name ?? ''),
    questions: Array.isArray(group?.questions)
      ? group.questions.map((question: any) => normalizeQuestion(question))
      : [],
  }));
};

const getCompanyName = (company: CompanyShape | undefined, locale?: string): string => {
  if (!company) return '';
  const companyData = (company as any)?.companyId || company;
  if (typeof companyData.name === 'string') return companyData.name;
  if (locale === 'ar') return companyData.name?.ar || companyData.name?.en || '';
  return companyData.name?.en || companyData.name?.ar || '';
};

function SortableQuestionItem({
  question,
  canEdit,
  onUpdate,
  onRemove,
}: {
  question: any;
  questionIndex: number;
  groupIndex: number;
  canEdit: boolean;
  onUpdate: (patch: Partial<InterviewQuestion>) => void;
  onRemove: () => void;
}) {
  const { t } = useLocale();
  const [scoreStr, setScoreStr] = useState(() => String(question.score ?? 0));
  useEffect(() => {
    setScoreStr(String(question.score ?? 0));
  }, [question.score]);
  const [addChoiceLabel, setAddChoiceLabel] = useState('');
  const [addChoiceScore, setAddChoiceScore] = useState('');
  const [tagInput, setTagInput] = useState('');

  const handleAddTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    const existing = Array.isArray(question.tags) ? question.tags : [];
    if (!existing.includes(value)) {
      onUpdate({ tags: [...existing, value] });
    }
    setTagInput('');
  };

  const handleAddChoice = () => {
    const label = addChoiceLabel.trim();
    if (!label) return;
    const existing = Array.isArray(question.choices) ? question.choices : [];
    const pct = addChoiceScore === '' ? 0 : Number(addChoiceScore);
    const score = Math.round((pct / 100) * (Number(question.score) || 0));
    onUpdate({ choices: [...existing, { label, score: Number.isFinite(score) ? score : 0 }] });
    setAddChoiceLabel('');
    setAddChoiceScore('');
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ id: question._id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-1 gap-3 rounded-lg border p-3 lg:grid-cols-[auto_1fr_150px_130px_auto] ${
        isDragging
          ? 'border-brand-400 bg-white shadow-lg ring-2 ring-brand-500 dark:bg-slate-800'
          : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60'
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="flex cursor-grab items-center justify-center rounded p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 active:cursor-grabbing dark:hover:bg-slate-700 dark:hover:text-slate-300"
      >
        <GripVertical className="size-4" />
      </div>

      <div>

        <input
          value={question.question}
          onChange={(e) => onUpdate({ question: e.target.value })}
          disabled={!canEdit}
          placeholder={t('interviewCompany.questionPlaceholder', 'settings')}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900"
        />
      </div>

      <div>

        <select
          value={question.answerType}
          onChange={(e) => onUpdate({ answerType: e.target.value as InterviewAnswerType })}
          disabled={!canEdit}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900"
        >
          {ANSWER_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div>
  
        <input
          type="text"
          inputMode="numeric"
          value={scoreStr}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              setScoreStr('');
              return;
            }
            const num = Number(raw);
            if (Number.isFinite(num)) {
              setScoreStr(raw);
              onUpdate({ score: num });
            }
          }}
          onBlur={() => {
            if (scoreStr === '') {
              setScoreStr('0');
              onUpdate({ score: 0 });
            }
          }}
          disabled={!canEdit}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900"
        />
      </div>

      <div className="flex items-end">
        <button
          type="button"
          onClick={onRemove}
          disabled={!canEdit}
          className="inline-flex h-10 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {(question.answerType === 'radio' || question.answerType === 'dropdown' || question.answerType === 'checkbox') && (
        <div className="lg:col-span-5">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('interviewCompany.labelChoices', 'settings')}
          </label>
          <div className="space-y-2">
            {(Array.isArray(question.choices) ? question.choices : []).map((c: ChoiceItem, i: number) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                <input
                  type="text"
                  value={c.label}
                  onChange={(e) => {
                    const updated = [...(Array.isArray(question.choices) ? question.choices : [])];
                    updated[i] = { ...updated[i], label: e.target.value };
                    onUpdate({ choices: updated });
                  }}
                  disabled={!canEdit}
                  className="min-w-0 flex-1 truncate rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm text-slate-800 outline-none transition-colors hover:border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-70 dark:text-slate-200 dark:hover:border-slate-600"
                />
                <span className="w-10 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {choicePct(Number(c.score) || 0, Number(question.score) || 0)}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={choicePct(Number(c.score) || 0, Number(question.score) || 0)}
                  onChange={(e) => {
                    const pct = Number(e.target.value);
                    const updated = [...(Array.isArray(question.choices) ? question.choices : [])];
                    updated[i] = { ...updated[i], score: Math.round((pct / 100) * (Number(question.score) || 0)) };
                    onUpdate({ choices: updated });
                  }}
                  disabled={!canEdit}
                  className="w-24 accent-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => {
                    const existing = Array.isArray(question.choices) ? question.choices : [];
                    onUpdate({ choices: existing.filter((_: ChoiceItem, idx: number) => idx !== i) });
                  }}
                  disabled={!canEdit}
                  className="cursor-pointer p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"
                  aria-label={t('interviewCompany.removeChoice', 'settings', { value: c.label })}
                >
                  <svg className="fill-current" width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M3.40717 4.46881C3.11428 4.17591 3.11428 3.70104 3.40717 3.40815C3.70006 3.11525 4.17494 3.11525 4.46783 3.40815L6.99943 5.93975L9.53095 3.40822C9.82385 3.11533 10.2987 3.11533 10.5916 3.40822C10.8845 3.70112 10.8845 4.17599 10.5916 4.46888L8.06009 7.00041L10.5916 9.53193C10.8845 9.82482 10.8845 10.2997 10.5916 10.5926C10.2987 10.8855 9.82385 10.8855 9.53095 10.5926L6.99943 8.06107L4.46783 10.5927C4.17494 10.8856 3.70006 10.8856 3.40717 10.5927C3.11428 10.2998 3.11428 9.8249 3.40717 9.53201L5.93877 7.00041L3.40717 4.46881Z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={addChoiceLabel}
              onChange={(e) => setAddChoiceLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddChoice();
                }
              }}
              disabled={!canEdit}
              placeholder={t('interviewCompany.choicesPlaceholder', 'settings')}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900"
            />
            <span className="w-10 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">
              {addChoiceScore === '' ? 0 : Number(addChoiceScore)}%
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={addChoiceScore === '' ? 0 : Number(addChoiceScore)}
              onChange={(e) => setAddChoiceScore(e.target.value)}
              disabled={!canEdit}
              className="w-24 accent-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
      )}

      <div className="lg:col-span-5">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t('interviewCompany.labelTags', 'settings')}
        </label>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
          {(Array.isArray(question.tags) ? question.tags : []).map((tag: string, i: number) => (
            <span
              key={`${tag}_${i}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
            >
              {tag}
              <button
                type="button"
                onClick={() => {
                  const existing = Array.isArray(question.tags) ? question.tags : [];
                  onUpdate({ tags: existing.filter((_: string, idx: number) => idx !== i) });
                }}
                disabled={!canEdit}
                className="cursor-pointer text-brand-500 hover:text-red-500 disabled:opacity-50"
                aria-label={t('interviewCompany.removeTag', 'settings', { value: tag })}
              >
                <svg className="fill-current" width="12" height="12" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M3.40717 4.46881C3.11428 4.17591 3.11428 3.70104 3.40717 3.40815C3.70006 3.11525 4.17494 3.11525 4.46783 3.40815L6.99943 5.93975L9.53095 3.40822C9.82385 3.11533 10.2987 3.11533 10.5916 3.40822C10.8845 3.70112 10.8845 4.17599 10.5916 4.46888L8.06009 7.00041L10.5916 9.53193C10.8845 9.82482 10.8845 10.2997 10.5916 10.5926C10.2987 10.8855 9.82385 10.8855 9.53095 10.5926L6.99943 8.06107L4.46783 10.5927C4.17494 10.8856 3.70006 10.8856 3.40717 10.5927C3.11428 10.2998 3.11428 9.8249 3.40717 9.53201L5.93877 7.00041L3.40717 4.46881Z" />
                </svg>
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            onBlur={handleAddTag}
            disabled={!canEdit}
            placeholder={t('interviewCompany.tagsPlaceholder', 'settings')}
            className="min-w-32 flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-70"
          />
        </div>
      </div>
    </div>
  );
}

function SortableGroupItem({
  group,
  groupIndex,
  canEdit,
  collapsedGroupIds,
  onToggleCollapse,
  onUpdateGroupName,
  onRemoveGroup,
  onAddQuestion,
  onUpdateQuestion,
  onRemoveQuestion,
  activeQuestionId,
  onQuestionDragStart,
  onQuestionDragEnd,
  onQuestionDragCancel,
  sensors,
  dropAnimation,
  t,
  isFlashing,
  onFlashDismiss,
}: {
  group: any;
  groupIndex: number;
  canEdit: boolean;
  collapsedGroupIds: Set<string>;
  onToggleCollapse: () => void;
  onUpdateGroupName: (name: string) => void;
  onRemoveGroup: () => void;
  onAddQuestion: () => void;
  onUpdateQuestion: (questionIndex: number, patch: Partial<InterviewQuestion>) => void;
  onRemoveQuestion: (questionIndex: number) => void;
  activeQuestionId: string | null;
  onQuestionDragStart: (event: DragStartEvent) => void;
  onQuestionDragEnd: (event: DragEndEvent) => void;
  onQuestionDragCancel: () => void;
  sensors: any;
  dropAnimation: any;
  t: (key: string, ...args: any[]) => string;
  isFlashing: boolean;
  onFlashDismiss: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ id: group._id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
    opacity: isDragging ? 0.4 : 1,
  };

  const isCollapsed = collapsedGroupIds.has(group._id);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const updateHeight = () => setContentHeight(el.scrollHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => {
        if (isFlashing) onFlashDismiss();
      }}
      className={`rounded-xl border ${
        isDragging
          ? 'border-brand-400 bg-white shadow-lg ring-2 ring-brand-500 dark:bg-slate-800'
          : 'border-slate-200 dark:border-slate-700'
      } ${isCollapsed ? 'overflow-hidden' : ''} ${
        isFlashing ? 'animate-flash-group' : ''
      }`}
    >
      <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
        <div
          {...attributes}
          {...listeners}
          className="flex cursor-grab items-center justify-center rounded p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 active:cursor-grabbing dark:hover:bg-slate-700 dark:hover:text-slate-300"
        >
          <GripVertical className="size-4" />
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex w-full items-center gap-3 text-left"
        >
          {isCollapsed ? (
            <ChevronRight className="size-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-slate-400" />
          )}
          <div className="min-w-0 flex-1">

            <input
              value={group.name}
              onChange={(e) => onUpdateGroupName(e.target.value)}
              disabled={!canEdit}
              placeholder={t('interviewCompany.groupNamePlaceholder', 'settings')}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <span className="shrink-0 text-xs text-slate-400">
            {t('interviewCompany.questionCount', 'settings', { count: group.questions.length })}
          </span>
        </button>
        <button
          type="button"
          onClick={onRemoveGroup}
          disabled={!canEdit}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
        >
          <Trash2 className="size-4" /> {t('interviewCompany.remove', 'settings')}
        </button>
      </div>

      <div
        style={{
          maxHeight: isCollapsed ? 0 : contentHeight,
          opacity: isCollapsed ? 0 : 1,
          overflow: isCollapsed ? 'hidden' : 'visible',
          transition: 'max-height 0.3s cubic-bezier(0.2, 0, 0, 1), opacity 0.25s cubic-bezier(0.2, 0, 0, 1)',
        }}
      >
        <div ref={contentRef} className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-700">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onQuestionDragStart}
            onDragEnd={onQuestionDragEnd}
            onDragCancel={onQuestionDragCancel}
          >
            <SortableContext
              items={group.questions.map((q: any) => q._id)}
              strategy={verticalListSortingStrategy}
            >
              {group.questions.map((question: any, questionIndex: number) => (
                <SortableQuestionItem
                  key={question._id}
                  question={question}
                  questionIndex={questionIndex}
                  groupIndex={groupIndex}
                  canEdit={canEdit}
                  onUpdate={(patch) => onUpdateQuestion(questionIndex, patch)}
                  onRemove={() => onRemoveQuestion(questionIndex)}
                />
              ))}
            </SortableContext>
            {activeQuestionId &&
              (() => {
                const found = group.questions?.find(
                  (q: any) => q._id === activeQuestionId
                );
                if (!found) return null;
                return createPortal(
                  <DragOverlay dropAnimation={dropAnimation}>
                    <div className="grid grid-cols-1 gap-3 rounded-lg border border-brand-400 bg-white p-3 shadow-xl dark:bg-slate-800 lg:grid-cols-[auto_1fr_150px_130px_auto]">
                      <div className="flex items-center justify-center">
                        <GripVertical className="size-4 text-brand-500" />
                      </div>
                      <div>
                        <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('interviewCompany.dragOverlayQuestion', 'settings')}</div>
                        <div className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-brand-700 dark:bg-slate-900 dark:text-slate-300">
                          {found.question || t('interviewCompany.emptyQuestion', 'settings')}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('interviewCompany.dragOverlayType', 'settings')}</div>
                        <div className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-brand-700 dark:bg-slate-900 dark:text-slate-300">
                          {found.answerType}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('interviewCompany.dragOverlayScore', 'settings')}</div>
                        <div className="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-brand-700 dark:bg-slate-900 dark:text-slate-300">
                          {found.score}
                        </div>
                      </div>
                      <div className="flex items-end">
                        <div className="inline-flex h-10 items-center rounded-lg bg-red-100 px-3 text-red-400 opacity-50 dark:bg-red-500/10">
                          <Trash2 className="size-4" />
                        </div>
                      </div>
                    </div>
                  </DragOverlay>,
                  document.body
                );
              })()}
          </DndContext>

          <button
            type="button"
            onClick={onAddQuestion}
            disabled={!canEdit}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300"
          >
            <PlusCircle className="size-4" /> {t('interviewCompany.addQuestion', 'settings')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InterviewCompanySettingsPage() {
  const { user, hasPermission } = useAuth();
  const { t, locale } = useLocale();
  const { data: companies = [], isLoading: isCompaniesLoading } =
    useCompanies();

  const isSuperAdmin = !!user?.roleId?.name
    ?.toString()
    .toLowerCase()
    .includes('admin');

  const canRead =
    hasPermission('Company Management', 'read') ||
    hasPermission('Settings Management', 'read');
  const canEdit =
    hasPermission('Company Management', 'write') ||
    hasPermission('Settings Management', 'write') ||
    hasPermission('Settings Management', 'create');

  const { selectedCompanyId } = useCompanyFilter();
  const [groups, setGroups] = useState<(InterviewGroup & { _id: string })[]>([]);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [flashGroupIds, setFlashGroupIds] = useState<Set<string>>(new Set());

  // Safety net: stop flashing a newly added group after a while even if the
  // user never hovers it.
  useEffect(() => {
    if (flashGroupIds.size === 0) return;
    const timer = window.setTimeout(() => {
      setFlashGroupIds(new Set());
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [flashGroupIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: '0.4' } },
    }),
    duration: 200,
    easing: 'cubic-bezier(0.2, 0, 0, 1)',
  };
  const [isSaving, setIsSaving] = useState(false);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<
    | 'interview-groups'
    | 'rejection-reasons'
    | 'lead-statuses'
    | 'email-templates'
    | 'applicant-pages'
    | 'job-offers'
    | 'contracts'
  >('interview-groups');

  const isInterviewGroupsTab = activeTab === 'interview-groups';
  const isRejectionTab = activeTab === 'rejection-reasons';
  const isApplicantStatusTab = activeTab === 'lead-statuses';
  const isEmailTemplatesTab = activeTab === 'email-templates';
  const isApplicantPagesTab = activeTab === 'applicant-pages';
  const isOffersTab = activeTab === 'job-offers';
  const isContractsTab = activeTab === 'contracts';

  const effectiveCompanyId = selectedCompanyId ?? (companies as CompanyShape[])[0]?._id;
  const selectedCompany = useMemo(
    () =>
      (companies as CompanyShape[]).find(
        (company) => company._id === effectiveCompanyId
      ),
    [companies, effectiveCompanyId]
  );

  const updateInterviewMutation = useUpdateCompanyInterviewSettings();
  const queryClient = useQueryClient();

  const {
    data: interviewSettingsFromQuery,
    isLoading: isInterviewLoading,
    isFetching: isInterviewFetching,
  } = useCompanyInterviewSettings(effectiveCompanyId, {
    enabled: !!effectiveCompanyId && !isSuperAdmin,
  });

  // Fixed: Use correct precedence with parentheses
  const derivedInterviewSettings = isSuperAdmin
    ? ((selectedCompany as any)?.settings?.interviewSettings ??
      (selectedCompany as any)?.interviewSettings ??
      null)
    : interviewSettingsFromQuery;

  const isLoading = isSuperAdmin
    ? isCompaniesLoading
    : isInterviewLoading || isInterviewFetching;

  const hasInitializedCollapsed = useRef(false);

  useEffect(() => {
    const hasGroupsField =
      !!derivedInterviewSettings &&
      'groups' in (derivedInterviewSettings as any);
    if (!hasGroupsField) return;
    const normalized = normalizeGroups((derivedInterviewSettings as any)?.groups);
    setGroups((prev) =>
      normalized.map((g, i) => ({
        ...g,
        _id: prev[i]?._id || uid(),
      }))
    );
  }, [derivedInterviewSettings]);

  useEffect(() => {
    if (groups.length > 0 && !hasInitializedCollapsed.current) {
      setCollapsedGroupIds(new Set(groups.map((g) => g._id)));
      hasInitializedCollapsed.current = true;
    }
  }, [groups]);

  const totalQuestions = useMemo(
    () => groups.reduce((acc, group) => acc + group.questions.length, 0),
    [groups]
  );

  const addGroup = () => {
    const newId = uid();
    setGroups((prev) => [
      {
        _id: newId,
        name: t('interviewCompany.defaultGroupName', 'settings', { number: prev.length + 1 }),
        questions: [{ ...EMPTY_QUESTION }],
      },
      ...prev,
    ]);
    setCollapsedGroupIds((prev) => new Set(prev).add(newId));
    setFlashGroupIds((prev) => new Set(prev).add(newId));
  };

  const removeGroup = (groupIndex: number) => {
    setGroups((prev) => prev.filter((_, index) => index !== groupIndex));
  };

  const updateGroupName = (groupIndex: number, name: string) => {
    setGroups((prev) =>
      prev.map((group, index) =>
        index === groupIndex ? { ...group, name } : group
      )
    );
  };

  const addQuestion = (groupIndex: number) => {
    setGroups((prev) =>
      prev.map((group, index) => {
        if (index !== groupIndex) return group;
        return {
          ...group,
          questions: [...group.questions, { ...EMPTY_QUESTION }],
        };
      })
    );
  };

  const removeQuestion = (groupIndex: number, questionIndex: number) => {
    setGroups((prev) =>
      prev.map((group, index) => {
        if (index !== groupIndex) return group;
        return {
          ...group,
          questions: group.questions.filter((_, idx) => idx !== questionIndex),
        };
      })
    );
  };

  const updateQuestion = (
    groupIndex: number,
    questionIndex: number,
    patch: Partial<InterviewQuestion>
  ) => {
    setGroups((prev) =>
      prev.map((group, index) => {
        if (index !== groupIndex) return group;

        return {
          ...group,
          questions: group.questions.map((question, qIndex) =>
            qIndex === questionIndex ? { ...question, ...patch } : question
          ),
        };
      })
    );
  };



  const handleQuestionDragStart = useCallback((event: DragStartEvent) => {
    setActiveQuestionId(event.active.id as string);
  }, []);

  const handleQuestionDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveQuestionId(null);
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    setGroups((prev) =>
      prev.map((group) => {
        const qIds = group.questions.map((q: any) => q._id);
        const oldIndex = qIds.indexOf(activeId);
        const newIndex = qIds.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1) return group;
        return {
          ...group,
          questions: arrayMove(group.questions, oldIndex, newIndex),
        };
      })
    );
  }, []);

  const handleQuestionDragCancel = useCallback(() => {
    setActiveQuestionId(null);
  }, []);

  const handleGroupDragStart = useCallback((event: DragStartEvent) => {
    setActiveGroupId(event.active.id as string);
  }, []);

  const handleGroupDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveGroupId(null);
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    setGroups((prev) => {
      const oldIndex = prev.findIndex((g) => g._id === activeId);
      const newIndex = prev.findIndex((g) => g._id === overId);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleGroupDragCancel = useCallback(() => {
    setActiveGroupId(null);
  }, []);

  const validateGroups = (): InterviewGroup[] | null => {
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex];
      if (!group.name.trim()) {
        Swal.fire(
          t('commonValidation', 'settings'),
          t('interviewCompany.validationGroupMustHaveName', 'settings', { number: groupIndex + 1 }),
          'warning'
        );
        return null;
      }

      for (
        let questionIndex = 0;
        questionIndex < group.questions.length;
        questionIndex += 1
      ) {
        const question = group.questions[questionIndex];

        if (!question.question.trim()) {
          Swal.fire(
            t('commonValidation', 'settings'),
            t('interviewCompany.validationQuestionNotEmpty', 'settings', { qNumber: questionIndex + 1, gNumber: groupIndex + 1 }),
            'warning'
          );
          return null;
        }

        if (!Number.isFinite(question.score)) {
          Swal.fire(
            t('commonValidation', 'settings'),
            t('interviewCompany.validationQuestionNeedsScore', 'settings', { qNumber: questionIndex + 1, gNumber: groupIndex + 1 }),
            'warning'
          );
          return null;
        }

        if (
          (question.answerType === 'radio' ||
            question.answerType === 'dropdown' ||
            question.answerType === 'checkbox') &&
          (!Array.isArray(question.choices) || question.choices.length === 0)
        ) {
          Swal.fire(
            t('commonValidation', 'settings'),
            t('interviewCompany.validationChoiceRequired', 'settings', { qNumber: questionIndex + 1, gNumber: groupIndex + 1 }),
            'warning'
          );
          return null;
        }
      }
    }

    return groups.map((group) => ({
      name: group.name.trim(),
      questions: group.questions.map((question: any) => ({
        question: question.question.trim(),
        score: Number(question.score),
        answerType: question.answerType,
        choices: autoFixChoiceScores(question),
        tags: Array.isArray(question.tags) ? question.tags : [],
      })),
    }));
  };

  const handleSaveAll = async () => {
    if (!effectiveCompanyId) {
      Swal.fire(t('commonValidation', 'settings'), t('interviewCompany.validationSelectCompany', 'settings'), 'warning');
      return;
    }

    const payloadGroups = validateGroups();
    if (!payloadGroups) return;

    const settingsId = selectedCompany?.settings?._id;

    if (!settingsId) {
      Swal.fire(
        t('commonValidation', 'settings'),
        t('interviewCompany.validationSettingsNotFound', 'settings'),
        'warning'
      );
      return;
    }

    setIsSaving(true);
    const optimisticGroups = payloadGroups.map((g, i) => ({
      ...g,
      _id: groups[i]?._id ?? uid(),
    }));
    setGroups(optimisticGroups);

    const serverGroups = payloadGroups.map((g) => ({
      ...g,
      questions: g.questions.map((q) => ({
        ...q,
        choices: Array.isArray(q.choices) ? normalizeChoicesToServer(q.choices) : [],
      })),
    }));

    updateInterviewMutation.mutateAsync({
      settingsId,
      companyId: effectiveCompanyId,
      data: { interviewSettings: { groups: serverGroups } } as any,
    }).then(() => {
      Swal.fire({
        title: t('commonSaved', 'settings'),
        icon: 'success',
        timer: 1200,
        showConfirmButton: false,
      });
    }).catch((error: any) => {
      setGroups(prev => prev === optimisticGroups ? normalizeGroups(derivedInterviewSettings?.groups) : prev);
      Swal.fire(
        t('interviewCompany.swalSaveFailed', 'settings'),
        error?.message || t('interviewCompany.swalSaveFailedMsg', 'settings'),
        'error'
      );
    }).finally(() => {
      setIsSaving(false);
    });
  };

  if (!canRead) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <ShieldCheck className="size-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t('interviewCompany.noPermissionTitle', 'settings')}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {t('interviewCompany.noPermissionDesc', 'settings')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-8">
      <PageMeta
        title={t('interviewCompany.pageMetaTitle', 'settings')}
        description={t('interviewCompany.pageMetaDesc', 'settings')}
      />

      <div className="mx-auto max-w-7xl space-y-6">
        <PageBreadCrumb pageTitle={t('interviewCompany.pageBreadcrumb', 'settings')} />
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-5 border-b border-slate-200 px-6 py-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <ClipboardList className="size-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600/80 dark:text-brand-300">
                  {t('interviewCompany.sectionTitle', 'settings')}
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                  {t('interviewCompany.title', 'settings')}
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t('interviewCompany.description', 'settings')}
                </p>
              </div>
            </div>
            {isInterviewGroupsTab && (
              <button
                onClick={handleSaveAll}
                disabled={isSaving || isLoading || !canEdit}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Save className="size-4" />
                )}
                {t('interviewCompany.saveAll', 'settings')}
                <ArrowRight className="size-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('interview-groups')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                isInterviewGroupsTab
                  ? 'bg-brand-500 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <ClipboardList className="size-4" /> {t('interviewCompany.tabInterviewGroups', 'settings')}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rejection-reasons')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                isRejectionTab
                  ? 'bg-brand-500 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Ban className="size-4" /> {t('interviewCompany.tabRejectionReasons', 'settings')}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('lead-statuses')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                isApplicantStatusTab
                  ? 'bg-brand-500 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Settings className="size-4" /> {t('interviewCompany.tabStatuses', 'settings')}
            </button>

            {/* New Email Templates Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('email-templates')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                isEmailTemplatesTab
                  ? 'bg-brand-500 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Mail className="size-4" /> {t('interviewCompany.tabEmailTemplates', 'settings')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('applicant-pages')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                isApplicantPagesTab
                  ? 'bg-brand-500 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Layout className="size-4" /> {t('interviewCompany.tabApplicantPages', 'settings')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('job-offers')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                isOffersTab
                  ? 'bg-brand-500 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="size-4" /> {t('interviewCompany.tabOfferTemplates', 'settings')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('contracts')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                isContractsTab
                  ? 'bg-brand-500 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="size-4" /> {t('interviewCompany.tabContractTemplates', 'settings')}
            </button>
          </div>

          {isInterviewGroupsTab && (
            <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {t('interviewCompany.statCompany', 'settings')}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {getCompanyName(selectedCompany, locale) || t('interviewCompany.statNoCompany', 'settings')}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {t('interviewCompany.statInterviewGroups', 'settings')}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {groups.length}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {t('interviewCompany.statTotalQuestions', 'settings')}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {totalQuestions}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {t('interviewCompany.statSaveStatus', 'settings')}
                </p>
                <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  <CircleCheckBig className="size-4" /> {t('interviewCompany.statReady', 'settings')}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">

          <div className="xl:col-span-12">
            <div key={activeTab} className="animate-fade-slide-in">
            {isInterviewGroupsTab ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-3 border-b border-slate-200 p-6 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <ClipboardList className="size-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight">
                        {t('interviewCompany.interviewGroupsTitle', 'settings')}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {t('interviewCompany.interviewGroupsDesc', 'settings')}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={addGroup}
                    disabled={!canEdit}
                    className="inline-flex items-center gap-2 self-start rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <PlusCircle className="size-4" /> {t('interviewCompany.addGroup', 'settings')}
                  </button>
                </div>

                <div className="space-y-5 p-6">
                  {isLoading && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                      {t('interviewCompany.loading', 'settings')}
                    </div>
                  )}

                  {!isLoading && groups.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
                      <ClipboardList className="mx-auto mb-3 size-10 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {t('interviewCompany.emptyState', 'settings')}
                      </p>
                    </div>
                  )}

                  {groups.length > 0 && (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleGroupDragStart}
                      onDragEnd={handleGroupDragEnd}
                      onDragCancel={handleGroupDragCancel}
                    >
                      <SortableContext
                        items={groups.map((g) => g._id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {groups.map((group, groupIndex) => (
                          <SortableGroupItem
                            key={group._id}
                            group={group}
                            groupIndex={groupIndex}
                            canEdit={canEdit}
                            collapsedGroupIds={collapsedGroupIds}
                            onToggleCollapse={() => {
                              setCollapsedGroupIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(group._id)) {
                                  next.delete(group._id);
                                } else {
                                  next.add(group._id);
                                }
                                return next;
                              });
                            }}
                            onUpdateGroupName={(name) => updateGroupName(groupIndex, name)}
                            onRemoveGroup={() => removeGroup(groupIndex)}
                            onAddQuestion={() => addQuestion(groupIndex)}
                            onUpdateQuestion={(questionIndex, patch) =>
                              updateQuestion(groupIndex, questionIndex, patch)
                            }
                            onRemoveQuestion={(questionIndex) =>
                              removeQuestion(groupIndex, questionIndex)
                            }
                            activeQuestionId={activeQuestionId}
                            onQuestionDragStart={handleQuestionDragStart}
                            onQuestionDragEnd={handleQuestionDragEnd}
                            onQuestionDragCancel={handleQuestionDragCancel}
                            sensors={sensors}
                            dropAnimation={dropAnimation}
                            t={t}
                            isFlashing={flashGroupIds.has(group._id)}
                            onFlashDismiss={() => {
                              setFlashGroupIds((prev) => {
                                const next = new Set(prev);
                                next.delete(group._id);
                                return next;
                              });
                            }}
                          />
                        ))}
                      </SortableContext>
                      {activeGroupId &&
                        createPortal(
                          <DragOverlay dropAnimation={dropAnimation}>
                            <div className="flex items-center gap-3 rounded-xl border border-brand-400 bg-white px-4 py-3 shadow-xl dark:bg-slate-800">
                              <GripVertical className="size-4 shrink-0 text-brand-500" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">
                                  {groups.find((g) => g._id === activeGroupId)?.name || ''}
                                </p>
                              </div>
                              <span className="shrink-0 text-xs text-slate-400">
                                {(() => {
                                  const g = groups.find((g) => g._id === activeGroupId);
                                  return g
                                    ? t('interviewCompany.questionCount', 'settings', { count: g.questions.length })
                                    : '';
                                })()}
                              </span>
                            </div>
                          </DragOverlay>,
                          document.body
                        )}
                    </DndContext>
                  )}
                </div>
              </div>
            ) : isRejectionTab ? (
              <RejectionTab embedded />
            ) : isApplicantStatusTab ? (
              <StatusSettings embedded />
            ) : isEmailTemplatesTab ? (
              <EmailTemplates embedded />
            ) : isApplicantPagesTab ? (
              <ApplicantPagesSettings
                companyId={effectiveCompanyId}
                hideCompanySelector={true}
                embedded
              />
            ) : isContractsTab ? (
              <ContractsTab companyId={effectiveCompanyId!} hideCompanySelector={true} embedded />
            ) : isOffersTab ? (
              <JobOffersTab companyId={effectiveCompanyId!} hideCompanySelector={true} embedded />
            ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}