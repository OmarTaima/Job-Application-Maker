import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { 
  useUsers, 
  useRoles, 
  useDeleteUser 
} from "../../../hooks/queries";
import { toPlainString } from "../../../utils/strings";
import { 
  Search, 
  UserPlus, 
  Pencil, 
  Trash2, 
  Mail, 
  Phone, 
  Shield, 
  Building2, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  UserCheck,
  UserMinus,
  ArrowRight
} from "lucide-react";
import Swal from "sweetalert2";

export default function Users() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  // Permissions check
  const canRead = hasPermission("User Management", "read");
  const canCreate = hasPermission("User Management", "create");
  const canWrite = hasPermission("User Management", "write");

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Data fetching
  const { data: usersResponse, isLoading: usersLoading } = useUsers({ page: 1, PageCount: 1000 });
  const { data: roles = [] } = useRoles();
  const deleteUserMutation = useDeleteUser();

  const rawUsers = useMemo(() => {
    if (!usersResponse) return [];
    return Array.isArray(usersResponse)
      ? usersResponse
      : (((usersResponse as any)?.data ?? []) as any[]);
  }, [usersResponse]);

  // Filtering logic
  const filteredUsers = useMemo(() => {
    return rawUsers.filter((user: any) => {
      const nameMatch = toPlainString(user.fullName || user.name || "").toLowerCase().includes(searchTerm.toLowerCase());
      const emailMatch = (user.email || "").toLowerCase().includes(searchTerm.toLowerCase());
      
      const roleId = typeof user.roleId === "string" ? user.roleId : (user.roleId?._id || "");
      const roleMatch = roleFilter === "all" || roleId === roleFilter;
      
      const statusMatch = statusFilter === "all" || 
        (statusFilter === "active" && user.isActive !== false) || 
        (statusFilter === "inactive" && user.isActive === false);

      return (nameMatch || emailMatch) && roleMatch && statusMatch;
    });
  }, [rawUsers, searchTerm, roleFilter, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  const handleDeleteUser = async (user: any) => {
    const result = await Swal.fire({
      title: "Deactivate User?",
      text: `Are you sure you want to remove access for ${toPlainString(user.fullName || user.name)}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, deactivate",
      background: "#1e293b",
      color: "#fff"
    });

    if (result.isConfirmed) {
      try {
        await deleteUserMutation.mutateAsync(user._id);
        Swal.fire({ title: "Deactivated", icon: "success", timer: 1500, showConfirmButton: false });
      } catch (err: any) {
        Swal.fire("Error", err.message || "Failed to deactivate user", "error");
      }
    }
  };

  if (!canRead) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] p-8 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="size-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <Shield className="size-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-black dark:text-white">Access Restricted</h1>
          <p className="text-gray-500 max-w-xs mx-auto font-medium">Your account does not have the necessary clearance to view the personnel directory.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] p-4 sm:p-8 text-slate-900 dark:text-slate-100">
      <PageMeta title="Personnel Directory | Job Application Maker" description="Manage system users and access" />
      <PageBreadcrumb pageTitle="Personnel directory" />

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent tracking-tight">
              Personnel Directory
            </h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400 font-medium italic">Oversee system authentication and organizational access</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <input
                type="text"
                placeholder="Find by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white/60 dark:bg-white/5 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-[1.25rem] focus:ring-2 focus:ring-brand-500/20 outline-none transition-all dark:text-white placeholder:text-gray-400 font-medium"
              />
            </div>
            {canCreate && (
              <button
                onClick={() => navigate("/user/add")}
                className="flex items-center gap-2 px-6 py-3 bg-brand-500 text-white rounded-[1.25rem] font-bold shadow-xl shadow-brand-500/20 hover:scale-105 active:scale-95 transition-all"
              >
                <UserPlus className="size-5" />
                Create User
              </button>
            )}
          </div>
        </div>

        {/* Filters & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3 flex flex-wrap gap-4 items-center bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 p-4 rounded-[2rem] shadow-sm">
            <div className="flex items-center gap-2 px-3 text-gray-400">
              <Filter className="size-4" />
              <span className="text-xs font-black uppercase tracking-widest">Filters</span>
            </div>
            
            <select 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-white dark:bg-black/20 border border-white/20 dark:border-white/5 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500/20 transition-all cursor-pointer"
            >
              <option value="all">All Access Levels</option>
              {roles.map((role) => (
                <option key={role._id} value={role._id}>{toPlainString((role as any).name)}</option>
              ))}
            </select>

            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white dark:bg-black/20 border border-white/20 dark:border-white/5 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500/20 transition-all cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Personnel</option>
              <option value="inactive">Deactivated Accounts</option>
            </select>

            <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-500/10 text-brand-500 rounded-xl border border-brand-500/20">
              <UserCheck className="size-4" />
              <span className="text-sm font-black tabular-nums">{filteredUsers.length} Found</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-brand-500 to-brand-600 p-6 rounded-[2rem] shadow-xl shadow-brand-500/20 flex flex-col justify-between">
            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Global Headcount</span>
            <div className="flex items-end justify-between">
              <span className="text-4xl font-black text-white tabular-nums">{rawUsers.length}</span>
              <Shield className="size-8 text-white/30" />
            </div>
          </div>
        </div>

        {/* User Grid */}
        {usersLoading ? (
          <div className="py-24 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {paginatedUsers.map((user: any) => {
              const roleName = user.roleId?.name || toPlainString((roles.find(r => r._id === (user.roleId?._id || user.roleId)) as any)?.name || "User");
              const isActive = user.isActive !== false;
              
              return (
                <div 
                  key={user._id}
                  onClick={() => navigate(`/user/${user._id}`)}
                  className="group relative bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-[2.5rem] p-6 shadow-sm hover:shadow-2xl transition-all duration-500 cursor-pointer overflow-hidden"
                >
                  {/* Status Indicator Bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 transition-all duration-500 ${isActive ? "bg-green-500/30 group-hover:bg-green-500" : "bg-red-500/30 group-hover:bg-red-500"}`} />
                  
                  <div className="space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="relative">
                        <div className="size-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 flex items-center justify-center text-2xl font-black text-gray-500 dark:text-gray-400 overflow-hidden border border-white/20">
                          {user.fullName?.charAt(0) || user.name?.charAt(0) || "U"}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 size-5 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center ${isActive ? "bg-green-500" : "bg-red-500"}`}>
                          {isActive ? <UserCheck className="size-3 text-white" /> : <UserMinus className="size-3 text-white" />}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-300">
                        {canWrite && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); navigate(`/user/${user._id}/edit`); }}
                            className="size-8 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-all"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        )}
                        {canWrite && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteUser(user); }}
                            className="size-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-lg font-black text-gray-900 dark:text-white line-clamp-1 tracking-tight">
                        {toPlainString(user.fullName || user.name || "Unknown Company")}
                      </h3>
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-400 italic">
                        <Shield className="size-3 text-brand-500" />
                        {roleName}
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/5">
                      <div className="flex items-center gap-3 text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-brand-500 transition-colors">
                        <Mail className="size-4 opacity-50" />
                        <span className="truncate">{user.email}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                        <Phone className="size-4 opacity-50" />
                        <span className="truncate">{user.phone || "No secure line"}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                        <Building2 className="size-4 opacity-50" />
                        <span className="truncate">{user.companies?.length || 0} Companies</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                       <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${isActive ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
                        {isActive ? "Active Duty" : "Revoked"}
                      </span>
                      <div className="flex items-center gap-1 text-brand-500 font-black text-[10px] uppercase tracking-widest group-hover:gap-2 transition-all">
                        Details <ArrowRight className="size-3" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredUsers.length === 0 && (
              <div className="col-span-full py-32 text-center bg-white/40 dark:bg-white/5 backdrop-blur-md border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[3rem]">
                <div className="size-20 rounded-full bg-slate-100 dark:bg-white/5 mx-auto mb-6 flex items-center justify-center">
                  <UserMinus className="size-10 text-slate-300 dark:text-slate-700" />
                </div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white">No Personnel Found</h3>
                <p className="text-gray-500 dark:text-gray-400 font-medium max-w-xs mx-auto mt-2">The search criteria did not match any active or historical records in our directory.</p>
              </div>
            )}
          </div>
        )}

        {/* Pagination Console */}
        {!usersLoading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-10">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="size-12 rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-md border border-white/20 flex items-center justify-center disabled:opacity-30 hover:bg-brand-500 hover:text-white transition-all shadow-sm"
            >
              <ChevronLeft className="size-5" />
            </button>
            <div className="px-6 py-3 bg-white/60 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl font-black tracking-widest text-sm uppercase">
              Phase {page} <span className="opacity-30 mx-2">/</span> {totalPages}
            </div>
            <button 
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="size-12 rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-md border border-white/20 flex items-center justify-center disabled:opacity-30 hover:bg-brand-500 hover:text-white transition-all shadow-sm"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}