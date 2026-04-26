import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import Swal from '../../../utils/swal';
import PageMeta from "../../../components/common/PageMeta";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { ValidationErrorAlert } from "../../../components/common/ValidationErrorAlert";
import {
  useUsers,
  useUpdateUser,
  useRoles,
  usePermissions,
  useCompanies,
  useDepartments,
  useAddUserCompany,
  useRemoveUserCompany,
  useUpdateUserCompanies,
} from "../../../hooks/queries";
import { toPlainString } from "../../../utils/strings";
import { 
  User as UserIcon, 
  Shield, 
  Building2, 
  ChevronLeft, 
  Save, 
  UserCheck,
  Plus,
  Trash2,
  Lock,
  Hash,
  AlertCircle,
  X
} from "lucide-react";

type UserPermission = {
  permission: string;
  access: string[];
};

type UserCompany = {
  relationId: string;
  companyId: string;
  companyName: any;
  departments: string[];
};

export default function EditUser() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Data fetching
  const { data: usersResponse, isLoading: usersLoading, refetch: refetchUsers } = useUsers();
  const rawUsers = Array.isArray(usersResponse) ? usersResponse : ((usersResponse as any)?.data ?? []);
  const { data: roles = [] } = useRoles();
  const { data: permissions = [] } = usePermissions();
  const { data: companies = [] } = useCompanies();
  const { data: departments = [] } = useDepartments();

  // Mutations
  const updateUserMutation = useUpdateUser();
  const addUserCompanyMutation = useAddUserCompany();
  const updateUserCompaniesMutation = useUpdateUserCompanies();
  
  const removeUserCompanyMutation = useRemoveUserCompany();


  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    roleId: "",
    isActive: true,
  });

  const [userCompanies, setUserCompanies] = useState<UserCompany[]>([]);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [permissionToAdd, setPermissionToAdd] = useState("");
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [permissionViewMode, setPermissionViewMode] = useState<"cards" | "matrix">("cards");
  const [permissionSearchTerm, setPermissionSearchTerm] = useState("");
  const [initializedUserId, setInitializedUserId] = useState("");

  // Find user
  const user = useMemo(() => {
    return rawUsers.find((u: any) => u._id === id);
  }, [rawUsers, id]);

  const getDefaultAccessForPermission = (permissionId: string) => {
    const permissionObj = permissions.find((p: any) => p._id === permissionId);
    const actions = Array.isArray(permissionObj?.actions) && permissionObj.actions.length > 0
      ? permissionObj.actions
      : ["read", "write", "create"];

    return Array.from(new Set(actions.map((action: string) => String(action).toLowerCase())));
  };

  const normalizeRolePermissions = (role: any): UserPermission[] => {
    const rawPermissions = Array.isArray(role?.permissions) ? role.permissions : [];
    const merged = new Map<string, Set<string>>();

    rawPermissions.forEach((perm: any) => {
      const permissionId =
        typeof perm === "string"
          ? perm
          : typeof perm?.permission === "string"
            ? perm.permission
            : perm?.permission?._id || "";

      if (!permissionId) return;

      const accessList = Array.isArray(perm?.access) && perm.access.length > 0
        ? perm.access.map((action: string) => String(action).toLowerCase())
        : getDefaultAccessForPermission(permissionId);

      const existing = merged.get(permissionId) || new Set<string>();
      accessList.forEach((action: string) => existing.add(action));
      merged.set(permissionId, existing);
    });

    return Array.from(merged.entries()).map(([permission, accessSet]) => ({
      permission,
      access: Array.from(accessSet),
    }));
  };

  const normalizeUserPermissions = (rawUser: any): UserPermission[] => {
    const raw = Array.isArray(rawUser?.permissions) ? rawUser.permissions : [];
    const merged = new Map<string, Set<string>>();

    raw.forEach((item: any) => {
      const permissionId =
        typeof item === "string"
          ? item
          : typeof item?.permission === "string"
            ? item.permission
            : item?.permission?._id || "";

      if (!permissionId) return;

      const access = Array.isArray(item?.access) && item.access.length > 0
        ? item.access.map((action: string) => String(action).toLowerCase())
        : getDefaultAccessForPermission(permissionId);

      const existing = merged.get(permissionId) || new Set<string>();
      access.forEach((action: string) => existing.add(action));
      merged.set(permissionId, existing);
    });

    return Array.from(merged.entries()).map(([permission, accessSet]) => ({
      permission,
      access: Array.from(accessSet),
    }));
  };

  useEffect(() => {
    if (user && user._id !== initializedUserId) {
      setFormData({
        email: user.email || "",
        password: "", 
        fullName: toPlainString(user.fullName || user.name || ""),
        phone: user.phone || "",
        roleId: typeof user.roleId === "string" ? user.roleId : user.roleId?._id || "",
        isActive: user.isActive !== false,
      });

      // Initialize companies from user data with relationId
      setUserCompanies(user.companies?.map((c: any) => ({
        relationId: c._id,
        companyId: typeof c.companyId === "string" ? c.companyId : c.companyId?._id,
        companyName: c.companyId?.name || "",
        departments: c.departments?.map((d: any) => {
          if (typeof d === "string") return d;
          if (d?._id) return d._id;
          return "";
        }).filter(Boolean) || [],
      })) || []);

      const fromUser = normalizeUserPermissions(user);
      if (fromUser.length > 0) {
        setUserPermissions(fromUser);
      } else {
        const currentRoleId = typeof user.roleId === "string" ? user.roleId : user.roleId?._id;
        const selectedRole = roles.find((role: any) => role._id === currentRoleId);
        setUserPermissions(normalizeRolePermissions(selectedRole));
      }

      setInitializedUserId(user._id);
    }
  }, [user, initializedUserId, roles, permissions]);

  const handleAddCompany = async () => {
    if (!selectedCompanyId) {
      setFormError("Please select a company");
      return;
    }

    // Check if company already exists
    if (userCompanies.some(c => c.companyId === selectedCompanyId)) {
      setFormError("Company already assigned to this user");
      return;
    }

    setIsAddingCompany(true);
    try {
      const result = await addUserCompanyMutation.mutateAsync({
        userId: id!,
        companyId: selectedCompanyId,
        departments: [],
      });
      
      // Get the newly created company access object
      const newCompanyAccess = result as any;
      const relationId = newCompanyAccess?.data?._id || newCompanyAccess?._id;
      
      const selectedCompany = companies.find((c: any) => c._id === selectedCompanyId);
      setUserCompanies(prev => [...prev, {
        relationId: relationId,
        companyId: selectedCompanyId,
        companyName: selectedCompany?.name || "",
        departments: [],
      }]);
      
      setSelectedCompanyId("");
      await Swal.fire({
        title: "Success",
        text: "Company access added successfully",
        icon: "success",
        background: "rgba(255, 255, 255, 0.9)",
        backdrop: "rgba(0,0,0,0.4)",
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err: any) {
      setFormError(err.message || "Failed to add company access");
    } finally {
      setIsAddingCompany(false);
    }
  };

const handleUpdateDepartments = async (relationId: string, departments: string[]) => {
  try {
    await updateUserCompaniesMutation.mutateAsync({
      userId: id!,
      companyId: relationId,  
      data: { departments },
    });
    // ... rest
  } catch (err: any) {
    setFormError(err.message || "Failed to update departments");
  }
};

 const handleRemoveCompany = async (relationId: string) => {
  const result = await Swal.fire({
    title: "Remove Company Access",
    text: "Are you sure you want to remove this company access?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, remove it!"
  });

  if (result.isConfirmed) {
    try {
      await removeUserCompanyMutation.mutateAsync({
        userId: id!,
        companyId: relationId,
      });
      
      setUserCompanies(prev => prev.filter(c => c.relationId !== relationId));
      
      await Swal.fire({
        title: "Removed",
        text: "Company access has been removed successfully",
        icon: "success",
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err: any) {
      setFormError(err.message || "Failed to remove company access");
    }
  }
};

  const handleRoleChange = (nextRoleId: string) => {
    setFormData((prev) => ({ ...prev, roleId: nextRoleId }));
    const selectedRole = roles.find((role: any) => role._id === nextRoleId);
    setUserPermissions(normalizeRolePermissions(selectedRole));
    setPermissionToAdd("");
  };

  const availablePermissions = useMemo(() => {
    const selectedIds = new Set(userPermissions.map((item) => item.permission));
    return permissions.filter((perm: any) => !selectedIds.has(perm._id));
  }, [permissions, userPermissions]);

  const selectedPermissionMap = useMemo(() => {
    return new Map(userPermissions.map((item) => [item.permission, item.access]));
  }, [userPermissions]);

  const filteredPermissionCatalog = useMemo(() => {
    const term = permissionSearchTerm.trim().toLowerCase();
    if (!term) return permissions;
    return permissions.filter((perm: any) =>
      toPlainString(perm.name || "").toLowerCase().includes(term)
    );
  }, [permissions, permissionSearchTerm]);

  const handleAddPermission = () => {
    if (!permissionToAdd) return;

    setUserPermissions((prev) => {
      if (prev.some((item) => item.permission === permissionToAdd)) return prev;
      return [
        ...prev,
        {
          permission: permissionToAdd,
          access: getDefaultAccessForPermission(permissionToAdd),
        },
      ];
    });
    setPermissionToAdd("");
  };

  const handleRemovePermission = (permissionId: string) => {
    setUserPermissions((prev) => prev.filter((item) => item.permission !== permissionId));
  };

  const handleTogglePermissionAccess = (permissionId: string, action: string) => {
    setUserPermissions((prev) =>
      prev.map((item) => {
        if (item.permission !== permissionId) return item;
        const hasAccess = item.access.includes(action);
        return {
          ...item,
          access: hasAccess
            ? item.access.filter((acc) => acc !== action)
            : [...item.access, action],
        };
      })
    );
  };

  const setPermissionSelection = (permissionId: string, selected: boolean) => {
    if (selected) {
      setUserPermissions((prev) => {
        if (prev.some((item) => item.permission === permissionId)) return prev;
        return [
          ...prev,
          {
            permission: permissionId,
            access: getDefaultAccessForPermission(permissionId),
          },
        ];
      });
      return;
    }

    handleRemovePermission(permissionId);
  };

  const setPermissionAction = (permissionId: string, action: string, enabled: boolean) => {
    setUserPermissions((prev) => {
      const existing = prev.find((item) => item.permission === permissionId);

      if (!existing) {
        if (!enabled) return prev;
        return [...prev, { permission: permissionId, access: [action] }];
      }

      const nextAccess = enabled
        ? Array.from(new Set([...existing.access, action]))
        : existing.access.filter((acc) => acc !== action);

      return prev.map((item) =>
        item.permission === permissionId ? { ...item, access: nextAccess } : item
      );
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsSaving(true);

    try {
      if (!formData.fullName || !formData.email || !formData.roleId) {
        throw new Error("Core identification fields are required.");
      }

      // Update basic user info and permissions
      await updateUserMutation.mutateAsync({
        id: id!,
        data: {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          roleId: formData.roleId,
          isActive: formData.isActive,
          permissions: userPermissions.map((item) => ({
            permission: item.permission,
            access: item.access,
          }))
        }
      });

      await Swal.fire({
        title: "Success",
        text: "User profile has been updated within the system records.",
        icon: "success",
        background: "rgba(255, 255, 255, 0.9)",
        backdrop: "rgba(0,0,0,0.4)"
      });
      
      // Refetch users to get updated data
      await refetchUsers();
      navigate("/users");
    } catch (err: any) {
      setFormError(err.message || "Credential validation failed.");
    } finally {
      setIsSaving(false);
    }
  };

  if (usersLoading) return <LoadingSpinner fullPage />;

  // Get available companies (not yet assigned to user)
  const availableCompanies = companies.filter(
    (c: any) => !userCompanies.some(uc => uc.companyId === c._id)
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] p-4 sm:p-8">
      <PageMeta title={`Modify User - ${toPlainString(formData.fullName)}`} description="Update personnel credentials and organizational access" />
      
      <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate("/users")}
            className="group flex items-center gap-3 transition-all"
          >
            <div className="size-12 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl flex items-center justify-center shadow-sm group-hover:-translate-x-1 group-hover:bg-brand-500 group-hover:text-white transition-all">
              <ChevronLeft className="size-5" />
            </div>
            <span className="font-black text-xs uppercase tracking-widest text-gray-400 group-hover:text-brand-500 transition-colors">Back to Users</span>
          </button>
        </div>

        <div className="relative overflow-hidden bg-white/60 dark:bg-white/5 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-[3.5rem] p-10 shadow-2xl">
           <div className="absolute -top-20 -right-20 p-20 opacity-5 pointer-events-none">
             <UserIcon className="size-80" />
           </div>

           <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 mb-12">
             <div className="size-28 rounded-[2rem] bg-gradient-to-br from-brand-500/10 to-purple-500/10 border-2 border-brand-500/20 flex items-center justify-center text-4xl font-black text-brand-500 shadow-xl">
               {toPlainString(formData.fullName)?.charAt(0) || <Hash className="size-8" />}
             </div>
             <div className="text-center md:text-left space-y-2">
               <h1 className="text-4xl font-black tracking-tight dark:text-white">Modify Credential</h1>
               <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] italic">Personnel ID: {id?.slice(-8).toUpperCase()}</p>
             </div>
           </div>

           {formError && (
             <div className="mb-10">
               <ValidationErrorAlert error={formError} onDismiss={() => setFormError("")} />
             </div>
           )}

           <form onSubmit={handleSubmit} className="space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-8">
                  <h3 className="text-lg font-black flex items-center gap-2 mb-6 tracking-tight">
                    <Shield className="size-5 text-brand-500" />
                    Personal Information
                  </h3>
                  
                  <div className="space-y-6">
                    <div className="group space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                         Full Name
                      </label>
                      <input 
                        type="text" 
                        value={formData.fullName} 
                        onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                        className="w-full px-6 py-4 bg-white/40 dark:bg-black/20 border-2 border-slate-100 dark:border-white/5 rounded-2xl focus:border-brand-500/50 focus:ring-4 focus:ring-brand-500/5 outline-none transition-all font-bold dark:text-white"
                        placeholder="John Doe"
                      />
                    </div>

                    <div className="group space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                         Email
                      </label>
                      <input 
                        type="email" 
                        value={formData.email} 
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full px-6 py-4 bg-white/40 dark:bg-black/20 border-2 border-slate-100 dark:border-white/5 rounded-2xl focus:border-brand-500/50 focus:ring-4 focus:ring-brand-500/5 outline-none transition-all font-bold dark:text-white"
                        placeholder="j.doe@network.com"
                      />
                    </div>

                    <div className="group space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                          Phone
                      </label>
                      <input 
                        type="text" 
                        value={formData.phone} 
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full px-6 py-4 bg-white/40 dark:bg-black/20 border-2 border-slate-100 dark:border-white/5 rounded-2xl focus:border-brand-500/50 focus:ring-4 focus:ring-brand-500/5 outline-none transition-all font-bold dark:text-white"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <h3 className="text-lg font-black flex items-center gap-2 mb-6 tracking-tight">
                    <Lock className="size-5 text-purple-500" />
                    Security Access Level
                  </h3>
                  
                  <div className="space-y-8 p-8 bg-slate-50/50 dark:bg-white/5 rounded-[2.5rem] border border-slate-100 dark:border-white/5">
                    <div className="group space-y-4">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Assigned Security Role</label>
                      <select 
                        value={formData.roleId} 
                        onChange={(e) => handleRoleChange(e.target.value)}
                        className="w-full px-6 py-4 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-white/5 rounded-2xl focus:border-purple-500 outline-none transition-all font-bold dark:text-white appearance-none cursor-pointer"
                      >
                        <option value="">Select Role Level</option>
                        {roles.map((r: any) => (
                          <option key={r._id} value={r._id}>{toPlainString(r.name)}</option>
                        ))}
                      </select>
                    </div>

                    <div className="pt-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Profile Activity Status</label>
                        <p className="text-xs font-bold text-slate-500 italic">Toggle to revoke system-wide access</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                        className={`relative w-16 h-8 rounded-full transition-all duration-300 ${formData.isActive ? "bg-green-500 shadow-lg shadow-green-500/20" : "bg-slate-200 dark:bg-slate-700"}`}
                      >
                        <div className={`absolute top-1 size-6 bg-white rounded-full shadow-md transition-all duration-300 ${formData.isActive ? "left-9" : "left-1"}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Permissions Section */}
              <div className="space-y-6 p-10 bg-purple-500/5 dark:bg-purple-500/10 rounded-[4rem] border border-purple-500/15">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-xl font-black tracking-tight flex items-center gap-3">
                    <Shield className="size-6 text-purple-500" />
                    Permission Control Center
                  </h3>
                  <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-black/20 rounded-xl border border-slate-200 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setPermissionViewMode("cards")}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                        permissionViewMode === "cards"
                          ? "bg-white dark:bg-slate-900 text-brand-500 shadow"
                          : "text-slate-500"
                      }`}
                    >
                      Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermissionViewMode("matrix")}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                        permissionViewMode === "matrix"
                          ? "bg-white dark:bg-slate-900 text-brand-500 shadow"
                          : "text-slate-500"
                      }`}
                    >
                      Matrix
                    </button>
                  </div>
                </div>

                {permissionViewMode === "cards" && (
                  <>
                    <div className="flex gap-2">
                      <select
                        value={permissionToAdd}
                        onChange={(e) => setPermissionToAdd(e.target.value)}
                        className="flex-1 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-xl font-bold dark:text-white"
                      >
                        <option value="">Add permission module</option>
                        {availablePermissions.map((perm: any) => (
                          <option key={perm._id} value={perm._id}>
                            {toPlainString(perm.name)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddPermission}
                        disabled={!permissionToAdd}
                        className="px-4 py-3 bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>

                    <div className="space-y-3">
                      {userPermissions.map((permItem) => {
                        const permObj = permissions.find((perm: any) => perm._id === permItem.permission);
                        const actions = Array.from(
                          new Set([
                            "read",
                            "write",
                            "create",
                            ...getDefaultAccessForPermission(permItem.permission),
                            ...permItem.access,
                          ])
                        );

                        return (
                          <div
                            key={permItem.permission}
                            className="p-4 bg-white/60 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5"
                          >
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <p className="text-sm font-black tracking-tight dark:text-white">
                                {toPlainString(permObj?.name || "Unknown Permission")}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleRemovePermission(permItem.permission)}
                                className="size-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                              >
                                <X className="size-4" />
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {actions.map((action) => {
                                const active = permItem.access.includes(action);
                                return (
                                  <button
                                    key={`${permItem.permission}-${action}`}
                                    type="button"
                                    onClick={() => handleTogglePermissionAccess(permItem.permission, action)}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                      active
                                        ? "bg-brand-500 text-white"
                                        : "bg-white dark:bg-white/5 text-gray-400"
                                    }`}
                                  >
                                    {action}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      {userPermissions.length === 0 && (
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 italic px-1">
                          Select a role to preload permissions, then adjust as needed.
                        </p>
                      )}
                    </div>
                  </>
                )}

                {permissionViewMode === "matrix" && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={permissionSearchTerm}
                      onChange={(e) => setPermissionSearchTerm(e.target.value)}
                      placeholder="Search permission module"
                      className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-xl font-bold dark:text-white"
                    />

                    <div className="rounded-2xl border border-slate-100 dark:border-white/5 overflow-x-auto">
                      <table className="w-full text-xs min-w-[620px]">
                        <thead className="bg-slate-50 dark:bg-slate-900/90">
                          <tr>
                            <th className="text-left px-3 py-2 font-black uppercase tracking-widest text-[10px] text-slate-400">Module</th>
                            <th className="text-center px-2 py-2 font-black uppercase tracking-widest text-[10px] text-slate-400">Use</th>
                            <th className="text-center px-2 py-2 font-black uppercase tracking-widest text-[10px] text-slate-400">Read</th>
                            <th className="text-center px-2 py-2 font-black uppercase tracking-widest text-[10px] text-slate-400">Write</th>
                            <th className="text-center px-2 py-2 font-black uppercase tracking-widest text-[10px] text-slate-400">Create</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPermissionCatalog.map((perm: any) => {
                            const permissionId = String(perm._id);
                            const selectedAccess = selectedPermissionMap.get(permissionId) || [];
                            const isSelected = selectedPermissionMap.has(permissionId);
                            return (
                              <tr key={permissionId} className="border-t border-slate-100 dark:border-white/5">
                                <td className="px-3 py-2 font-bold dark:text-white">{toPlainString(perm.name)}</td>
                                <td className="px-2 py-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => setPermissionSelection(permissionId, e.target.checked)}
                                    className="size-4 accent-brand-500"
                                  />
                                </td>
                                {["read", "write", "create"].map((action) => (
                                  <td key={`${permissionId}-${action}`} className="px-2 py-2 text-center">
                                    <input
                                      type="checkbox"
                                      disabled={!isSelected}
                                      checked={selectedAccess.includes(action)}
                                      onChange={(e) => setPermissionAction(permissionId, action, e.target.checked)}
                                      className="size-4 accent-brand-500 disabled:opacity-40"
                                    />
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Company Selection Section */}
              <div className="space-y-8 p-10 bg-brand-500/5 dark:bg-brand-500/10 rounded-[4rem] border border-brand-500/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black flex items-center gap-3 tracking-tight">
                    <Building2 className="size-6 text-brand-500" />
                    Company Access Management
                  </h3>
                </div>

                {/* Add Company Section */}
                <div className="flex gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Add Company Access
                    </label>
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-xl font-bold dark:text-white"
                    >
                      <option value="">Select Company</option>
                      {availableCompanies.map((c: any) => (
                        <option key={c._id} value={c._id}>{toPlainString(c.name)}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCompany}
                    disabled={isAddingCompany || !selectedCompanyId}
                    className="px-6 py-3 bg-brand-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {isAddingCompany ? (
                      <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                  </button>
                </div>

                {/* Existing Companies List */}
                <div className="space-y-4">
                  {userCompanies.map((assignment) => {
                    // Get departments for this specific company
                    const companyDepartments = departments.filter((d: any) => {
                      const deptCompanyId = typeof d.companyId === "string" ? d.companyId : d.companyId?._id;
                      return deptCompanyId === assignment.companyId;
                    });

                    return (
                      <div key={assignment.relationId} className="relative group bg-white dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm">
                        <button 
                          type="button" 
                          onClick={() => handleRemoveCompany(assignment.relationId)}
                          className="absolute -top-3 -right-3 size-8 bg-red-500 text-white rounded-xl items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex shadow-lg hover:rotate-12"
                        >
                          <Trash2 className="size-4" />
                        </button>

                        <div className="space-y-4">
                          <h4 className="text-lg font-black dark:text-white">
                            {toPlainString(assignment.companyName)}
                          </h4>
                          
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                              Department Access
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {companyDepartments.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">No departments available for this company</p>
                              ) : (
                                companyDepartments.map((dept: any) => {
                                  const isSelected = assignment.departments?.includes(dept._id);
                                  return (
                                    <button
                                      key={dept._id}
                                      type="button"
                                      onClick={() => {
                                        const newDepartments = isSelected
                                          ? assignment.departments.filter((id: string) => id !== dept._id)
                                          : [...(assignment.departments || []), dept._id];
                                        handleUpdateDepartments(assignment.relationId, newDepartments);
                                      }}
                                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                                        isSelected
                                          ? "bg-brand-500 text-white"
                                          : "bg-white dark:bg-white/5 text-gray-400 hover:bg-brand-500/20"
                                      }`}
                                    >
                                      {toPlainString(dept.name)}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {userCompanies.length === 0 && (
                    <div className="text-center py-12 bg-white/30 dark:bg-black/10 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/10">
                      <AlertCircle className="size-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-400 font-bold text-sm">No company access assigned to this user.</p>
                      <p className="text-slate-400 text-xs mt-1">Use the dropdown above to add company access.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-10 border-t border-slate-100 dark:border-white/10">
                <div className="space-y-1 text-center sm:text-left">
                  <p className="text-xs font-black dark:text-white flex items-center gap-2">
                    <UserCheck className="size-4 text-green-500" /> Authorized Personnel Update
                  </p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest italic">Proceed with caution • All modifications are logged</p>
                </div>
                
                <div className="flex items-center gap-4">
                  <button 
                    type="button"
                    onClick={() => navigate("/users")}
                    className="px-8 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="flex items-center gap-3 px-10 py-4 bg-brand-500 text-white rounded-[2rem] font-black tracking-widest uppercase text-xs shadow-xl shadow-brand-500/30 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {isSaving ? (
                      <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save className="size-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
           </form>
        </div>
      </div>
    </div>
  );
}