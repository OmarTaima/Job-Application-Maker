import type { ChangeEvent, FormEvent } from "react";
import { useState, useEffect } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import TextArea from "../../components/form/input/TextArea";
import { PlusIcon } from "../../icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  rolesService,
  type Permission,
  type Role,
  ApiError,
} from "../../services/rolesService";

type RoleForm = {
  name: string;
  description: string;
  permissions: string[];
};

type PermissionForm = {
  name: string;
  description: string;
  actions: string[];
};

const defaultRoleForm: RoleForm = {
  name: "",
  description: "",
  permissions: [],
};

const defaultPermissionForm: PermissionForm = {
  name: "",
  description: "",
  actions: [],
};

const availableAccess = ["read", "write", "create"];

export default function Permissions() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roleForm, setRoleForm] = useState<RoleForm>(defaultRoleForm);
  const [permissionForm, setPermissionForm] = useState<PermissionForm>(
    defaultPermissionForm
  );

  const [showRoleForm, setShowRoleForm] = useState(false);
  const [showPermissionForm, setShowPermissionForm] = useState(false);

  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [permissionAccess, setPermissionAccess] = useState<
    Record<string, string[]>
  >({});
  const [selectedAccess, setSelectedAccess] = useState<string[]>([]);

  // Load data on mount
  useEffect(() => {
    loadPermissions();
    loadRoles();
  }, []);

  const loadPermissions = async () => {
    try {
      setIsLoadingPermissions(true);
      setError(null);
      const data = await rolesService.getAllPermissions();
      console.log("Loaded permissions:", data);
      if (data.length > 0) {
        console.log("First permission structure:", data[0]);
      }
      setPermissions(data);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to load permissions";
      setError(errorMessage);
      console.error("Error loading permissions:", err);
    } finally {
      setIsLoadingPermissions(false);
    }
  };

  const loadRoles = async () => {
    try {
      setIsLoadingRoles(true);
      setError(null);
      const data = await rolesService.getAllRoles();
      setRoles(data);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to load roles";
      setError(errorMessage);
      console.error("Error loading roles:", err);
    } finally {
      setIsLoadingRoles(false);
    }
  };

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
    setError(null);

    // Build permissions array with access rights
    const permissionsWithAccess = selectedPermissions.map((permId) => ({
      permission: permId,
      access: permissionAccess[permId] || [],
    }));

    const payload = {
      name: roleForm.name,
      description: roleForm.description,
      permissions: permissionsWithAccess,
    };

    console.log("Role Creation Payload:", JSON.stringify(payload, null, 2));

    try {
      const newRole = await rolesService.createRole(payload);
      console.log("Role created successfully:", newRole);

      // Refresh roles list
      await loadRoles();

      // Reset form
      setRoleForm(defaultRoleForm);
      setSelectedPermissions([]);
      setPermissionAccess({});
      setShowRoleForm(false);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Failed to create role";
      setError(errorMessage);
      console.error("Error creating role:", err);
    }
  };

  // Permission handlers
  const handlePermissionInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setPermissionForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAccessToggle = (access: string) => {
    setSelectedAccess((prev) =>
      prev.includes(access)
        ? prev.filter((a) => a !== access)
        : [...prev, access]
    );
  };

  const handlePermissionSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const payload = {
      name: permissionForm.name,
      description: permissionForm.description,
      access: selectedAccess,
    };

    console.log(
      "Permission Creation Payload:",
      JSON.stringify(payload, null, 2)
    );

    // Mock: Add permission to list
    const newPermission: Permission = {
      _id: `PERM-${String(permissions.length + 1).padStart(3, "0")}`,
      name: permissionForm.name,
      description: permissionForm.description,
      actions: selectedAccess,
      createdAt: new Date().toISOString().split("T")[0],
    };

    setPermissions([...permissions, newPermission]);
    setPermissionForm(defaultPermissionForm);
    setSelectedAccess([]);
    setShowPermissionForm(false);
  };

  return (
    <>
      <PageMeta
        title="Permissions & Roles | Job Application Maker"
        description="Manage roles and permissions for user access control"
      />
      <PageBreadcrumb pageTitle="Permissions & Roles" />

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
            {error}
          </div>
        )}

        {/* Roles Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Roles
            </h2>
            <button
              onClick={() => setShowRoleForm(!showRoleForm)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              {showRoleForm ? "Cancel" : "Create Role"}
            </button>
          </div>

          {/* Create Role Form */}
          {showRoleForm && (
            <ComponentCard title="Create New Role">
              <form onSubmit={handleRoleSubmit} className="space-y-6">
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

                  <div className="md:col-span-2">
                    <Label htmlFor="roleDescription">Description</Label>
                    <TextArea
                      value={roleForm.description}
                      onChange={(value) =>
                        setRoleForm((prev) => ({ ...prev, description: value }))
                      }
                      placeholder="Describe the role responsibilities..."
                    />
                  </div>
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
                                    const allAccess: Record<string, string[]> =
                                      {};
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
                                    perm.actions || ["read", "write", "create"]
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
            {isLoadingRoles ? (
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
                  {roles.map((role) => (
                    <TableRow
                      key={role._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800"
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
                          {role.usersCount || 0} users
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        {role.createdAt
                          ? new Date(role.createdAt).toLocaleDateString()
                          : "N/A"}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              // TODO: Implement edit functionality
                              console.log("Edit role:", role._id);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              // TODO: Implement delete functionality
                              if (
                                window.confirm(
                                  `Are you sure you want to delete the role "${role.name}"?`
                                )
                              ) {
                                console.log("Delete role:", role._id);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
            {isLoadingPermissions ? (
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
                          ? new Date(permission.createdAt).toLocaleDateString()
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
    </>
  );
}
