import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import Swal from '../../../utils/swal';
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
// Label was unused — removed during refactor
import Input from "../../../components/form/input/InputField";
import {
  useRoles,
  usePermissions,
  useUpdateRole,
  useUsers,
  useDeleteRole,
} from "../../../hooks/queries";
import { toPlainString } from "../../../utils/strings";
import { 
  Shield, 
  Users, 
  ChevronLeft, 
  Pencil, 
  Trash2, 
  CheckCircle2, 
  ShieldAlert, 
  Lock,
  Calendar,
  Layers,
  Fingerprint,
  ArrowRight,
  ShieldCheck,
  UserCheck
} from "lucide-react";

export default function PreviewRole() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();
  
  // Check if we should start in edit mode based on query param
  const queryParams = new URLSearchParams(location.search);
  const startInEditMode = queryParams.get("edit") === "true";

  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [permissionAccess, setPermissionAccess] = useState<Record<string, string[]>>({});

  const { data: roles = [], isLoading: rolesLoading, error: rolesError } = useRoles();
  const role: any = Array.isArray(roles)
    ? roles.find((r: any) => r._id === id)
    : ((roles as any)?.data || []).find((r: any) => r._id === id);
  const { data: permissions = [], isLoading: permissionsLoading } = usePermissions();
  const { data: usersData, isLoading: usersLoading } = useUsers();
  
  const updateRoleMutation = useUpdateRole();
  const deleteRoleMutation = useDeleteRole();

  const canUpdate = hasPermission("Role Management", "write");
  const canDelete = hasPermission("Role Management", "write");

  useEffect(() => {
    if (role) {
      setFormData({
        name: toPlainString((role as any).name) || "",
        description: role.description || "",
      });
      
      const rolePerms = role.permissions || [];
      setSelectedPermissions(rolePerms.map((p: any) => p.permission?._id || p.permission));
      
      const accessMap: Record<string, string[]> = {};
      rolePerms.forEach((p: any) => {
        const permId = p.permission?._id || p.permission;
        accessMap[permId] = p.access || [];
      });
      setPermissionAccess(accessMap);
    }
  }, [role]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePermissionToggle = (permId: string) => {
    if (!isEditing) return;
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
        const defaultActions = permission?.actions || ["read"];
        setPermissionAccess((prevAccess) => ({ ...prevAccess, [permId]: defaultActions }));
        return [...prev, permId];
      }
    });
  };

  const handleAccessToggle = (permId: string, action: string) => {
    if (!isEditing) return;
    setPermissionAccess((prev) => {
      const current = prev[permId] || [];
      const updated = current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action];
      return { ...prev, [permId]: updated };
    });
  };

  const handleSave = async () => {
    const payload = {
      name: formData.name,
      description: formData.description,
      permissions: selectedPermissions.map((permId) => ({
        permission: permId,
        access: permissionAccess[permId] || [],
      })),
    };

    try {
      await updateRoleMutation.mutateAsync({ id: id!, data: payload as any });
      setIsEditing(false);
      Swal.fire({
        title: "Profile Updated",
        text: "The role Company has been successfully recalibrated.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        background: "rgba(255, 255, 255, 0.9)",
        backdrop: `rgba(0,0,0,0.4) blur(4px)`
      });
    } catch (err: any) {
      Swal.fire("Update Failed", err.message || "An error occurred", "error");
    }
  };

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: "Decommission Company?",
      text: "This operation will disconnect all associated users from this role baseline.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Decommission"
    });

    if (result.isConfirmed) {
      try {
        await deleteRoleMutation.mutateAsync(id!);
        navigate("/roles");
        Swal.fire({ title: "Decommissioned", icon: "success", timer: 1500, showConfirmButton: false });
      } catch (err: any) {
        Swal.fire("Error", err.message, "error");
      }
    }
  };

  const roleUsers = (Array.isArray(usersData) ? usersData : ((usersData as any)?.data ?? []))
    .filter((u: any) => (u.roleId?._id || u.roleId) === id);

  if (rolesLoading || permissionsLoading || usersLoading) return <LoadingSpinner fullPage />;
  if (rolesError || !role) return (
    <div className="p-8 text-center bg-white/60 dark:bg-white/5 backdrop-blur-xl rounded-[3rem] border border-red-500/20 max-w-2xl mx-auto mt-20">
      <ShieldAlert className="size-16 text-red-500 mx-auto mb-6" />
      <h2 className="text-2xl font-black text-gray-900 dark:text-white">Company Missing</h2>
      <p className="text-gray-500 mt-2">The requested role profile could not be located in our repository.</p>
      <button onClick={() => navigate("/roles")} className="mt-8 px-8 py-3 bg-brand-500 text-white font-bold rounded-2xl shadow-xl shadow-brand-500/20">
        Return to Repository
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] p-4 sm:p-8 text-slate-900 dark:text-slate-100">
      <PageMeta title={`Role Detail - ${formData.name}`} description="View and manage role permissions" />
      <PageBreadcrumb pageTitle="Role Detail" />

      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
        {/* Profile Navigation */}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate("/roles")}
            className="group flex items-center gap-2 text-gray-400 hover:text-brand-500 transition-all font-bold tracking-tight"
          >
            <div className="size-10 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-md border border-white/20 flex items-center justify-center transition-transform group-hover:-translate-x-1 shadow-sm">
              <ChevronLeft className="size-5" />
            </div>
            Back to Hub
          </button>
          
          <div className="flex gap-3">
            {!isEditing && canUpdate && (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-6 py-3 bg-brand-500 text-white rounded-[1.25rem] font-bold shadow-xl shadow-brand-500/20 hover:scale-105 transition-all"
              >
                <Pencil className="size-4" />
                Edit
              </button>
            )}
            {!isEditing && canDelete && (
              <button 
                onClick={handleDelete}
                className="size-12 flex items-center justify-center bg-red-500/10 text-red-500 rounded-[1.25rem] border border-red-500/20 hover:bg-red-500 hover:text-white transition-all shadow-sm"
              >
                <Trash2 className="size-5" />
              </button>
            )}
            {isEditing && (
              <div className="flex gap-3 animate-in zoom-in-95 duration-200">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-3 text-gray-400 hover:text-gray-900 dark:hover:text-white font-bold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  className="px-8 py-3 bg-brand-500 text-white rounded-[1.25rem] font-black tracking-widest uppercase shadow-xl shadow-brand-500/20 hover:scale-105 transition-all"
                >
                  Commit Changes
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Company Profile Header */}
        <div className="relative overflow-hidden bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-[3rem] p-8 sm:p-12 shadow-2xl">
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
            <Fingerprint className="size-64" />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row gap-10 items-start md:items-center">
            <div className="size-32 rounded-[2.5rem] bg-gradient-to-br from-brand-500/20 to-purple-500/10 border-2 border-white/40 dark:border-white/10 flex items-center justify-center shadow-inner group transition-all duration-500">
              <ShieldCheck className="size-16 text-brand-500 drop-shadow-lg" />
            </div>
            
            <div className="flex-1 space-y-4">
              <div className="space-y-1">
                {isEditing ? (
                  <div className="space-y-4 max-w-lg">
                    <Input
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="!text-3xl !font-black !bg-transparent !border-b-2 !border-brand-500 !p-0 focus:!ring-0 transition-all text-gray-900 dark:text-white"
                      placeholder="Role Name"
                    />
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={2}
                      className="w-full bg-white/40 dark:bg-black/20 border border-white/20 rounded-2xl p-4 text-gray-600 dark:text-gray-300 font-medium focus:ring-2 focus:ring-brand-500/20 outline-none transition-all placeholder:text-gray-400"
                      placeholder="Describe the operational scope of this Company..."
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">
                        {formData.name}
                      </h1>
                      <div className="px-3 py-1 bg-brand-500/10 text-brand-500 border border-brand-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                        Core Company
                      </div>
                    </div>
                    <p className="text-lg text-gray-500 dark:text-gray-400 font-medium leading-relaxed max-w-2xl">
                      {formData.description || "A foundational access profile designed for specialized platform interaction and enterprise resource management."}
                    </p>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-6 pt-2">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-widest">
                  <Calendar className="size-4 text-brand-500" />
                  Deployed: <span className="text-gray-700 dark:text-gray-300">{role.createdAt ? new Date(role.createdAt).toLocaleDateString() : "Historical"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-widest">
                  <Layers className="size-4 text-purple-500" />
                  Modules: <span className="text-gray-700 dark:text-gray-300">{selectedPermissions.length} Active</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-widest">
                  <UserCheck className="size-4 text-blue-500" />
                  Influence: <span className="text-gray-700 dark:text-gray-300">{roleUsers.length} Users</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Permission Matrix */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between px-4">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <Lock className="size-5 text-brand-500" />
                Capabilities Matrix
              </h2>
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                 {selectedPermissions.length} / {permissions.length} Modules Enabled
              </span>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 ${!isEditing ? "opacity-90" : ""}`}>
              {permissions.map((perm) => {
                const isSelected = selectedPermissions.includes(perm._id);
                return (
                  <div 
                    key={perm._id}
                    onClick={() => isEditing && handlePermissionToggle(perm._id)}
                    className={`group p-6 rounded-[2.5rem] border transition-all duration-300 ${
                      isSelected 
                      ? "bg-brand-500/[0.05] border-brand-500/30 ring-1 ring-brand-500/10 shadow-lg" 
                      : "bg-white/40 dark:bg-white/5 border-white/20 hover:border-brand-500/20"
                    } ${isEditing ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div className="flex flex-col gap-5">
                      <div className="flex items-center justify-between">
                        <div className={`p-3 rounded-xl ${isSelected ? "bg-brand-500 text-white shadow-brand-500/30 shadow-lg" : "bg-white dark:bg-black/20 text-gray-400 dark:text-gray-600 border border-white/20"} transition-all`}>
                          <Shield className="size-5" />
                        </div>
                        {isSelected && !isEditing && (
                          <div className="flex items-center gap-1.5 text-brand-500">
                            <CheckCircle2 className="size-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Enabled</span>
                          </div>
                        )}
                        {isEditing && (
                          <div className={`size-6 rounded-lg border-2 transition-all flex items-center justify-center ${isSelected ? "bg-brand-500 border-brand-500 text-white scale-110" : "border-slate-200 dark:border-slate-800"}`}>
                            {isSelected && <CheckCircle2 className="size-4" />}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <h4 className={`text-base font-black transition-colors ${isSelected ? "text-brand-600 dark:text-brand-400" : "text-gray-500 dark:text-gray-500"}`}>
                          {perm.name}
                        </h4>
                        <p className="text-[11px] font-medium text-gray-400 line-clamp-1 italic">
                          {perm.description || "Operational unit access configuration"}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-brand-500/10 animate-in slide-in-from-top-2 duration-300">
                          {(perm.actions || ["read", "write", "create", "delete", "update"]).map((action) => {
                            const isActionActive = permissionAccess[perm._id]?.includes(action);
                            return (
                              <button
                                key={action}
                                disabled={!isEditing}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAccessToggle(perm._id, action);
                                }}
                                className={`px-3 py-1.5 text-[9px] font-black tracking-widest uppercase rounded-lg transition-all border-2 ${
                                  isActionActive
                                  ? "bg-brand-500 text-white border-brand-500 shadow-sm"
                                  : "bg-transparent text-gray-400 dark:text-gray-600 border-slate-100 dark:border-white/5 hover:border-brand-500/20"
                                }`}
                              >
                                {action}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side Info / Associated Users */}
          <div className="space-y-8">
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-[3rem] p-8 shadow-xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500">
                  <Users className="size-6" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Active Reach</h3>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col gap-1 px-4 py-5 bg-blue-500/[0.03] rounded-3xl border border-blue-500/10">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Connected Identities</span>
                  <span className="text-4xl font-black text-blue-600 dark:text-blue-400 tabular-nums">{roleUsers.length}</span>
                </div>

                <div className="space-y-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">Primary Stakeholders</span>
                  <div className="space-y-3">
                    {roleUsers.slice(0, 5).map((user: any) => (
                      <div key={user._id} className="flex items-center gap-3 p-3 hover:bg-white/40 dark:hover:bg-white/10 rounded-2xl transition-all group cursor-pointer">
                        <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-white/50 dark:border-white/5 overflow-hidden flex items-center justify-center font-bold text-gray-500">
                          {user.name?.charAt(0) || "U"}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-bold truncate text-gray-700 dark:text-gray-200">{user.name}</p>
                          <p className="text-[10px] text-gray-400 font-medium truncate">{user.email}</p>
                        </div>
                        <ArrowRight className="size-4 text-gray-300 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
                      </div>
                    ))}
                    {roleUsers.length > 5 && (
                      <p className="text-center text-[11px] font-bold text-gray-400 pt-2 italic">
                        + {roleUsers.length - 5} additional users authenticated
                      </p>
                    )}
                    {roleUsers.length === 0 && (
                      <div className="text-center py-6 border-2 border-dashed border-slate-100 dark:border-white/5 rounded-3xl">
                        <p className="text-xs font-bold text-gray-400">No users currently assigned</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative group overflow-hidden bg-brand-500 rounded-[3rem] p-8 shadow-2xl shadow-brand-500/30">
              <div className="absolute -top-10 -right-10 size-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              <div className="relative z-10 space-y-4">
                <ShieldAlert className="size-10 text-white/50" />
                <h4 className="text-xl font-black text-white leading-tight">Company Compliance Audit</h4>
                <p className="text-sm text-brand-50/70 font-medium leading-relaxed">
                  Modifying this role will immediately impact all connected operational vectors for the {roleUsers.length} assigned users.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}