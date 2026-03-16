import type { ChangeEvent, FormEvent } from "react";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import Swal from "sweetalert2";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import { PlusIcon, PencilIcon, TrashBinIcon } from "../../../icons";
import { useRoles, usePermissions, useCreateRole, useUsers, useDeleteRole } from "../../../hooks/queries";
import type { User } from "../../../services/usersService";
import type { CreateRoleRequest } from "../../../services/rolesService";
import { toPlainString } from "../../../utils/strings";
import { Search, Shield, Users, Calendar, ArrowRight, X } from "lucide-react";

type RoleForm = {
  name: string;
  description: string;
  permissions: string[];
  isSystemRole?: boolean;
  singleCompany?: boolean;
};

const defaultRoleForm: RoleForm = {
  name: "",
  description: "",
  permissions: [],
  isSystemRole: false,
  singleCompany: false,
};

export default function Permissions() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  // Check permissions
  const canRead = hasPermission("Role Management", "read");
  const canCreate = hasPermission("Role Management", "create");

  // React Query hooks - data fetching happens automatically
  const { data: roles = [], isLoading: rolesLoading} = useRoles();
  const { data: permissions = [], isLoading: permissionsLoading } =
    usePermissions();
  const { data: usersData, isLoading: usersLoading } = useUsers();
  const users: User[] = Array.isArray(usersData) ? usersData : ((usersData as any)?.data ?? []) as User[];

  // Mutations
  const createRoleMutation = useCreateRole();
  const deleteRoleMutation = useDeleteRole();

  // Calculate user counts per role
  const roleUserCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach((user: User) => {
      const userRoleId = typeof user.roleId === "string" ? user.roleId : (user.roleId as any)?._id;
      if (userRoleId) {
        counts[userRoleId] = (counts[userRoleId] || 0) + 1;
      }
    });
    return counts;
  }, [users]);

  const [roleForm, setRoleForm] = useState<RoleForm>(defaultRoleForm);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Helper function to extract detailed error messages
  const getErrorMessage = (err: any): string => {
    if (err.response?.data?.details && Array.isArray(err.response.data.details)) {
      return err.response.data.details
        .map((detail: any) => {
          const field = detail.path?.[0] || "";
          const message = detail.message || "";
          return field ? `${field}: ${message}` : message;
        })
        .join(", ");
    }
    if (err.response?.data?.errors) {
      const errors = err.response.data.errors;
      if (Array.isArray(errors)) return errors.map((e: any) => e.msg || e.message).join(", ");
      if (typeof errors === "object") return Object.entries(errors).map(([field, msg]) => `${field}: ${msg}`).join(", ");
    }
    if (err.response?.data?.message) return err.response.data.message;
    if (err.message) return err.message;
    return "An unexpected error occurred";
  };

  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [permissionAccess, setPermissionAccess] = useState<Record<string, string[]>>({});

  // Role handlers
  const handleRoleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRoleForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePermissionToggle = (permId: string) => {
    setSelectedPermissions((prev) => {
      if (prev.includes(permId)) {
        const newPerms = prev.filter((id) => id !== permId);
        setPermissionAccess((prevAccess) => {
          const newAccess = { ...prevAccess };
          delete newAccess[permId];
          return newAccess;
        });
        return newPerms;
      } else {
        const permission = permissions.find((p) => p._id === permId);
        const defaultActions = permission?.actions || ["read", "write", "create"];
        setPermissionAccess((prevAccess) => ({ ...prevAccess, [permId]: defaultActions }));
        return [...prev, permId];
      }
    });
  };

  const handleAccessToggleForPermission = (permId: string, access: string) => {
    setPermissionAccess((prev) => {
      const currentAccess = prev[permId] || [];
      const newAccess = currentAccess.includes(access)
        ? currentAccess.filter((a) => a !== access)
        : [...currentAccess, access];
      return { ...prev, [permId]: newAccess };
    });
  };

  const handleRoleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const permissionsWithAccess = selectedPermissions.map((permId) => ({
      permission: permId,
      access: permissionAccess[permId] || [],
    }));
    const payload = { name: roleForm.name, permissions: permissionsWithAccess };

    try {
      await createRoleMutation.mutateAsync(payload as CreateRoleRequest);
      await Swal.fire({
        title: "Success!",
        text: "Role created successfully.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      setRoleForm(defaultRoleForm);
      setSelectedPermissions([]);
      setPermissionAccess({});
      setShowRoleForm(false);
    } catch (err: any) {
      setFormError(getErrorMessage(err));
    }
  };

  const filteredRoles = useMemo(() => {
    if (!searchTerm) return roles;
    return roles.filter((role) => 
      toPlainString((role as any).name).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [roles, searchTerm]);

  if (!canRead) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] p-4 sm:p-8">
        <PageMeta title="Permissions & Roles | Job Application Maker" description="Manage roles and permissions" />
        <PageBreadcrumb pageTitle="Permissions & Roles" />
        <div className="mt-12 flex flex-col items-center justify-center rounded-[2.5rem] bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 p-12 shadow-xl">
          <div className="p-6 rounded-full bg-red-100 dark:bg-red-900/20 mb-6">
            <Shield className="size-16 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">Access Denied</p>
          <p className="mt-2 text-gray-500 dark:text-gray-400">You don't have permission to view roles and permissions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] p-4 sm:p-8 text-slate-900 dark:text-slate-100">
      <PageMeta title="Permissions & Roles | Job Application Maker" description="Manage roles and permissions" />
      <PageBreadcrumb pageTitle="Permissions & Roles" />

      {rolesLoading || permissionsLoading || usersLoading ? (
        <LoadingSpinner fullPage message="Loading permissions..." />
      ) : (
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header & Stats */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                Roles & Permissions
              </h1>
              <p className="mt-1 text-gray-500 dark:text-gray-400 font-medium tracking-tight">Manage user groups and access levels across the system</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search roles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white/60 dark:bg-white/5 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-[1.25rem] focus:ring-2 focus:ring-brand-500/20 outline-none transition-all dark:text-white placeholder:text-gray-400"
                />
              </div>
              {canCreate && (
                <button
                  onClick={() => setShowRoleForm(!showRoleForm)}
                  className={`group relative flex items-center gap-2 px-6 py-3 rounded-[1.25rem] overflow-hidden transition-all duration-300 shadow-lg ${
                    showRoleForm 
                    ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10" 
                    : "bg-brand-500 text-white hover:shadow-brand-500/20"
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                  {showRoleForm ? <X className="size-4" /> : <PlusIcon className="size-5" />}
                  <span className="font-bold tracking-tight">{showRoleForm ? "Close Form" : "Create Role"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { label: "Total Roles", value: roles.length, icon: Shield, color: "text-brand-500", bg: "bg-brand-500/10" },
              { label: "Active Users", value: users.length, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
              { label: "Perm Modules", value: permissions.length, icon: Shield, color: "text-purple-500", bg: "bg-purple-500/10" },
            ].map((stat, idx) => (
              <div key={idx} className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 p-5 rounded-[2.5rem] flex items-center gap-5 transition-all hover:scale-[1.02] hover:bg-white/80 dark:hover:bg-white/10 shadow-sm hover:shadow-md">
                <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} shadow-inner`}>
                  <stat.icon className="size-7" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">{stat.label}</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Create Role Form */}
          {showRoleForm && (
            <div className="relative overflow-hidden bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-brand-500/30 rounded-[3rem] shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 p-8 sm:p-12">
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                <Shield className="size-64" />
              </div>
              <form onSubmit={handleRoleSubmit} className="relative z-10 space-y-10">
                <div className="flex flex-col gap-2">
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Role Configuration</h3>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">Define a new access group for your team members</p>
                </div>

                {formError && (
                  <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-[1.5rem] flex items-center justify-between animate-in zoom-in-95 duration-200">
                    <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-3 font-medium">
                      <span className="size-6 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold">!</span>
                      {formError}
                    </p>
                    <button type="button" onClick={() => setFormError("")} className="text-red-400 hover:text-red-600 transition-colors">
                      <X className="size-5" />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-3">
                    <Label htmlFor="roleName" className="text-sm font-bold ml-2 text-gray-700 dark:text-gray-300">Company Identifier</Label>
                    <Input
                      id="roleName"
                      name="name"
                      value={roleForm.name}
                      onChange={handleRoleInputChange}
                      placeholder="e.g. Senior Recruiter"
                      className="!rounded-[1.25rem] !py-4 !px-6 !bg-white/40 dark:!bg-black/20 !border-white/20 !text-lg !font-semibold focus:!border-brand-500/50 outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-700"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between px-3">
                    <Label className="text-sm font-bold text-gray-700 dark:text-gray-300">Authorized Capabilities Matrix</Label>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedPermissions.length === permissions.length) {
                          setSelectedPermissions([]);
                          setPermissionAccess({});
                        } else {
                          setSelectedPermissions(permissions.map(p => p._id));
                          const allAccess: Record<string, string[]> = {};
                          permissions.forEach(p => {
                            allAccess[p._id] = p.actions || ["read", "write", "create"];
                          });
                          setPermissionAccess(allAccess);
                        }
                      }}
                      className="text-xs font-bold text-brand-500 hover:text-brand-600 transition-all hover:underline underline-offset-4 decoration-2"
                    >
                      {selectedPermissions.length === permissions.length ? "Deselect All Modules" : "Full Access Selection"}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {permissions.map((perm) => {
                      const isSelected = selectedPermissions.includes(perm._id);
                      return (
                        <div 
                          key={perm._id}
                          className={`group p-5 rounded-[2rem] border transition-all duration-300 ${
                            isSelected 
                            ? "bg-brand-500/[0.07] border-brand-500/40 shadow-sm" 
                            : "bg-white/40 dark:bg-black/20 border-white/20 hover:border-brand-500/30"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className="pt-1.5">
                              <div className="relative size-6">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handlePermissionToggle(perm._id)}
                                  className="peer appearance-none size-6 rounded-lg border-2 border-slate-300 dark:border-slate-600 checked:bg-brand-500 checked:border-brand-500 transition-all cursor-pointer"
                                />
                                <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                  <path d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            </div>
                            <div className="flex-1 space-y-4">
                              <div className="cursor-pointer" onClick={() => handlePermissionToggle(perm._id)}>
                                <h4 className={`text-base font-bold transition-colors ${isSelected ? "text-brand-600 dark:text-brand-400" : "text-gray-900 dark:text-white"}`}>
                                  {perm.name}
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium leading-relaxed italic">
                                  {perm.description || "Operational unit access configuration"}
                                </p>
                              </div>

                              {isSelected && (
                                <div className="flex flex-wrap gap-2 animate-in slide-in-from-left-2 duration-300">
                                  {(perm.actions || ["read", "write", "create"]).map((action) => {
                                    const isAccessActive = permissionAccess[perm._id]?.includes(action);
                                    return (
                                      <label
                                        key={action}
                                        className={`px-3.5 py-1.5 text-[10px] font-black tracking-widest uppercase rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                                          isAccessActive
                                          ? "bg-brand-500 text-white border-brand-500 shadow-md shadow-brand-500/20"
                                          : "bg-transparent text-gray-500 dark:text-gray-400 border-slate-200 dark:border-slate-800 hover:border-brand-500/40"
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          className="hidden"
                                          checked={isAccessActive}
                                          onChange={() => handleAccessToggleForPermission(perm._id, action)}
                                        />
                                        {action}
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-5 pt-8 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowRoleForm(false)}
                    className="px-6 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors tracking-tight"
                  >
                    Discard Changes
                  </button>
                  <button
                    type="submit"
                    className="px-10 py-4 text-sm font-black bg-brand-500 text-white rounded-[1.25rem] shadow-xl shadow-brand-500/30 hover:bg-brand-600 transition-all hover:scale-105 active:scale-95 tracking-widest uppercase"
                  >
                    Deploy Company
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Roles Repository */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3 tracking-tight">
                <div className="size-2 bg-brand-500 rounded-full" />
                Active Roles
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredRoles.map((role) => {
                const userCount = roleUserCounts[role._id] || 0;
                const roleName = toPlainString((role as any).name);
                
                return (
                  <div 
                    key={role._id}
                    onClick={() => navigate(`/role/${role._id}`)}
                    className="group relative bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-[3rem] p-8 shadow-sm hover:shadow-2xl transition-all duration-500 cursor-pointer overflow-hidden border-b-4 border-b-transparent hover:border-b-brand-500/30"
                  >
                    {/* Background Visual Accent */}
                    <div className="absolute -top-12 -right-12 size-48 bg-gradient-to-br from-brand-500/10 to-transparent rounded-full group-hover:scale-125 transition-transform duration-700 blur-2xl" />
                    
                    <div className="relative z-10 space-y-8">
                      <div className="flex justify-between items-center">
                        <div className="size-14 rounded-2xl bg-white dark:bg-white/10 shadow-xl border border-white/20 flex items-center justify-center transition-transform group-hover:-rotate-6">
                          <Shield className="size-7 text-brand-500" />
                        </div>
                        <div onClick={(e) => e.stopPropagation()} className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-300">
                          {canCreate && (
                            <button
                              onClick={() => navigate(`/role/${role._id}?edit=true`)}
                              className="size-10 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-all shadow-sm"
                            >
                              <PencilIcon className="size-4" />
                            </button>
                          )}
                          {canCreate && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const result = await Swal.fire({
                                  title: "Confirm Deletion",
                                  text: `All ${userCount} associated users will be disconnected.`,
                                  icon: "error",
                                  showCancelButton: true,
                                  confirmButtonColor: "#ef4444",
                                  confirmButtonText: "Proceed",
                                  background: "#1e293b",
                                  color: "#fff"
                                });

                                if (result.isConfirmed) {
                                  try {
                                    await deleteRoleMutation.mutateAsync(role._id);
                                    await Swal.fire({ title: "Removed", icon: "success", timer: 1500, showConfirmButton: false });
                                  } catch (err: any) {
                                    Swal.fire({ title: "Error", text: getErrorMessage(err), icon: "error" });
                                  }
                                }
                              }}
                              className="size-10 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all shadow-sm"
                            >
                              <TrashBinIcon className="size-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white group-hover:text-brand-500 transition-colors tracking-tight">
                          {roleName}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed line-clamp-2 h-10">
                          {role.description || "Standard Company profile with specialized functional module permissions."}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100 dark:border-white/5">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Capability</span>
                          <span className="text-sm font-black text-slate-700 dark:text-slate-200 tracking-tight">
                            {role.permissionsCount || role.permissions?.length || 0} Modules
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 border-l border-slate-100 dark:border-white/5 pl-4">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Reach</span>
                          <span className="text-sm font-black text-slate-700 dark:text-slate-200 tracking-tight">{userCount} Active Users</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                          <Calendar className="size-3" />
                          {role.createdAt ? new Date(role.createdAt).toLocaleDateString() : "System Base"}
                        </div>
                        <div className="flex items-center gap-1 text-brand-500 font-black text-xs uppercase tracking-[0.15em] group-hover:gap-3 transition-all duration-300">
                          Investigate
                          <ArrowRight className="size-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredRoles.length === 0 && (
                <div className="col-span-full py-24 text-center bg-white/40 dark:bg-white/5 backdrop-blur-md border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[3rem]">
                  <div className="size-20 rounded-full bg-slate-100 dark:bg-white/5 mx-auto mb-6 flex items-center justify-center">
                    <Shield className="size-10 text-slate-300 dark:text-slate-700" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">No Matching Profiles</h3>
                  <p className="text-gray-500 dark:text-gray-400 font-medium max-w-xs mx-auto mt-2">Adjust your search parameters to locate specific role identities.</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Permissions Audit Section */}
          <div className="space-y-8 pt-16 border-t border-slate-200 dark:border-white/5">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3 tracking-tight">
                <div className="size-2 bg-purple-500 rounded-full" />
                Permissions
              </h2>
            </div>
            
            <div className="overflow-hidden bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-[3rem] shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-white/5">
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Functional Domain</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Contextual Boundary</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Authorized Vectors</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Lifecycle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {permissions.map((permission) => (
                      <tr key={permission._id} className="hover:bg-brand-500/[0.03] transition-colors group">
                        <td className="px-8 py-5">
                          <span className="font-black text-base text-gray-900 dark:text-white group-hover:text-brand-500 transition-colors tracking-tight">
                            {permission.name}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-sm font-medium text-gray-500 dark:text-gray-400 italic">
                          {permission.description || "Core platform operational scope"}
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex flex-wrap gap-2">
                            {permission.actions?.map((action: string) => (
                              <span
                                key={action}
                                className="px-3 py-1 text-[9px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-lg"
                              >
                                {action}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {permission.createdAt ? new Date(permission.createdAt).toLocaleDateString() : "Internal"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
