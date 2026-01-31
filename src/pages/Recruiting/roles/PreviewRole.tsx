import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import Swal from "sweetalert2";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import ComponentCard from "../../../components/common/ComponentCard";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { useRoles, usePermissions, useUsers, useUpdateRole } from "../../../hooks/queries";

export default function PreviewRole() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get("edit") === "true";

  // Fetch data
  const { data: roles = [], isLoading: rolesLoading } = useRoles();
  const { data: permissions = [], isLoading: permissionsLoading } =
    usePermissions();
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const updateRoleMutation = useUpdateRole();

  // Edit state
  const [isEditing, setIsEditing] = useState(isEditMode);
  const [editForm, setEditForm] = useState({
    name: "",
    permissions: [] as string[],
    
  });
  const [permissionAccess, setPermissionAccess] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState("");

  // Find the current role
  const role = useMemo(() => {
    return roles.find((r) => r._id === id);
  }, [roles, id]);

  // Initialize edit form when role is loaded
  useEffect(() => {
    if (role && isEditing) {
      setEditForm({
        name: role.name,
        permissions: role.permissions?.map((p: any) => 
          typeof p === "string" ? p : p.permission?._id || p.permission
        ) || [],
      });

      // Initialize permission access
      const initialAccess: Record<string, string[]> = {};
      role.permissions?.forEach((p: any) => {
        const permId = typeof p === "string" ? p : p.permission?._id || p.permission;
        const access = typeof p === "object" ? p.access : [];
        initialAccess[permId] = access.length > 0 ? access : [];
      });
      setPermissionAccess(initialAccess);
    }
  }, [role, isEditing]);

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

  // Handler functions
  const handlePermissionToggle = (permId: string) => {
    setEditForm((prev) => {
      if (prev.permissions.includes(permId)) {
        // Remove permission and its access
        const newPerms = prev.permissions.filter((id) => id !== permId);
        setPermissionAccess((prevAccess) => {
          const newAccess = { ...prevAccess };
          delete newAccess[permId];
          return newAccess;
        });
        return { ...prev, permissions: newPerms };
      } else {
        // Add permission with default access
        const permission = permissions.find((p) => p._id === permId);
        const defaultActions = permission?.actions || ["read", "write", "create"];
        setPermissionAccess((prevAccess) => ({
          ...prevAccess,
          [permId]: defaultActions,
        }));
        return { ...prev, permissions: [...prev.permissions, permId] };
      }
    });
  };

  const handleAccessToggle = (permId: string, access: string) => {
    setPermissionAccess((prev) => {
      const currentAccess = prev[permId] || [];
      const newAccess = currentAccess.includes(access)
        ? currentAccess.filter((a) => a !== access)
        : [...currentAccess, access];
      return { ...prev, [permId]: newAccess };
    });
  };

  const handleSave = async () => {
    // Basic client-side validation
    if (!editForm.name || !editForm.name.trim()) {
      setFormError("Role name is required");
      return;
    }

    try {
      const permissionsWithAccess = editForm.permissions.map((permId) => ({
        permission: permId,
        access: permissionAccess[permId] || [],
      }));

      const payload = {
        name: editForm.name,
        permissions: permissionsWithAccess,
      };

      console.log("Updating role with payload:", payload);

      await updateRoleMutation.mutateAsync({
        id: id!,
        data: payload,
      });

      await Swal.fire({
        title: "Success!",
        text: "Role updated successfully.",
        icon: "success",
        position: "center",
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: "!mt-16",
        },
      });

      setIsEditing(false);
      navigate(`/role/${id}`);
    } catch (err: any) {
      console.error("Error updating role:", err);
      console.error("Error response:", err.response?.data);
      // Show server error to user for debugging
      const serverMessage = err.response?.data?.message || err.message || "An error occurred";
      setFormError(serverMessage);
      await Swal.fire({
        title: "Error",
        text: String(serverMessage),
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    navigate(`/role/${id}`);
  };

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
      
      <PageBreadcrumb pageTitle={role.name} />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-4 max-w-2xl">
                <div>
                  <Label htmlFor="roleName">Role Name</Label>
                  <Input
                    id="roleName"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Role Name"
                  />
                </div>
                
                
                {formError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      <strong>Error:</strong> {formError}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {role.name}
                </h1>
                
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Edit Role
                </button>
                <button
                  onClick={() => navigate("/permissions")}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Back to Permissions
                </button>
              </>
            )}
          </div>
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
          {isEditing ? (
            <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium w-12">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditForm((prev) => ({
                                ...prev,
                                permissions: permissions.map((p) => p._id),
                              }));
                              const allAccess: Record<string, string[]> = {};
                              permissions.forEach((p) => {
                                allAccess[p._id] = p.actions || ["read", "write", "create"];
                              });
                              setPermissionAccess(allAccess);
                            } else {
                              setEditForm((prev) => ({ ...prev, permissions: [] }));
                              setPermissionAccess({});
                            }
                          }}
                          checked={
                            permissions.length > 0 &&
                            editForm.permissions.length === permissions.length
                          }
                          className="w-4 h-4 text-brand-500 rounded focus:ring-brand-500"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Permission
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Description
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {permissions.map((perm) => (
                      <tr
                        key={perm._id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={editForm.permissions.includes(perm._id)}
                            onChange={() => handlePermissionToggle(perm._id)}
                            className="w-4 h-4 text-brand-500 rounded focus:ring-brand-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm">{perm.name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(perm.actions || ["read", "write", "create"]).map(
                              (action) => {
                                const isPermSelected = editForm.permissions.includes(perm._id);
                                const isAccessSelected = permissionAccess[perm._id]?.includes(action);

                                return (
                                  <label
                                    key={action}
                                    className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                                      isPermSelected && isAccessSelected
                                        ? "bg-purple-500 text-white"
                                        : isPermSelected
                                        ? "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 hover:bg-purple-200"
                                        : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="hidden"
                                      checked={isPermSelected && isAccessSelected}
                                      disabled={!isPermSelected}
                                      onChange={() => handleAccessToggle(perm._id, action)}
                                    />
                                    {action}
                                  </label>
                                );
                              }
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : rolePermissions.length === 0 ? (
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
