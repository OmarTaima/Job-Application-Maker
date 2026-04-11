import { useMemo, useState } from "react";
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



export default function Jobs() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  
  const isAdmin = user?.roleId?.name?.toLowerCase().includes("super admin");
  const canCreate = hasPermission("Job Position Management", "create");
  const canWrite = hasPermission("Job Position Management", "write");

  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

  const filteredJobs = useMemo(() => {
    return jobPositions.filter((job: any) => {
      const title = getTranslation(job.title).toLowerCase();
      const company = job.companyId?.name ? getTranslation(job.companyId.name).toLowerCase() : "";
      const matchesSearch = title.includes(searchTerm.toLowerCase()) || company.includes(searchTerm.toLowerCase());
      
      const isActive = job.isActive !== false;
      const matchesStatus = statusFilter === "all" || 
                           (statusFilter === "active" && isActive) || 
                           (statusFilter === "inactive" && !isActive);
      
      return matchesSearch && matchesStatus;
    });
  }, [jobPositions, searchTerm, statusFilter]);

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
              onClick={() => navigate(`/job/${job._id}`, { state: { job } })}
              className="group relative cursor-pointer space-y-4 rounded-3xl border border-white/20 bg-white/60 p-6 backdrop-blur-xl transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-brand-500/10 dark:border-slate-800/50 dark:bg-slate-900/60"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
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
                  onClick={() => navigate(`/job/${job._id}`, { state: { job } })}
                  className="group cursor-pointer transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
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
                        {job.location || "Office"}
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
