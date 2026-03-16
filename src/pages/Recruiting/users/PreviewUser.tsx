import { useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { 
  useUsers, 
  useRoles, 
  useCompanies, 
  useDepartments 
} from "../../../hooks/queries";
import { toPlainString } from "../../../utils/strings";
import { 
  Mail, 
  Phone, 
  Shield, 
  Building2, 
  Pencil, 
  ChevronLeft, 
  LayoutDashboard, 
  Clock, 
  CheckCircle2, 
  ShieldAlert,
  Building,
  Target,
  Calendar
} from "lucide-react";

type UserCompanyView = {
  companyName: string;
  departments: string[];
  isPrimary?: boolean;
};

export default function PreviewUser() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch data
  const { data: usersResponse, isLoading: usersLoading } = useUsers();
  const rawUsers = Array.isArray(usersResponse) ? usersResponse : ((usersResponse as any)?.data ?? []);
  const { data: roles = [] } = useRoles();
  const { data: companies = [] } = useCompanies();
  const { data: departments = [] } = useDepartments();

  // Find the current user
  const user = useMemo(() => {
    return rawUsers.find((u: any) => u._id === id);
  }, [rawUsers, id]);

  // Get role name
  const roleName = useMemo(() => {
    if (!user) return "Unauthorized Access";
    if (typeof user.roleId === "object" && user.roleId) {
      return toPlainString((user.roleId as any).name);
    }
    const role = roles.find((r) => r._id === user.roleId);
    return role ? toPlainString((role as any).name) : "Standard Company";
  }, [user, roles]);

  // Transform company assignments
  const userCompanies = useMemo<UserCompanyView[]>(() => {
    if (!user || !user.companies) return [];

    const resolveDepartmentName = (rawDept: any, companyObj: any) => {
      if (!rawDept) return "Section Unknown";

      if (typeof rawDept === "object" && rawDept.name) {
        return toPlainString(rawDept.name) || "Section Unknown";
      }

      const directId =
        typeof rawDept === "string"
          ? rawDept
          : rawDept?._id || rawDept?.departmentId?._id || rawDept?.departmentId;

      if (!directId) return "Section Unknown";

      const fromGlobal = departments.find(
        (item: any) =>
          item?._id === directId || String(item?._id) === String(directId)
      );
      if (fromGlobal) {
        return toPlainString((fromGlobal as any).name) || "Section Unknown";
      }

      const companyDepartments = (companyObj as any)?.departments || [];
      const fromCompany = companyDepartments.find(
        (item: any) =>
          item?._id === directId ||
          item === directId ||
          String(item?._id) === String(directId)
      );
      if (fromCompany) {
        return toPlainString((fromCompany as any).name || fromCompany) || "Section Unknown";
      }

      return "Section Unknown";
    };

    return user.companies
      .filter((userCompany: any) => userCompany && userCompany.companyId)
      .map((userCompany: any) => {
        const companyId = typeof userCompany.companyId === "string" ? userCompany.companyId : userCompany.companyId?._id;
        const companyObj = companies.find((c) => c._id === companyId);
        const companyName = companyObj ? toPlainString(companyObj.name) : "Unassigned";

        const userDepts = (userCompany.departments || []).map((dept: any) =>
          resolveDepartmentName(dept, companyObj)
        );

        return { companyName, departments: userDepts, isPrimary: userCompany.isPrimary };
      });
  }, [user, companies, departments]);

  if (usersLoading) return <LoadingSpinner fullPage />;

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[#F8FAFC] dark:bg-[#0F172A]">
      <div className="text-center space-y-6 max-w-md bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 p-12 rounded-[3.5rem] shadow-2xl">
        <div className="size-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto ring-4 ring-red-500/5 transition-transform duration-700 hover:rotate-12">
          <ShieldAlert className="size-10 text-red-500" />
        </div>
        <h2 className="text-3xl font-black dark:text-white tracking-tight">Company Missing</h2>
        <p className="text-gray-500 font-medium">The personnel record you are attempting to access has been revoked or lost.</p>
        <button onClick={() => navigate("/users")} className="px-10 py-4 bg-brand-500 text-white font-black rounded-3xl shadow-xl shadow-brand-500/30 hover:scale-105 active:scale-95 transition-all">
          Return to Hub
        </button>
      </div>
    </div>
  );

  const userName = toPlainString(user.fullName || user.name || "Anonymous Persona");
  const isActive = user.isActive !== false;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] p-4 sm:p-8 text-slate-900 dark:text-slate-100">
      <PageMeta title={`Personnel Profile - ${userName}`} description="Detailed overview of user authentication and organizational access" />
      
      <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Navigation & Actions */}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate("/users")}
            className="group flex items-center gap-3 transition-all"
          >
            <div className="size-12 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl flex items-center justify-center shadow-sm group-hover:-translate-x-1 group-hover:bg-brand-500 group-hover:text-white transition-all">
              <ChevronLeft className="size-5" />
            </div>
            <span className="font-black text-xs uppercase tracking-widest text-gray-400 group-hover:text-brand-500 transition-colors">Back to Records</span>
          </button>
          
          <button 
            onClick={() => navigate(`/user/${id}/edit`)}
            className="flex items-center gap-3 px-8 py-4 bg-brand-500 text-white rounded-[2rem] font-black tracking-widest uppercase text-xs shadow-xl shadow-brand-500/30 hover:scale-105 active:scale-95 transition-all"
          >
            <Pencil className="size-4" />
            Modify Credentials
          </button>
        </div>

        {/* Global Company Header */}
        <div className="relative overflow-hidden bg-white/60 dark:bg-white/5 backdrop-blur-[40px] border border-white/20 dark:border-white/10 rounded-[4rem] p-8 sm:p-14 shadow-2xl">
          <div className="absolute top-0 right-10 p-20 opacity-[0.03] pointer-events-none">
            <LayoutDashboard className="size-72" />
          </div>
          
          <div className="relative z-10 flex flex-col lg:flex-row items-center lg:items-end gap-12">
            <div className="relative group">
              <div className="size-48 rounded-[3.5rem] bg-gradient-to-br from-brand-500/10 via-brand-500/20 to-purple-500/10 border-4 border-white dark:border-white/10 flex items-center justify-center text-7xl font-black text-brand-500 shadow-xl overflow-hidden transition-all duration-700 group-hover:rotate-3 group-hover:scale-105">
                {userName.charAt(0)}
                {/* Status Indicator */}
                <div className={`absolute bottom-6 right-6 size-6 rounded-full border-4 border-white dark:border-[#1E293B] shadow-lg ${isActive ? "bg-green-500" : "bg-red-500"}`} />
              </div>
            </div>

            <div className="flex-1 text-center lg:text-left space-y-6">
              <div className="space-y-2">
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${isActive ? "bg-green-500/10 text-green-600 border border-green-500/20" : "bg-red-500/10 text-red-600 border border-red-500/20"}`}>
                  <Clock className="size-3" />
                  Status: {isActive ? "Active Duty" : "Revoked"}
                </div>
                <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-gray-900 dark:text-white">
                  {userName}
                </h1>
                <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-2">
                  <div className="flex items-center gap-2 px-3 py-1 bg-brand-500/5 border border-brand-500/10 rounded-xl text-xs font-bold text-brand-500">
                    <Shield className="size-3.5" />
                    Level: {roleName}
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/5 border border-blue-500/10 rounded-xl text-xs font-bold text-blue-500">
                    <Calendar className="size-3.5" />
                    Added: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "System Launch"}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 bg-white/40 dark:bg-black/20 rounded-[2.5rem] border border-white/20 min-w-[140px] text-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Reach</span>
                <p className="text-3xl font-black dark:text-white pt-1">{userCompanies.length}</p>
                <span className="text-[10px] text-gray-400 font-bold italic">Affiliations</span>
              </div>
              <div className="p-6 bg-white/40 dark:bg-black/20 rounded-[2.5rem] border border-white/20 min-w-[140px] text-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Security</span>
                <p className="text-3xl font-black dark:text-white pt-1">92%</p>
                <span className="text-[10px] text-gray-400 font-bold italic">Integrity</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 pb-20">
          {/* Detailed Credentials */}
          <div className="lg:col-span-2 space-y-10">
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 p-10 rounded-[4rem] shadow-xl">
              <h3 className="text-xl font-black flex items-center gap-3 mb-10 tracking-tight">
                <Shield className="size-6 text-brand-500" />
                Personal Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="group space-y-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="size-1.5 bg-brand-500 rounded-full" />
                    Authentication Channel
                  </span>
                  <div className="flex items-center gap-4 p-5 bg-white/40 dark:bg-black/20 rounded-3xl border border-white/20 group-hover:border-brand-500/30 transition-all shadow-sm">
                    <div className="size-12 bg-white dark:bg-white/5 rounded-2xl flex items-center justify-center text-brand-500 shadow-inner group-hover:scale-110 transition-transform">
                      <Mail className="size-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-tighter">Primary Email</p>
                      <p className="text-base font-bold dark:text-gray-100 truncate max-w-[200px]">{user.email}</p>
                    </div>
                  </div>
                </div>

                <div className="group space-y-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="size-1.5 bg-blue-500 rounded-full" />
                    Communication Relay
                  </span>
                  <div className="flex items-center gap-4 p-5 bg-white/40 dark:bg-black/20 rounded-3xl border border-white/20 group-hover:border-blue-500/30 transition-all shadow-sm">
                    <div className="size-12 bg-white dark:bg-white/5 rounded-2xl flex items-center justify-center text-blue-500 shadow-inner group-hover:scale-110 transition-transform">
                      <Phone className="size-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-tighter">Secure Line</p>
                      <p className="text-base font-bold dark:text-gray-100">{user.phone || "No line connected"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Matrix of Affiliations */}
            <div className="space-y-6">
              <h3 className="text-xl font-black flex items-center gap-3 px-4 tracking-tight">
                <Building2 className="size-6 text-purple-500" />
                Company Section
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {userCompanies.map((assignment, idx) => (
                  <div key={idx} className="relative group bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 p-8 rounded-[3.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 cursor-default">
                    {assignment.isPrimary && (
                      <div className="absolute top-6 right-8 px-3 py-1 bg-purple-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-purple-500/30 animate-pulse">
                        Primary HQ
                      </div>
                    )}
                    
                    <div className="space-y-6">
                      <div className="size-14 bg-purple-500/10 text-purple-600 rounded-2xl flex items-center justify-center">
                        <Building className="size-7" />
                      </div>
                      
                      <div className="space-y-1">
                        <h4 className="text-2xl font-black tracking-tight dark:text-white leading-none">{assignment.companyName}</h4>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.1em]">Authenticated Affiliate</p>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/5">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          Mapped Sections ({assignment.departments.length})
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {assignment.departments.map((dept, dIdx) => (
                            <div key={dIdx} className="px-4 py-2 bg-purple-500/5 text-purple-500 text-[10px] font-black uppercase tracking-widest rounded-xl border border-purple-500/10 flex items-center gap-2 hover:bg-purple-500 hover:text-white transition-all">
                              <Target className="size-3" />
                              {dept}
                            </div>
                          ))}
                          {assignment.departments.length === 0 && (
                            <p className="text-xs font-medium text-gray-400 italic">No departmental clusters mapped.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {userCompanies.length === 0 && (
                  <div className="col-span-full py-20 text-center bg-white/40 dark:bg-white/5 backdrop-blur-md border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[3.5rem]">
                    <div className="size-20 rounded-full bg-slate-100 dark:bg-white/5 mx-auto mb-6 flex items-center justify-center">
                      <Building2 className="size-10 text-slate-300 dark:text-slate-700 opacity-30" />
                    </div>
                    <p className="text-gray-400 font-black text-sm uppercase tracking-widest">No Organizational Ties Discovered</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Side Module: System Influence */}
          <div className="space-y-10">
            

            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 p-10 rounded-[4rem] shadow-xl">
              <h3 className="text-lg font-black tracking-tight mb-8">System Activity</h3>
              <div className="space-y-8">
                {[
                  { label: "Profile Updated", date: "2 Hours Ago", icon: Calendar, color: "text-brand-500" },
                  { label: "Matrix Sync", date: "Yesterday", icon: CheckCircle2, color: "text-green-500" },
                  { label: "Authentication", date: "March 15, 2026", icon: Shield, color: "text-blue-500" }
                ].map((item, i) => (
                  <div key={i} className="flex gap-5 items-start group cursor-default">
                    <div className={`mt-1 p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 ${item.color} group-hover:scale-110 transition-transform`}>
                      <item.icon className="size-4" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-black dark:text-white tracking-tight">{item.label}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">{item.date}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-10 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 rounded-3xl font-black text-[10px] uppercase tracking-widest border border-slate-200 dark:border-white/5 hover:bg-brand-500 hover:text-white hover:border-brand-500 transition-all">
                Full Audit Trail
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}