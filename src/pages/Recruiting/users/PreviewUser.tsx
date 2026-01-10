import { useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import ComponentCard from "../../../components/common/ComponentCard";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import {
  useUsers,
  useRoles,
  useCompanies,
  useDepartments,
} from "../../../hooks/queries";

export default function PreviewUser() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch data
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: roles = [] } = useRoles();
  const { data: companies = [] } = useCompanies();
  const { data: departments = [] } = useDepartments();

  // Find the current user
  const user = useMemo(() => {
    return users.find((u) => u._id === id);
  }, [users, id]);

  // Get role name
  const roleName = useMemo(() => {
    if (!user) return "-";
    if (typeof user.roleId === "object" && user.roleId) {
      return user.roleId.name;
    }
    const role = roles.find((r) => r._id === user.roleId);
    return role?.name || "-";
  }, [user, roles]);

  // Get user's companies with departments
  const userCompanies = useMemo(() => {
    if (!user || !user.companies) return [];
    return user.companies.map((userCompany: any) => {
      const companyId =
        typeof userCompany.companyId === "string"
          ? userCompany.companyId
          : userCompany.companyId._id;
      const companyName =
        typeof userCompany.companyId === "object"
          ? userCompany.companyId.name
          : companies.find((c) => c._id === companyId)?.name || "Unknown";

      const userDepartments =
        userCompany.departments?.map((dept: any) => {
          // Handle both string IDs and populated department objects
          if (typeof dept === "string") {
            const deptObj = departments.find((d) => d._id === dept);
            return deptObj?.name || dept;
          } else if (dept && typeof dept === "object") {
            return dept.name || dept._id || "Unknown";
          }
          return "Unknown";
        }) || [];

      return {
        companyId,
        companyName,
        departments: userDepartments,
        isPrimary: userCompany.isPrimary || false,
      };
    });
  }, [user, companies, departments]);

  if (usersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <PageMeta 
          title="User Not Found | Job Application Maker" 
          description="The requested user could not be found"
        />
        <PageBreadcrumb pageTitle="User Not Found" />
        <ComponentCard title="User Not Found">
          <div className="text-center py-12">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              User Not Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              The user you're looking for doesn't exist or has been deleted.
            </p>
            <button
              onClick={() => navigate("/users")}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
            >
              Back to Users
            </button>
          </div>
        </ComponentCard>
      </div>
    );
  }

  const userName = user.fullName || user.name || "Unnamed User";

  return (
    <div className="space-y-6">
      <PageMeta
        title={`${userName} - User Details | Job Application Maker`}
        description={`View details for ${userName}`}
      />
      <PageBreadcrumb pageTitle={`User: ${userName}`} />

      {/* Basic Information */}
      <ComponentCard title="Basic Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name
            </h4>
            <p className="text-base text-gray-900 dark:text-white">
              {userName}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </h4>
            <p className="text-base text-gray-900 dark:text-white">
              {user.email}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone
            </h4>
            <p className="text-base text-gray-900 dark:text-white">
              {user.phone || "-"}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role
            </h4>
            <p className="text-base text-gray-900 dark:text-white">
              {roleName}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </h4>
            <span
              className={`inline-block px-3 py-1 text-sm rounded ${
                user.isActive !== false
                  ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                  : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
              }`}
            >
              {user.isActive !== false ? "Active" : "Inactive"}
            </span>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              User ID
            </h4>
            <p className="text-base text-gray-900 dark:text-white font-mono text-xs">
              {user._id}
            </p>
          </div>
        </div>
      </ComponentCard>

      {/* Company Assignments */}
      {userCompanies.length > 0 && (
        <ComponentCard title="Company Assignments">
          <div className="space-y-4">
            {userCompanies.map((company, idx) => (
              <div
                key={idx}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                    {company.companyName}
                  </h4>
                  {company.isPrimary && (
                    <span className="px-2 py-0.5 text-xs bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200 rounded">
                      Primary
                    </span>
                  )}
                </div>
                {company.departments.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Departments:
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {company.departments.map((dept: string, deptIdx: number) => (
                        <span
                          key={deptIdx}
                          className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded"
                        >
                          {dept}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ComponentCard>
      )}

      {/* Permissions */}
      {user.permissions && user.permissions.length > 0 && (
        <ComponentCard title="Permissions">
          <div className="space-y-3">
            {user.permissions.map((perm, idx) => {
              const permissionName = typeof perm.permission === 'string'
                ? perm.permission
                : (perm.permission && (perm.permission as { name?: string }).name) || 'Unknown Permission';
              
              return (
                <div
                  key={idx}
                  className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    {permissionName}
                  </h4>
                  {perm.access && perm.access.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {perm.access.map((access, accessIdx) => (
                        <span
                          key={accessIdx}
                          className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded"
                        >
                          {access}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ComponentCard>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => navigate("/users")}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Back to Users
        </button>
      </div>
    </div>
  );
}
