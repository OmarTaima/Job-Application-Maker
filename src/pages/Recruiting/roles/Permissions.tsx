import type { ChangeEvent, FormEvent } from "react";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import Swal from "sweetalert2";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import ComponentCard from "../../../components/common/ComponentCard";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import { PlusIcon, PencilIcon, TrashBinIcon } from "../../../icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { useRoles, usePermissions, useCreateRole, useUsers, useDeleteRole } from "../../../hooks/queries";

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
  const { data: roles = [], isLoading: rolesLoading, error } = useRoles();
  const { data: permissions = [], isLoading: permissionsLoading } =
    usePermissions();
  const { data: users = [], isLoading: usersLoading } = useUsers();

  // Mutations
  const createRoleMutation = useCreateRole();
  const deleteRoleMutation = useDeleteRole();

  // Calculate user counts per role
  const roleUserCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach((user) => {
      const userRoleId = typeof user.roleId === "string" ? user.roleId : user.roleId?._id;
      if (userRoleId) {
        counts[userRoleId] = (counts[userRoleId] || 0) + 1;
      }
    });
    return counts;
  }, [users]);

  const [roleForm, setRoleForm] = useState<RoleForm>(defaultRoleForm);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [formError, setFormError] = useState("");

  // Helper function to extract detailed error messages
  const getErrorMessage = (err: any): string => {
    // Check for validation errors in 'details' array (new format)
    if (
      err.response?.data?.details &&
      Array.isArray(err.response.data.details)
    ) {
      return err.response.data.details
        .map((detail: any) => {
          const field = detail.path?.[0] || "";
          const message = detail.message || "";
          return field ? `${field}: ${message}` : message;
        })
        .join(", ");
    }
    // Check for validation errors in 'errors' array (old format)
    if (err.response?.data?.errors) {
      const errors = err.response.data.errors;
      if (Array.isArray(errors)) {
        return errors.map((e: any) => e.msg || e.message).join(", ");
      }
      if (typeof errors === "object") {
        return Object.entries(errors)
          .map(([field, msg]) => `${field}: ${msg}`)
          .join(", ");
      }
    }
    if (err.response?.data?.message) return err.response.data.message;
    if (err.message) return err.message;
    return "An unexpected error occurred";
  };

  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [permissionAccess, setPermissionAccess] = useState<
    Record<string, string[]>
  >({});

  // Role handlers
  const handleRoleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setRoleForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePermissionToggle = (permId: string) => {
    console.log("Toggling permission:", permId);

    setSelectedPermissions((prev) => {
      console.log("Current selected:", prev);

      if (prev.includes(permId)) {
        // Remove permission and its access
        console.log("Removing permission:", permId);
        const newPerms = prev.filter((id) => id !== permId);
        setPermissionAccess((prevAccess) => {
          const newAccess = { ...prevAccess };
          delete newAccess[permId];
          return newAccess;
        });
        return newPerms;
      } else {
        // Add permission with default access (all available actions)
        console.log("Adding permission:", permId);
        const permission = permissions.find((p) => p._id === permId);
        const defaultActions = permission?.actions || [
          "read",
          "write",
          "create",
        ];
        setPermissionAccess((prevAccess) => ({
          ...prevAccess,
          [permId]: defaultActions,
        }));
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

    // Build permissions array with access rights
    const permissionsWithAccess = selectedPermissions.map((permId) => ({
      permission: permId,
      access: permissionAccess[permId] || [],
    }));

    const payload = {
      name: roleForm.name,
      permissions: permissionsWithAccess,
     
    };

    console.log("Role Creation Payload:", JSON.stringify(payload, null, 2));

    try {
      await createRoleMutation.mutateAsync(payload);
      console.log("Role created successfully");

      await Swal.fire({
        title: "Success!",
        text: "Role created successfully.",
        icon: "success",
        position: "center",
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: "!mt-16",
        },
      });

      // Reset form
      setRoleForm(defaultRoleForm);
      setSelectedPermissions([]);
      setPermissionAccess({});
      setShowRoleForm(false);
    } catch (err: any) {
      console.error("Error creating role:", err);
      const errorMsg = getErrorMessage(err);
      setFormError(errorMsg);
    }
  };

  // Permission handlers removed - not currently used in UI
  // TODO: Implement permission management UI when needed

  // If user doesn't have read permission, show access denied
  if (!canRead) {
    return (
      <div className="space-y-6">
        <PageMeta
          title="Permissions & Roles | TailAdmin React"
          description="Manage roles and permissions"
        />
        <PageBreadcrumb pageTitle="Permissions & Roles" />
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-24 dark:border-gray-700">
          <svg
            className="mb-4 size-16 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            Access Denied
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            You don't have permission to view roles and permissions
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title="Permissions & Roles | Job Application Maker"
        description="Manage roles and permissions for user access control"
      />
      <PageBreadcrumb pageTitle="Permissions & Roles" />

      {rolesLoading || permissionsLoading || usersLoading ? (
        <LoadingSpinner fullPage message="Loading permissions..." />
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Permissions & Roles Management
            </h1>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-4 text-sm text-red-700 bg-red-100 border border-red-300 rounded-lg dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {String(error instanceof Error ? error.message : error)}
            </div>
          )}

          {/* Roles Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Roles
              </h2>
              {canCreate && (
                <button
                  onClick={() => setShowRoleForm(!showRoleForm)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors"
                >
                  <PlusIcon className="w-5 h-5" />
                  {showRoleForm ? "Cancel" : "Create Role"}
                </button>
              )}
            </div>

            {/* Create Role Form */}
            {showRoleForm && (
              <ComponentCard title="Create New Role">
                <form onSubmit={handleRoleSubmit} className="space-y-6">
                  {formError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-start justify-between">
                        <p className="text-sm text-red-600 dark:text-red-400">
                          <strong>Error:</strong> {formError}
                        </p>
                        <button
                          type="button"
                          onClick={() => setFormError("")}
                          className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="roleName">Role Name</Label>
                      <Input
                        id="roleName"
                        name="name"
                        value={roleForm.name}
                        onChange={handleRoleInputChange}
                        placeholder="HR Manager"
                      />
                    </div>


                    {/* Removed Description and System/Company checkboxes per backend constraints */}
                  </div>

                  {/* Permissions Selection */}
                  <div>
                    <Label>Assign Permissions</Label>
                    <div className="mt-2 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div className="max-h-96 overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-medium w-12">
                                <input
                                  type="checkbox"
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedPermissions(
                                        permissions.map((p) => p._id)
                                      );
                                      // Set default access for all permissions
                                      const allAccess: Record<
                                        string,
                                        string[]
                                      > = {};
                                      permissions.forEach((p) => {
                                        allAccess[p._id] = p.actions || [
                                          "read",
                                          "write",
                                          "create",
                                        ];
                                      });
                                      setPermissionAccess(allAccess);
                                    } else {
                                      setSelectedPermissions([]);
                                      setPermissionAccess({});
                                    }
                                  }}
                                  checked={
                                    permissions.length > 0 &&
                                    selectedPermissions.length ===
                                      permissions.length
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
                                    checked={selectedPermissions.includes(
                                      perm._id
                                    )}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      handlePermissionToggle(perm._id);
                                    }}
                                    className="w-4 h-4 text-brand-500 rounded focus:ring-brand-500"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-sm">
                                    {perm.name}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {perm.description || "No description"}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-1">
                                    {(
                                      perm.actions || [
                                        "read",
                                        "write",
                                        "create",
                                      ]
                                    ).map((action) => {
                                      const isPermSelected =
                                        selectedPermissions.includes(perm._id);
                                      const isAccessSelected =
                                        permissionAccess[perm._id]?.includes(
                                          action
                                        );

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
                                            checked={
                                              isPermSelected && isAccessSelected
                                            }
                                            disabled={!isPermSelected}
                                            onChange={() =>
                                              handleAccessToggleForPermission(
                                                perm._id,
                                                action
                                              )
                                            }
                                          />
                                          {action}
                                        </label>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowRoleForm(false)}
                      className="px-6 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors"
                    >
                      Create Role
                    </button>
                  </div>
                </form>
              </ComponentCard>
            )}

            {/* Roles Table */}
            <ComponentCard title="All Roles">
              {!roles ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-brand-500 rounded-full animate-spin"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">
                      Loading roles...
                    </p>
                  </div>
                </div>
              ) : roles.length === 0 ? (
                <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                  No roles found. Create your first role to get started.
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
                        Description
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                      >
                        Permissions
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                      >
                        Users
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                      >
                        Created At
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                      >
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {roles.map((role) => {
                      const userCount = roleUserCounts[role._id] || 0;
                      return (
                        <TableRow
                          key={role._id}
                          onClick={() => navigate(`/role/${role._id}`)}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <TableCell className="px-4 py-3 align-middle">
                            <span className="font-medium">{role.name}</span>
                          </TableCell>
                          <TableCell className="px-4 py-3 align-middle">
                            {role.description}
                          </TableCell>
                          <TableCell className="px-4 py-3 align-middle">
                            <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                              {role.permissionsCount ||
                                role.permissions?.length ||
                                0}{" "}
                              permissions
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-3 align-middle">
                            <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                              {userCount} {userCount === 1 ? "user" : "users"}
                            </span>
                          </TableCell>
                        <TableCell className="px-4 py-3 align-middle">
                          {role.createdAt
                            ? new Date(role.createdAt).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-2">
                            <div onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2">
                              {canCreate && (
                                <button
                                  onClick={() => navigate(`/role/${role._id}?edit=true`)}
                                  className="rounded p-1.5 text-brand-600 transition hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                                  title="Edit role"
                                >
                                  <PencilIcon className="size-4" />
                                </button>
                              )}

                              {canCreate && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const result = await Swal.fire({
                                      title: "Delete Role?",
                                      text: `Are you sure you want to delete the role "${role.name}"?`,
                                      icon: "warning",
                                      showCancelButton: true,
                                      confirmButtonColor: "#3085d6",
                                      cancelButtonColor: "#d33",
                                      confirmButtonText: "Yes, delete it!",
                                    });

                                    if (result.isConfirmed) {
                                      try {
                                        await deleteRoleMutation.mutateAsync(role._id);
                                        await Swal.fire({
                                          title: "Deleted!",
                                          text: "Role has been deleted successfully.",
                                          icon: "success",
                                          position: "center",
                                          timer: 2000,
                                          showConfirmButton: false,
                                          customClass: {
                                            container: "!mt-16",
                                          },
                                        });
                                      } catch (err: any) {
                                        console.error("Error deleting role:", err);
                                        const errorMsg = err.response?.data?.message || err.message || "Failed to delete role";
                                        await Swal.fire({
                                          title: "Error!",
                                          text: errorMsg,
                                          icon: "error",
                                          confirmButtonText: "OK",
                                        });
                                      }
                                    }
                                  }}
                                  className="rounded p-1.5 text-error-600 transition hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
                                  title="Delete role"
                                >
                                  <TrashBinIcon className="size-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                    })}
                  </TableBody>
                </Table>
              )}
            </ComponentCard>
          </div>

          {/* Permissions Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Permissions
              </h2>
            </div>

            {/* Permissions Table */}
            <ComponentCard title="All Permissions">
              {!permissions ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-brand-500 rounded-full animate-spin"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">
                      Loading permissions...
                    </p>
                  </div>
                </div>
              ) : permissions.length === 0 ? (
                <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                  No permissions found.
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
                        Description
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                      >
                        Actions
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                      >
                        Created At
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {permissions.map((permission) => (
                      <TableRow
                        key={permission._id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <TableCell className="px-4 py-3 align-middle">
                          <span className="font-medium">{permission.name}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 align-middle">
                          {permission.description || "No description"}
                        </TableCell>
                        <TableCell className="px-4 py-3 align-middle">
                          <div className="flex flex-wrap gap-1">
                            {(
                              permission.actions || ["read", "write", "create"]
                            ).map((action) => (
                              <span
                                key={action}
                                className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded"
                              >
                                {action}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 align-middle">
                          {permission.createdAt
                            ? new Date(
                                permission.createdAt
                              ).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ComponentCard>
          </div>
        </div>
      )}
    </>
  );
}
