import { useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ComponentCard from "../../components/common/ComponentCard";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { useRoles, usePermissions, useUsers } from "../../hooks/queries";

export default function PreviewRole() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch data
  const { data: roles = [], isLoading: rolesLoading } = useRoles();
  const { data: permissions = [], isLoading: permissionsLoading } =
    usePermissions();
  const { data: users = [], isLoading: usersLoading } = useUsers();

  // Find the current role
  const role = useMemo(() => {
    return roles.find((r) => r._id === id);
  }, [roles, id]);

  // Find users with this role
  const roleUsers = useMemo(() => {
    if (!role) return [];
    return users.filter((user) => {
      const userRoleId =
        typeof user.roleId === "string" ? user.roleId : user.roleId?._id;
      return userRoleId === role._id;
    });
  }, [users, role]);

  // Get permission details for this role
  const rolePermissions = useMemo(() => {
    if (!role || !role.permissions) return [];

    return role.permissions
      .map((rolePermId) => {
        // Handle both string IDs and permission objects
        const permId =
          typeof rolePermId === "string"
            ? rolePermId
            : (rolePermId as any).permission?._id ||
              (rolePermId as any).permission;
        const access =
          typeof rolePermId === "object" ? (rolePermId as any).access : [];

        const permission = permissions.find((p) => p._id === permId);
        if (!permission) return null;

        return {
          ...permission,
          access: access.length > 0 ? access : permission.actions || [],
        };
      })
      .filter(Boolean);
  }, [role, permissions]);

  const loading = rolesLoading || permissionsLoading || usersLoading;

  if (loading) {
    return <LoadingSpinner fullPage message="Loading role details..." />;
  }

  if (!role) {
    return (
      <>
        <PageMeta title="Role Not Found" description="Role details" />
        <PageBreadcrumb pageTitle="Role Not Found" />
        <div className="p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Role Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The role you're looking for doesn't exist.
          </p>
          <button
            onClick={() => navigate("/permissions")}
            className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors"
          >
            Back to Permissions
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title={`${role.name} - Role Details`}
        description={`View details for ${role.name} role`}
      />
      <PageBreadcrumb pageTitle={role.name} />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {role.name}
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {role.description}
            </p>
          </div>
          <button
            onClick={() => navigate("/permissions")}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Back to Permissions
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Permissions
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                  {rolePermissions.length}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <svg
                  className="w-8 h-8 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Assigned Users
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                  {roleUsers.length}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <svg
                  className="w-8 h-8 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Created
                </p>
                <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                  {role.createdAt
                    ? new Date(role.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "N/A"}
                </p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <svg
                  className="w-8 h-8 text-purple-600 dark:text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Permissions Table */}
        <ComponentCard title="Role Permissions">
          {rolePermissions.length === 0 ? (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">
              No permissions assigned to this role.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell
                    isHeader
                    className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                  >
                    Permission Name
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                  >
                    Description
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                  >
                    Access Rights
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-200 dark:divide-gray-700">
                {rolePermissions.map((permission: any) => (
                  <TableRow
                    key={permission._id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <TableCell className="px-4 py-3 align-middle">
                      <span className="font-medium">{permission.name}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      <span className="text-gray-600 dark:text-gray-400">
                        {permission.description || "No description"}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      <div className="flex flex-wrap gap-1">
                        {(permission.access || []).map((action: string) => (
                          <span
                            key={action}
                            className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded"
                          >
                            {action}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ComponentCard>

        {/* Users Table */}
        <ComponentCard title="Users with This Role">
          {roleUsers.length === 0 ? (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">
              No users assigned to this role yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell
                    isHeader
                    className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                  >
                    Name
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                  >
                    Email
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                  >
                    Phone
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                  >
                    Status
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                  >
                    Joined
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-200 dark:divide-gray-700">
                {roleUsers.map((user) => (
                  <TableRow
                    key={user._id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <TableCell className="px-4 py-3 align-middle">
                      <span className="font-medium">
                        {user.fullName || user.name || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      {user.email}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      {user.phone || "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          user.isActive !== false
                            ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                            : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                        }`}
                      >
                        {user.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ComponentCard>
      </div>
    </>
  );
}
