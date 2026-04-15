import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
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
} from "lucide-react";
import Swal from '../../../utils/swal';
import { 
  useJobPositions, 
  useDeleteJobPosition,
  useUpdateJobPosition 
} from "../../../hooks/queries";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { useAuth } from "../../../context/AuthContext";
import { toPlainString } from "../../../utils/strings";
import Switch from "../../../components/form/switch/Switch";
import { jobPositionsService } from "../../../services/jobPositionsService";

// Helper to handle multilingual objects or strings and always return plain text
const getTranslation = (value: any, defaultValue = ""): string => {
  const plain = toPlainString(value);
  return plain || defaultValue;
};

const toLocalized = (value: any, fallback = ""): { en: string; ar: string } => {
  if (typeof value === "string") {
    const normalized = value || fallback;
    return { en: normalized, ar: normalized };
  }

  if (value && typeof value === "object") {
    const enValue = value.en || toPlainString(value) || fallback;
    const arValue = value.ar || enValue;
    return {
      en: enValue,
      ar: arValue,
    };
  }

  return { en: fallback, ar: fallback };
};

const getJobOrderValue = (job: any): number => {
  const rawOrder = job?.order;
  const parsedOrder = typeof rawOrder === "number" ? rawOrder : Number(rawOrder);
  return Number.isFinite(parsedOrder) ? parsedOrder : Number.MAX_SAFE_INTEGER;
};

const sortJobsByOrder = (jobs: any[]): any[] => {
  return [...jobs].sort((a, b) => {
    const orderDiff = getJobOrderValue(a) - getJobOrderValue(b);
    if (orderDiff !== 0) return orderDiff;

    const createdA = a?.createdAt ? new Date(a.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
    const createdB = b?.createdAt ? new Date(b.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
    return createdA - createdB;
  });
};



export default function Jobs() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  
  const isAdmin = user?.roleId?.name?.toLowerCase().includes("super admin");
  const canCreate = hasPermission("Job Position Management", "create");
  const canWrite = hasPermission("Job Position Management", "write");

  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [orderedJobIds, setOrderedJobIds] = useState<string[]>([]);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [dropTargetJobId, setDropTargetJobId] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const suppressNavigateRef = useRef(false);
  const orderSyncVersionRef = useRef(0);
  const orderSyncDebounceRef = useRef<number | null>(null);

  // Memoize user-derived values for the query
  const jobQueryCompanyParam = useMemo(() => {
    if (!user) return "none";
    if (isAdmin) return undefined;

    const usercompanyIds = user?.companies?.map((c: any) =>
      typeof c.companyId === "string" ? c.companyId : c.companyId._id
    );
    return usercompanyIds?.length ? usercompanyIds : "none";
  }, [user, isAdmin]);

  const { 
    data: jobPositions = [], 
    isLoading: isLoadingJobs,
    refetch: refetchJobs,
    isFetching: isJobFetching
  } = useJobPositions(jobQueryCompanyParam as any);

  const deleteJobMutation = useDeleteJobPosition();
  const updateJobMutation = useUpdateJobPosition();

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

  const moveIdBeforeTarget = (ids: string[], sourceJobId: string, targetJobId: string) => {
    const sourceIndex = ids.indexOf(sourceJobId);
    const targetIndex = ids.indexOf(targetJobId);

    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
      return ids;
    }

    const next = [...ids];
    const [movedId] = next.splice(sourceIndex, 1);
    const insertIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    next.splice(insertIndex, 0, movedId);

    return next;
  };

  const buildOrderPayload = (job: any, order: number) => {
    const payload: any = {
      title: toLocalized(job.title, "Untitled Role"),
      description: toLocalized(job.description, ""),
      employmentType: job.employmentType || "full-time",
      workArrangement: job.workArrangement || "on-site",
      order: order,
    };

    if (typeof job.isActive === "boolean") payload.isActive = job.isActive;
    if (typeof job.salary === "number") payload.salary = job.salary;
    if (typeof job.salaryVisible === "boolean") payload.salaryVisible = job.salaryVisible;
    if (typeof job.bilingual === "boolean") payload.bilingual = job.bilingual;

    return payload;
  };

  const syncJobOrderToBackend = async ({
    previousOrderIds,
    nextOrderIds,
  }: {
    previousOrderIds: string[];
    nextOrderIds: string[];
  }) => {
    const jobsById = new Map(jobPositions.map((job: any) => [job?._id, job]));
    const normalizedNextOrderIds = nextOrderIds.filter((id) => jobsById.has(id));
    if (normalizedNextOrderIds.length === 0) return;

    const reorderItems = normalizedNextOrderIds.map((id, index) => ({
      id,
      order: index + 1,
    }));

    const basePayloadById = normalizedNextOrderIds.reduce(
      (acc, id, index) => {
        const job = jobsById.get(id);
        if (job) {
          acc[id] = buildOrderPayload(job, index + 1);
        }
        return acc;
      },
      {} as Record<string, any>
    );

    const requestVersion = ++orderSyncVersionRef.current;
    setIsSavingOrder(true);

    try {
      await jobPositionsService.reorderJobPositions(reorderItems, basePayloadById);
    } catch (err: any) {
      if (requestVersion === orderSyncVersionRef.current) {
        setOrderedJobIds(previousOrderIds);
        const details = err?.response?.data?.details;
        const detailMessage = Array.isArray(details) && details.length > 0 ? details[0]?.message : "";
        Swal.fire("Reorder Failed", detailMessage || err?.message || "Failed to persist job ordering.", "error");
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
  }: {
    previousOrderIds: string[];
    nextOrderIds: string[];
  }) => {
    if (orderSyncDebounceRef.current !== null) {
      window.clearTimeout(orderSyncDebounceRef.current);
    }

    orderSyncDebounceRef.current = window.setTimeout(() => {
      orderSyncDebounceRef.current = null;
      void syncJobOrderToBackend({ previousOrderIds, nextOrderIds });
    }, 250);
  };

  const clearDragState = () => {
    setDraggedJobId(null);
    setDropTargetJobId(null);
  };

  const handleJobDragStart = (
    event: React.DragEvent<HTMLElement>,
    jobId: string
  ) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", jobId);
    setDraggedJobId(jobId);
    setDropTargetJobId(jobId);
  };

  const handleJobDragOver = (
    event: React.DragEvent<HTMLElement>,
    jobId: string
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropTargetJobId !== jobId) {
      setDropTargetJobId(jobId);
    }
  };

  const handleJobDrop = (
    event: React.DragEvent<HTMLElement>,
    targetJobId: string
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const sourceJobId = draggedJobId || event.dataTransfer.getData("text/plain");
    if (sourceJobId && sourceJobId !== targetJobId) {
      const baselineOrderIds =
        orderedJobIds.length > 0 ? [...orderedJobIds] : orderedJobs.map((job: any) => job._id);
      const nextOrderIds = moveIdBeforeTarget(baselineOrderIds, sourceJobId, targetJobId);
      const hasChanged =
        nextOrderIds.length !== baselineOrderIds.length ||
        nextOrderIds.some((id, index) => id !== baselineOrderIds[index]);

      if (hasChanged) {
        setOrderedJobIds(nextOrderIds);
        scheduleJobOrderSync({
          previousOrderIds: baselineOrderIds,
          nextOrderIds,
        });
      }

      suppressNavigateRef.current = true;
      window.setTimeout(() => {
        suppressNavigateRef.current = false;
      }, 0);
    }

    clearDragState();
  };

  const handleJobClick = (job: any) => {
    if (suppressNavigateRef.current) return;
    navigate(`/job/${job._id}`, { state: { job } });
  };

  const filteredJobs = useMemo(() => {
    return orderedJobs.filter((job: any) => {
      const title = getTranslation(job.title).toLowerCase();
      const company = job.companyId?.name ? getTranslation(job.companyId.name).toLowerCase() : "";
      const matchesSearch = title.includes(searchTerm.toLowerCase()) || company.includes(searchTerm.toLowerCase());
      
      const isActive = job.isActive !== false;
      const matchesStatus = statusFilter === "all" || 
                           (statusFilter === "active" && isActive) || 
                           (statusFilter === "inactive" && !isActive);
      
      return matchesSearch && matchesStatus;
    });
  }, [orderedJobs, searchTerm, statusFilter]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleToggleActive = async (job: any) => {
    try {
      const newStatus = !job.isActive;

      // Backend update validation expects required job fields, not only isActive.
      const payload: any = {
        isActive: newStatus,
        title: toLocalized(job.title, "Untitled Role"),
        description: toLocalized(job.description, ""),
        employmentType: job.employmentType || "full-time",
        workArrangement: job.workArrangement || "on-site",
      };

      if (typeof job.salary === "number") payload.salary = job.salary;
      if (typeof job.salaryVisible === "boolean") payload.salaryVisible = job.salaryVisible;
      if (typeof job.bilingual === "boolean") payload.bilingual = job.bilingual;

      await updateJobMutation.mutateAsync({
        id: job._id,
        data: payload,
      });
      Swal.fire({
        title: "Status Updated",
        text: `Role is now ${newStatus ? "Active" : "Inactive"}`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err: any) {
      const details = err?.response?.data?.details;
      const detailMessage = Array.isArray(details) && details.length > 0 ? details[0]?.message : "";
      Swal.fire("Error", detailMessage || "Failed to update status", "error");
    }
  };

  const handleDelete = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: "Confirm Deletion",
      text: "This action will permanently remove this recruitment mandate.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EF4444",
      confirmButtonText: "Yes, delete mandate"
    });

    if (result.isConfirmed) {
      try {
        await deleteJobMutation.mutateAsync(jobId);
        Swal.fire("Deleted", "Mandate has been purged.", "success");
      } catch (err) {
        Swal.fire("Error", "Purge sequence failed.", "error");
      }
    }
  };

  if (isLoadingJobs) {
    return <LoadingSpinner fullPage message="Accessing Position Registry..." />;
  }

  return (
    <div className="min-h-screen space-y-8 pb-12">
      <PageMeta title="Position Registry | Recruiting" description="Manage job positions and recruitment mandates" />
      
      {/* Header Section */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <PageBreadcrumb pageTitle="Position Registry" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Orchestrating talent acquisition across {jobPositions.length} active mandates
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
             onClick={() => refetchJobs()}
             className={`p-2.5 rounded-xl border border-white/20 bg-white/40 backdrop-blur-md transition-all hover:bg-white/60 dark:border-slate-800/50 dark:bg-slate-900/40 ${isJobFetching ? "animate-spin" : ""}`}
          >
            <RefreshCwIcon className="size-4 text-slate-500" />
          </button>
          
          {canCreate && (
            <button
              onClick={() => navigate("/create-job")}
              className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-brand-500/25 active:scale-95"
            >
              <PlusIcon className="size-4 transition-transform group-hover:rotate-90" />
              Launch New Role
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
            placeholder="Search by title, company, or protocol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border-none bg-white/50 py-2.5 pl-11 pr-4 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-800/50"
          />
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex rounded-lg bg-slate-100/50 p-1 dark:bg-slate-800/50">
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-md p-1.5 transition-all ${viewMode === "grid" ? "bg-white text-brand-600 shadow-sm dark:bg-slate-700" : "text-slate-500 hover:text-slate-700"}`}
            >
              <LayoutGridIcon className="size-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-md p-1.5 transition-all ${viewMode === "list" ? "bg-white text-brand-600 shadow-sm dark:bg-slate-700" : "text-slate-500 hover:text-slate-700"}`}
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
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {isSavingOrder && (
            <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
              Saving order...
            </span>
          )}
        </div>
      </div>

      {/* Content Area */}
      {filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 py-24 dark:border-slate-800">
          <div className="rounded-2xl bg-slate-50 p-6 dark:bg-slate-900/50">
            <BriefcaseIcon className="size-12 text-slate-300 dark:text-slate-700" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-slate-900 dark:text-white">No positions found</h3>
          <p className="mt-2 text-slate-500 dark:text-slate-400">Try adjusting your filters or launch a new role</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filteredJobs.map((job: any) => (
            <div
              key={job._id}
              draggable
              onDragStart={(event) => handleJobDragStart(event, job._id)}
              onDragOver={(event) => handleJobDragOver(event, job._id)}
              onDrop={(event) => handleJobDrop(event, job._id)}
              onDragEnd={clearDragState}
              onClick={() => handleJobClick(job)}
              className={`group relative cursor-grab space-y-4 rounded-3xl border border-white/20 bg-white/60 p-6 backdrop-blur-xl transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-brand-500/10 active:cursor-grabbing dark:border-slate-800/50 dark:bg-slate-900/60 ${
                draggedJobId === job._id ? "opacity-60" : ""
              } ${
                dropTargetJobId === job._id && draggedJobId !== job._id
                  ? "ring-2 ring-brand-400"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center text-slate-400" title="Drag to reorder">
                      <GripVerticalIcon className="size-4" />
                    </span>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      job.isActive !== false ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" :
                      "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400"
                    }`}>
                      {job.isActive !== false ? "Active" : "Deprioritized"}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 transition-colors group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
                    {getTranslation(job.title)}
                  </h3>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                   {canWrite && (
                     <div onClick={(e) => e.stopPropagation()}>
                       <Switch 
                         label="" 
                         checked={job.isActive !== false} 
                         onChange={() => handleToggleActive(job)}
                       />
                     </div>
                   )}
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Building2Icon className="size-4 text-brand-500" />
                  <span className="font-medium truncate">{getTranslation(job.companyId?.name) || "Global Corp"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <MapPinIcon className="size-4" />
                  <span>{job.workArrangement || "Remote / Office"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <CalendarIcon className="size-4" />
                  <span>Created {formatDate(job.createdAt)}</span>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                 
                </div>
                
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {canWrite && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); navigate(`/create-job?id=${job._id}`, { state: { job } }); }}
                      className="p-1.5 text-slate-400 hover:text-brand-600 transition-colors bg-white/80 rounded-lg dark:bg-slate-800"
                    >
                      <PencilIcon className="size-4" />
                    </button>
                  )}
                  {canWrite && (
                    <button 
                      onClick={(e) => handleDelete(e, job._id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors bg-white/80 rounded-lg dark:bg-slate-800"
                    >
                      <Trash2Icon className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/20 bg-white/60 backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/60">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Position Details</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Infrastructure</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Applicants</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {filteredJobs.map((job: any) => (
                <tr
                  key={job._id}
                  draggable
                  onDragStart={(event) => handleJobDragStart(event, job._id)}
                  onDragOver={(event) => handleJobDragOver(event, job._id)}
                  onDrop={(event) => handleJobDrop(event, job._id)}
                  onDragEnd={clearDragState}
                  onClick={() => handleJobClick(job)}
                  className={`group cursor-grab transition-colors hover:bg-slate-50/50 active:cursor-grabbing dark:hover:bg-slate-800/30 ${
                    draggedJobId === job._id ? "opacity-60" : ""
                  } ${
                    dropTargetJobId === job._id && draggedJobId !== job._id
                      ? "bg-brand-50/70 dark:bg-brand-500/10"
                      : ""
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400" title="Drag to reorder">
                        <GripVerticalIcon className="size-4" />
                      </span>
                      <div className="rounded-xl bg-brand-50 p-2.5 dark:bg-brand-500/10">
                        <BriefcaseIcon className="size-5 text-brand-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{getTranslation(job.title)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <Building2Icon className="size-3.5 text-slate-400" />
                        {getTranslation(job.companyId?.name) || "Global Corp"}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPinIcon className="size-3.5" />
                        {job.workArrangement || "Office"}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <span className="text-sm font-medium text-slate-900 dark:text-white">12</span>
                       <span className="text-xs text-slate-500">Candidates</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      job.isActive !== false ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400" :
                      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    }`}>
                      {job.isActive !== false ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white hover:text-brand-600 dark:hover:bg-slate-700">
                        <ArrowRightIcon className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
