import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router';
import PageBreadcrumb from '../../../components/common/PageBreadCrumb';
import PageMeta from '../../../components/common/PageMeta';
import {
  PlusIcon,
  SearchIcon,
  BriefcaseIcon,
  Building2Icon,
  MapPinIcon,
  CalendarIcon,
  ArrowRightIcon,
  LayoutGridIcon,
  MenuIcon as ListIcon,
  GripVerticalIcon,
  Trash2Icon,
  PencilIcon,
  RefreshCwIcon,
} from 'lucide-react';
import Swal from '../../../utils/swal';
import {
  useJobPositions,
  useDeleteJobPosition,
  jobPositionsKeys,
} from '../../../hooks/queries';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import { useAuth } from '../../../context/AuthContext';
import { useLocale } from '../../../context/LocaleContext';
import { useCompanyFilter } from '../../../context/CompanyFilterContext';
import { toPlainString } from '../../../utils/strings';
import { normalizeFieldConfig } from '../../../utils/jobUtils';
import Switch from '../../../components/form/switch/Switch';
import { jobPositionsService } from '../../../services/jobPositionsService';
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
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { queryClient } from '../../../lib/queryClient';

const getTranslation = (value: any, defaultValue = '', locale?: string): string => {
  const plain = toPlainString(value, locale);
  return plain || defaultValue;
};

const toLocalized = (value: any, fallback = ''): { en: string; ar: string } => {
  if (typeof value === 'string') {
    const normalized = value || fallback;
    return { en: normalized, ar: normalized };
  }
  if (value && typeof value === 'object') {
    const enValue = value.en || toPlainString(value) || fallback;
    const arValue = value.ar || enValue;
    return { en: enValue, ar: arValue };
  }
  return { en: fallback, ar: fallback };
};

const isJobExpired = (job: any): boolean => {
  if (!job?.registrationEnd) return false;
  const end = new Date(job.registrationEnd);
  if (Number.isNaN(end.getTime())) return false;
  const endOfDay = end.getTime() + 24 * 60 * 60 * 1000 - 1;
  return endOfDay < Date.now();
};

const getJobOrderValue = (job: any): number => {
  const rawOrder = job?.order;
  const parsedOrder =
    typeof rawOrder === 'number' ? rawOrder : Number(rawOrder);
  return Number.isFinite(parsedOrder) ? parsedOrder : Number.MAX_SAFE_INTEGER;
};

const getJobCompanyId = (job: any): string => {
  const companyId = job?.companyId;
  if (typeof companyId === 'string') return companyId;
  if (companyId && typeof companyId === 'object') {
    return companyId._id || companyId.id || '';
  }
  return '';
};

const sortJobsByOrder = (jobs: any[]): any[] => {
  return [...jobs].sort((a, b) => {
    const orderDiff = getJobOrderValue(a) - getJobOrderValue(b);
    if (orderDiff !== 0) return orderDiff;
    const createdA = a?.createdAt
      ? new Date(a.createdAt).getTime()
      : Number.MAX_SAFE_INTEGER;
    const createdB = b?.createdAt
      ? new Date(b.createdAt).getTime()
      : Number.MAX_SAFE_INTEGER;
    return createdA - createdB;
  });
};


const formatDate = (dateString?: string, locale?: string) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString(locale || 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

function SortableJobCard({
  job,
  canManageJobs,
  onToggleActive,
  onDelete,
  onEdit,
  suppressNavigateRef,
}: {
  job: any;
  canManageJobs: boolean;
  onToggleActive: (job: any) => void;
  onDelete: (e: React.MouseEvent, jobId: string) => void;
  onEdit: (job: any) => void;
  suppressNavigateRef: React.MutableRefObject<boolean>;
}) {
  const { t, locale } = useLocale();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: job._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleCardClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (suppressNavigateRef.current) {
      e.preventDefault();
    }
  };

  return (
    <Link
      ref={setNodeRef}
      style={style}
      to={`/create-job?id=${job._id}`}
      state={{ job }}
      onClick={handleCardClick}
      className={`group relative block cursor-pointer space-y-4 rounded-3xl border border-white/20 bg-white/60 p-6 backdrop-blur-xl transition-[transform,opacity,box-shadow] duration-200 hover:scale-[1.02] hover:shadow-2xl hover:shadow-brand-500/10 dark:border-slate-800/50 dark:bg-slate-900/60 ${
        isDragging ? 'opacity-60 ring-2 ring-brand-400 z-50' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              {...attributes}
              {...listeners}
              className="inline-flex items-center text-slate-400 cursor-grab active:cursor-grabbing"
              title={t('jobsDragReorder', 'jobs')}
            >
              <GripVerticalIcon className="size-4" />
            </span>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                isJobExpired(job)
                  ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                  : job.isActive !== false
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400'
              }`}
            >
              {isJobExpired(job)
                ? t('jobsExpiredBadge', 'jobs')
                : job.isActive !== false
                  ? t('jobsActiveBadge', 'jobs')
                  : t('jobsDeprioritizedBadge', 'jobs')}
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 transition-colors group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
            {getTranslation(job.title, '', locale)}
          </h3>
        </div>

        <div className="flex flex-col items-end gap-2">
          {canManageJobs && (
            <div onClick={(e) => e.preventDefault()}>
              <Switch
                label=""
                checked={job.isActive !== false}
                onChange={() => onToggleActive(job)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Building2Icon className="size-4 text-brand-500" />
          <span className="font-medium truncate">
            {getTranslation(job.companyId?.name, '', locale) || t('jobsGlobalCorp', 'jobs')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <MapPinIcon className="size-4" />
          <span>{({ 'on-site': t('createOnSite', 'jobs'), remote: t('createRemote', 'jobs'), hybrid: t('createHybrid', 'jobs') } as Record<string, string>)[job.workArrangement] || job.workArrangement || t('jobsRemoteOffice', 'jobs')}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <CalendarIcon className="size-4" />
          <span>{t('jobsCreatedAt', 'jobs', { date: formatDate(job.createdAt, locale) })}</span>
        </div>
      </div>

      <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
        <div />
        <div
          className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.preventDefault()}
        >
          {canManageJobs && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(job);
              }}
              className="p-1.5 text-slate-400 hover:text-brand-600 transition-colors bg-white/80 rounded-lg dark:bg-slate-800"
            >
              <PencilIcon className="size-4" />
            </button>
          )}
          {canManageJobs && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(e, job._id);
              }}
              className="p-1.5 text-slate-400 hover:text-red-600 transition-colors bg-white/80 rounded-lg dark:bg-slate-800"
            >
              <Trash2Icon className="size-4" />
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}

function SortableJobRow({
  job,
  onNavigate,
  suppressNavigateRef,
}: {
  job: any;
  onNavigate: (job: any) => void;
  suppressNavigateRef: React.MutableRefObject<boolean>;
}) {
  const { t, locale } = useLocale();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: job._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleRowClick = () => {
    if (suppressNavigateRef.current) return;
    onNavigate(job);
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      onClick={handleRowClick}
      className={`group cursor-pointer transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${
        isDragging ? 'opacity-60 ring-2 ring-brand-400 z-50' : ''
      }`}
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <span
            {...attributes}
            {...listeners}
            className="inline-flex items-center text-slate-400 cursor-grab active:cursor-grabbing"
            title={t('jobsDragReorder', 'jobs')}
          >
            <GripVerticalIcon className="size-4" />
          </span>
          <div className="rounded-xl bg-brand-50 p-2.5 dark:bg-brand-500/10">
            <BriefcaseIcon className="size-5 text-brand-600" />
          </div>
          <div>
            <Link
              to={`/create-job?id=${job._id}`}
              state={{ job }}
              className="font-bold text-slate-900 hover:text-brand-600 transition-colors dark:text-white"
              onClick={(e) => {
                if (suppressNavigateRef.current) {
                  e.preventDefault();
                } else {
                  onNavigate(job);
                }
              }}
            >
              {getTranslation(job.title, '', locale)}
            </Link>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
            <Building2Icon className="size-3.5 text-slate-400" />
            {getTranslation(job.companyId?.name, '', locale) || t('jobsGlobalCorp', 'jobs')}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <MapPinIcon className="size-3.5" />
            {({ 'on-site': t('createOnSite', 'jobs'), remote: t('createRemote', 'jobs'), hybrid: t('createHybrid', 'jobs') } as Record<string, string>)[job.workArrangement] || job.workArrangement || t('jobsOffice', 'jobs')}
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900 dark:text-white">
            {job.applicantsCount || 0}
          </span>
           <span className="text-xs text-slate-500">{t('jobsCandidates', 'jobs')}</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
            isJobExpired(job)
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400'
              : job.isActive !== false
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {isJobExpired(job)
            ? t('jobsExpiredStatus', 'jobs')
            : job.isActive !== false
              ? t('jobsActiveStatus', 'jobs')
              : t('jobsInactiveStatus', 'jobs')}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onNavigate(job)}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white hover:text-brand-600 dark:hover:bg-slate-700"
          >
            <ArrowRightIcon className="size-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function Jobs() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { t, locale } = useLocale();

  const isAdmin = user?.roleId?.name?.toLowerCase().includes('super admin');
  const canCreate = hasPermission('Job Position Management', 'create');
  const canWrite = hasPermission('Job Position Management', 'write');
  const canManageJobs = canCreate && canWrite;

  const { selectedCompanyId } = useCompanyFilter();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orderedJobIds, setOrderedJobIds] = useState<string[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [activeDragJob, setActiveDragJob] = useState<any | null>(null);
  const suppressNavigateRef = useRef(false);
  const orderSyncVersionRef = useRef(0);
  const orderSyncDebounceRef = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const jobQueryCompanyParam = useMemo(() => {
    if (!user) return ['__NO_COMPANY__'];
    if (isAdmin) return undefined;
    const usercompanyIds = user?.companies?.map((c: any) =>
      typeof c.companyId === 'string' ? c.companyId : c.companyId._id
    );
    return usercompanyIds?.length ? usercompanyIds : ['__NO_COMPANY__'];
  }, [user, isAdmin]);

  const jobQueryDepartmentParam = useMemo(() => {
    if (!user?.companies || !Array.isArray(user.companies)) return undefined;
    const allDepts = user.companies
      .flatMap((c: any) => c.departments || [])
      .map((d: any) => (typeof d === 'string' ? d : d._id))
      .filter(Boolean);
    return allDepts.length > 0 ? allDepts : undefined;
  }, [user]);

  const {
    data: jobPositions = [],
    isLoading: isLoadingJobs,
    refetch: refetchJobs,
    isFetching: isJobFetching,
  } = useJobPositions(
    jobQueryCompanyParam as any,
    false,
    jobQueryDepartmentParam as any
  );

  const deleteJobMutation = useDeleteJobPosition();

  useEffect(() => {
    setOrderedJobIds((prevIds) => {
      const incomingIds = sortJobsByOrder(jobPositions)
        .map((job: any) => job?._id)
        .filter(Boolean) as string[];
      if (incomingIds.length === 0) return [];
      const unchanged =
        incomingIds.length === prevIds.length &&
        incomingIds.every((id, index) => id === prevIds[index]);
      return unchanged ? prevIds : incomingIds;
    });
  }, [jobPositions]);

  useEffect(() => {
    return () => {
      if (orderSyncDebounceRef.current !== null) {
        window.clearTimeout(orderSyncDebounceRef.current);
      }
    };
  }, []);

  const orderedJobs = useMemo(() => {
    if (!Array.isArray(jobPositions) || jobPositions.length === 0) return [];
    if (orderedJobIds.length === 0) return sortJobsByOrder(jobPositions);
    const jobsById = new Map(jobPositions.map((job: any) => [job._id, job]));
    const prioritized = orderedJobIds
      .map((id) => jobsById.get(id))
      .filter(Boolean) as any[];
    const prioritizedIds = new Set(prioritized.map((job: any) => job._id));
    const remaining = sortJobsByOrder(
      jobPositions.filter((job: any) => !prioritizedIds.has(job._id))
    );
    return [...prioritized, ...remaining];
  }, [jobPositions, orderedJobIds]);

  const buildOrderPayload = (job: any, order: number) => {
    const payload: any = {
      title: toLocalized(job.title, t('jobsUntitledRole', 'jobs')),
      description: toLocalized(job.description, ''),
      employmentType: job.employmentType || 'full-time',
      workArrangement: job.workArrangement || 'on-site',
      order,
    };
    if (typeof job.isActive === 'boolean') payload.isActive = job.isActive;
    if (typeof job.salary === 'number') payload.salary = job.salary;
    if (typeof job.salaryVisible === 'boolean')
      payload.salaryVisible = job.salaryVisible;
    payload.fieldConfig = normalizeFieldConfig(job?.fieldConfig, job?.salaryFieldVisible);
    if (typeof job.bilingual === 'boolean') payload.bilingual = job.bilingual;
    return payload;
  };

  const syncJobOrderToBackend = async ({
    previousOrderIds,
    nextOrderIds,
    companyId,
    sourceJobId,
  }: {
    previousOrderIds: string[];
    nextOrderIds: string[];
    companyId: string;
    sourceJobId?: string;
  }) => {
    if (!companyId) return;
    const jobsById = new Map(jobPositions.map((job: any) => [job?._id, job]));
    const normalizedCompanyOrderIds = nextOrderIds.filter((id) => {
      const job = jobsById.get(id);
      return Boolean(job) && getJobCompanyId(job) === companyId;
    });
    if (normalizedCompanyOrderIds.length === 0) return;

    const previousCompanyOrderIds = previousOrderIds.filter((id) => {
      const job = jobsById.get(id);
      return Boolean(job) && getJobCompanyId(job) === companyId;
    });
    const prevIndexById = new Map(
      previousCompanyOrderIds.map((id, idx) => [id, idx])
    );

    const changedCompanyIds = (() => {
      if (sourceJobId && normalizedCompanyOrderIds.includes(sourceJobId)) {
        const newIndex = normalizedCompanyOrderIds.indexOf(sourceJobId);
        const oldIndex = prevIndexById.get(sourceJobId);
        if (oldIndex === undefined || oldIndex !== newIndex)
          return [sourceJobId];
        return [] as string[];
      }
      return normalizedCompanyOrderIds.filter(
        (id, idx) => prevIndexById.get(id) !== idx
      );
    })();

    if (changedCompanyIds.length === 0) return;

    const reorderItems = changedCompanyIds.map((id) => ({
      id,
      order: normalizedCompanyOrderIds.indexOf(id) + 1,
    }));

    const basePayloadById = changedCompanyIds.reduce(
      (acc, id) => {
        const job = jobsById.get(id);
        if (job) {
          acc[id] = buildOrderPayload(
            job,
            normalizedCompanyOrderIds.indexOf(id) + 1
          );
        }
        return acc;
      },
      {} as Record<string, any>
    );

    const requestVersion = ++orderSyncVersionRef.current;
    setIsSavingOrder(true);

    try {
      await jobPositionsService.reorderJobPositions(
        reorderItems,
        basePayloadById
      );
    } catch (err: any) {
      if (requestVersion === orderSyncVersionRef.current) {
        setOrderedJobIds(previousOrderIds);
        const details = err?.response?.data?.details;
        const detailMessage =
          Array.isArray(details) && details.length > 0
            ? details[0]?.message
            : '';
        Swal.fire(
          t('jobsReorderFailed', 'jobs'),
          detailMessage || err?.message || t('jobsReorderFailedMsg', 'jobs'),
          'error'
        );
      }
    } finally {
      if (requestVersion === orderSyncVersionRef.current) {
        setIsSavingOrder(false);
      }
    }
  };

  const scheduleJobOrderSync = ({
    previousOrderIds,
    nextOrderIds,
    companyId,
    sourceJobId,
  }: {
    previousOrderIds: string[];
    nextOrderIds: string[];
    companyId: string;
    sourceJobId?: string;
  }) => {
    if (orderSyncDebounceRef.current !== null) {
      window.clearTimeout(orderSyncDebounceRef.current);
    }
    orderSyncDebounceRef.current = window.setTimeout(() => {
      orderSyncDebounceRef.current = null;
      void syncJobOrderToBackend({
        previousOrderIds,
        nextOrderIds,
        companyId,
        sourceJobId,
      });
    }, 250);
  };

  const handleJobClick = (job: any) => {
    if (suppressNavigateRef.current) return;
    navigate(`/create-job?id=${job._id}`, { state: { job } });
  };

  const handleGridDragStart = (event: DragStartEvent) => {
    const job = orderedJobs.find((j: any) => j._id === event.active.id);
    setActiveDragJob(job || null);
    suppressNavigateRef.current = true;

    const handler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      document.removeEventListener('click', handler, true);
    };
    document.addEventListener('click', handler, true);
    setTimeout(
      () => document.removeEventListener('click', handler, true),
      1000
    );
  };

  const handleGridDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragJob(null);

    window.setTimeout(() => {
      suppressNavigateRef.current = false;
    }, 0);

    if (!over || active.id === over.id) return;

    const jobsById = new Map(orderedJobs.map((job: any) => [job?._id, job]));
    const sourceJob = jobsById.get(active.id as string);
    if (!sourceJob) return;

    const companyId = getJobCompanyId(sourceJob);
    if (!companyId) return;

    const companyJobIds = (
      orderedJobIds.length > 0
        ? orderedJobIds
        : orderedJobs.map((j: any) => j._id)
    ).filter((id) => {
      const job = jobsById.get(id);
      return getJobCompanyId(job) === companyId;
    });

    const oldIndex = companyJobIds.indexOf(active.id as string);
    const newIndex = companyJobIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const newCompanyOrder = arrayMove(companyJobIds, oldIndex, newIndex);
    const baselineOrderIds =
      orderedJobIds.length > 0
        ? [...orderedJobIds]
        : orderedJobs.map((job: any) => job._id);

    let companyIndex = 0;
    const nextOrderIds = baselineOrderIds.map((id) => {
      const job = jobsById.get(id);
      if (getJobCompanyId(job) === companyId) {
        return newCompanyOrder[companyIndex++];
      }
      return id;
    });

    setOrderedJobIds(nextOrderIds);
    scheduleJobOrderSync({
      previousOrderIds: baselineOrderIds,
      nextOrderIds,
      companyId,
      sourceJobId: active.id as string,
    });
  };

  const handleGridDragCancel = () => {
    setActiveDragJob(null);
    window.setTimeout(() => {
      suppressNavigateRef.current = false;
    }, 0);
  };

  const handleEditJob = (job: any) => {
    navigate(`/create-job?id=${job._id}`, { state: { job } });
  };

  const filteredJobs = useMemo(() => {
    return orderedJobs.filter((job: any) => {
      const title = getTranslation(job.title, '', locale).toLowerCase();
      const company = job.companyId?.name
        ? getTranslation(job.companyId.name, '', locale).toLowerCase()
        : '';
      const matchesSearch =
        title.includes(searchTerm.toLowerCase()) ||
        company.includes(searchTerm.toLowerCase());

      const isActive = job.isActive !== false;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && isActive) ||
        (statusFilter === 'inactive' && !isActive);

      const companyIdForJob = getJobCompanyId(job) || 'unassigned';
      const matchesCompany =
        !selectedCompanyId || companyIdForJob === selectedCompanyId;

      return matchesSearch && matchesStatus && matchesCompany;
    });
  }, [orderedJobs, searchTerm, statusFilter, selectedCompanyId]);

  const jobsGroupedByCompany = useMemo(() => {
    if (!Array.isArray(orderedJobs) || orderedJobs.length === 0) return [];
    const filteredIds = new Set((filteredJobs || []).map((j: any) => j._id));
    const indexById = new Map(
      orderedJobs.map((job: any, idx: number) => [job._id, idx])
    );

    const companyCounts = new Map<string, number>();
    const companyFirstIndex = new Map<string, number>();

    (filteredJobs || []).forEach((j: any) => {
      const cid = getJobCompanyId(j) || 'unassigned';
      companyCounts.set(cid, (companyCounts.get(cid) || 0) + 1);
      const idx = indexById.get(j._id);
      if (idx !== undefined) {
        const prev = companyFirstIndex.get(cid);
        if (prev === undefined || idx < prev) companyFirstIndex.set(cid, idx);
      }
    });

    const allCompanyIds =
      companyCounts.size > 0
        ? Array.from(companyCounts.keys())
        : Array.from(
            new Set(
              orderedJobs.map((j: any) => getJobCompanyId(j) || 'unassigned')
            )
          );

    allCompanyIds.sort((a, b) => {
      const ca = companyCounts.get(a) || 0;
      const cb = companyCounts.get(b) || 0;
      if (cb !== ca) return cb - ca;
      const ia = companyFirstIndex.get(a) ?? Number.MAX_SAFE_INTEGER;
      const ib = companyFirstIndex.get(b) ?? Number.MAX_SAFE_INTEGER;
      return ia - ib;
    });

    return allCompanyIds
      .map((cid) => {
        const jobsForCompany = orderedJobs
          .filter(
            (j: any) =>
              filteredIds.has(j._id) &&
              (getJobCompanyId(j) || 'unassigned') === cid
          )
          .sort((a: any, b: any) => {
            const ia = indexById.get(a._id);
            const ib = indexById.get(b._id);
            if (ia !== undefined && ib !== undefined) return ia - ib;
            const oa = getJobOrderValue(a);
            const ob = getJobOrderValue(b);
            if (oa !== ob) return oa - ob;
            const ca = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
            const cb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
            return ca - cb;
          });

        const companyName =
          jobsForCompany[0]?.companyId?.name ||
          (cid ? t('jobsCompany', 'jobs') : t('jobsUnassigned', 'jobs'));
        return {
          companyId: cid || 'unassigned',
          companyName,
          jobs: jobsForCompany,
        };
      })
      .filter((g) => g.jobs.length > 0);
  }, [orderedJobs, filteredJobs]);

  const handleToggleActive = (job: any) => {
  const jobId = job._id;
  const newStatus = !job.isActive;

  const listKey = jobPositionsKeys.list(
    jobQueryCompanyParam as any,
    jobQueryDepartmentParam as any
  );
  const detailKey = jobPositionsKeys.detail(jobId);

  // snapshot for rollback
  const previousList = queryClient.getQueryData<any[]>(listKey);
  const previousDetail = queryClient.getQueryData<any>(detailKey);

  // flip instantly, no waiting on the network
  queryClient.setQueryData<any[]>(listKey, (old) =>
    old ? old.map((j) => (j._id === jobId ? { ...j, isActive: newStatus } : j)) : old
  );
  queryClient.setQueryData(detailKey, (old: any) =>
    old ? { ...old, isActive: newStatus } : old
  );

  const payload: any = {
    isActive: newStatus,
    title: toLocalized(job.title, t('jobsUntitledRole', 'jobs')),
    description: toLocalized(job.description, ''),
    employmentType: job.employmentType || 'full-time',
    workArrangement: job.workArrangement || 'on-site',
  };
  if (typeof job.salary === 'number') payload.salary = job.salary;
  if (typeof job.salaryVisible === 'boolean') payload.salaryVisible = job.salaryVisible;
  payload.fieldConfig = normalizeFieldConfig(job?.fieldConfig, job?.salaryFieldVisible);
  if (typeof job.bilingual === 'boolean') payload.bilingual = job.bilingual;

  // fire and forget — UI already reflects the new state
  jobPositionsService.updateJobPosition(jobId, payload).catch((err: any) => {
    // roll back on failure
    queryClient.setQueryData(listKey, previousList);
    queryClient.setQueryData(detailKey, previousDetail);

    const details = err?.response?.data?.details;
    const detailMessage =
      Array.isArray(details) && details.length > 0 ? details[0]?.message : '';
    Swal.fire(t('jobsError', 'jobs'), detailMessage || t('jobsUpdateFailed', 'jobs'), 'error');
  });
};

  const handleDelete = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: t('jobsDeleteTitle', 'jobs'),
      text: t('jobsDeleteText', 'jobs'),
      icon: 'warning',
      showCancelButton: true,
      cancelButtonText: t('cancel', 'common'),
      confirmButtonColor: '#EF4444',
      confirmButtonText: t('jobsDeleteConfirm', 'jobs'),
    });
    if (result.isConfirmed) {
      try {
        await deleteJobMutation.mutateAsync(jobId);
        await refetchJobs();
        Swal.fire(t('jobsDeleted', 'jobs'), t('jobsDeletedMsg', 'jobs'), 'success');
      } catch {
        Swal.fire(t('jobsError', 'jobs'), t('jobsDeleteError', 'jobs'), 'error');
      }
    }
  };

  if (isLoadingJobs) {
    return <LoadingSpinner fullPage message={t('jobsAccessingRegistry', 'jobs')} />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] p-4 sm:p-8 text-slate-900 dark:text-slate-100">
      <PageMeta
        title={t('jobsPageTitle', 'jobs')}
        description={t('jobsPageDesc', 'jobs')}
      />

      <div className="max-w-7xl mx-auto space-y-8">
        <PageBreadcrumb pageTitle={t('jobsBreadcrumb', 'jobs')} />

        {/* Header */}
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('jobsSubtitle', 'jobs', { count: jobPositions.length })}
            </p>
          </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetchJobs()}
            className={`p-2.5 rounded-xl border border-white/20 bg-white/40 backdrop-blur-md transition-all hover:bg-white/60 dark:border-slate-800/50 dark:bg-slate-900/40 ${
              isJobFetching ? 'animate-spin' : ''
            }`}
          >
            <RefreshCwIcon className="size-4 text-slate-500" />
          </button>

          {canManageJobs && (
            <button
              onClick={() => navigate('/create-job')}
              className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-brand-500/25 active:scale-95"
            >
              <PlusIcon className="size-4 transition-transform group-hover:rotate-90" />
              {t('jobsLaunchNewRole', 'jobs')}
            </button>
          )}
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-white/20 bg-white/40 p-4 backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/40 md:flex-row md:items-center">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('jobsSearchPlaceholder', 'jobs')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border-none bg-white/50 py-2.5 pl-11 pr-4 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-800/50"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex rounded-lg bg-slate-100/50 p-1 dark:bg-slate-800/50">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded-md p-1.5 transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutGridIcon className="size-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-md p-1.5 transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ListIcon className="size-4" />
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border-none bg-transparent py-2 pl-2 pr-8 text-sm font-medium text-slate-600 outline-none focus:ring-0 dark:text-slate-400"
          >
            <option value="all">{t('jobsAllStatus', 'jobs')}</option>
            <option value="active">{t('jobsActive', 'jobs')}</option>
            <option value="inactive">{t('jobsInactive', 'jobs')}</option>
          </select>

          {isSavingOrder && (
            <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
              {t('jobsSavingOrder', 'jobs')}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 py-24 dark:border-slate-800">
          <div className="rounded-2xl bg-slate-50 p-6 dark:bg-slate-900/50">
            <BriefcaseIcon className="size-12 text-slate-300 dark:text-slate-700" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-slate-900 dark:text-white">
            {t('jobsNoPositions', 'jobs')}
          </h3>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {t('jobsNoPositionsDesc', 'jobs')}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleGridDragStart}
          onDragEnd={handleGridDragEnd}
          onDragCancel={handleGridDragCancel}
        >
          <div className="space-y-10">
            {jobsGroupedByCompany.map((group: any) => {
              const groupJobIds = group.jobs.map((j: any) => j._id);
              return (
                <div key={group.companyId} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {getTranslation(group.companyName, '', locale)}
                    </h4>
                    <span className="text-sm text-slate-500">
                      {t('jobsPositions', 'jobs', { count: group.jobs.length })}
                    </span>
                  </div>

                  <SortableContext
                    items={groupJobIds}
                    strategy={rectSortingStrategy}
                  >
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                      {group.jobs.map((job: any) => (
                        <SortableJobCard
                          key={job._id}
                          job={job}
                          canManageJobs={canManageJobs}
                          onToggleActive={handleToggleActive}
                          onDelete={handleDelete}
                          onEdit={handleEditJob}
                          suppressNavigateRef={suppressNavigateRef}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeDragJob ? (
              <div className="cursor-grabbing rounded-3xl border border-white/20 bg-white/80 p-6 shadow-2xl shadow-brand-500/20 backdrop-blur-xl opacity-90 dark:border-slate-800/50 dark:bg-slate-900/80">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {getTranslation(activeDragJob.title, '', locale)}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/20 bg-white/60 backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/60">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t('jobsColumnPosition', 'jobs')}
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t('jobsColumnInfrastructure', 'jobs')}
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t('jobsColumnApplicants', 'jobs')}
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t('jobsColumnStatus', 'jobs')}
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t('jobsColumnActions', 'jobs')}
                </th>
              </tr>
            </thead>

            {jobsGroupedByCompany.map((group: any) => {
              const groupJobIds = group.jobs.map((j: any) => j._id);
              const companyId = group.companyId;

              const handleListDragEnd = (event: DragEndEvent) => {
                const { active, over } = event;
                if (!over || active.id === over.id) return;

                const oldIndex = groupJobIds.indexOf(active.id as string);
                const newIndex = groupJobIds.indexOf(over.id as string);
                if (oldIndex === -1 || newIndex === -1) return;

                suppressNavigateRef.current = true;
                window.setTimeout(() => {
                  suppressNavigateRef.current = false;
                }, 0);

                const newCompanyOrder = arrayMove(
                  groupJobIds,
                  oldIndex,
                  newIndex
                );
                const baselineOrderIds =
                  orderedJobIds.length > 0
                    ? [...orderedJobIds]
                    : orderedJobs.map((job: any) => job._id);

                const jobsById = new Map(
                  orderedJobs.map((job: any) => [job?._id, job])
                );

                let companyIdx = 0;
                const nextOrderIds = baselineOrderIds.map((id) => {
                  const job = jobsById.get(id);
                  if (getJobCompanyId(job) === companyId) {
                    return newCompanyOrder[companyIdx++];
                  }
                  return id;
                });

                setOrderedJobIds(nextOrderIds);
                scheduleJobOrderSync({
                  previousOrderIds: baselineOrderIds,
                  nextOrderIds,
                  companyId,
                  sourceJobId: active.id as string,
                });
              };

              return (
                <tbody
                  key={group.companyId}
                  className="divide-y divide-slate-50 dark:divide-slate-800/50"
                >
                  <tr className="bg-slate-50/30">
                    <td
                      colSpan={5}
                      className="px-6 py-3 font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {getTranslation(group.companyName, '', locale)}{' '}
                      <span className="ml-2 text-sm text-slate-500">
                        ({group.jobs.length})
                      </span>
                    </td>
                  </tr>

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleListDragEnd}
                  >
                    <SortableContext
                      items={groupJobIds}
                      strategy={verticalListSortingStrategy}
                    >
                      {group.jobs.map((job: any) => (
                        <SortableJobRow
                          key={job._id}
                          job={job}
                          onNavigate={handleJobClick}
                          suppressNavigateRef={suppressNavigateRef}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </tbody>
              );
            })}
          </table>
        </div>
      )}
      </div>
    </div>
  );
}
