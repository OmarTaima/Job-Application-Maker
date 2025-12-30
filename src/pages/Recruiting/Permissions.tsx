import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
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

type Role = {
  id: string;
  name: string;
  description: string;
  permissionsCount: number;
  usersCount: number;
  createdAt: string;
};

type Permission = {
  id: string;
  name: string;
  description: string;
  actions: string[];
  createdAt: string;
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

// Mock data
const mockRoles: Role[] = [
  {
    id: "ROLE-001",
    name: "HR Manager",
    description: "Manages human resources and recruitment",
    permissionsCount: 12,
    usersCount: 5,
    createdAt: "2025-12-15",
  },
  {
    id: "ROLE-002",
    name: "Recruiter",
    description: "Handles job postings and candidate management",
    permissionsCount: 8,
    usersCount: 10,
    createdAt: "2025-12-16",
  },
  {
    id: "ROLE-003",
    name: "Admin",
    description: "Full system access and configuration",
    permissionsCount: 20,
    usersCount: 2,
    createdAt: "2025-12-10",
  },
];

const mockPermissions: Permission[] = [
  {
    id: "PERM-001",
    name: "View Users",
    description: "Can view user information",
    actions: ["read"],
    createdAt: "2025-12-15",
  },
  {
    id: "PERM-002",
    name: "Create Users",
    description: "Can create new users",
    actions: ["write"],
    createdAt: "2025-12-15",
  },
  {
    id: "PERM-003",
    name: "Edit Users",
    description: "Can edit existing users",
    actions: ["write"],
    createdAt: "2025-12-15",
  },
  {
    id: "PERM-004",
    name: "Delete Users",
    description: "Can delete users",
    actions: ["delete"],
    createdAt: "2025-12-15",
  },
  {
    id: "PERM-005",
    name: "Manage Jobs",
    description: "Can create, edit and delete jobs",
    actions: ["read", "write", "delete"],
    createdAt: "2025-12-16",
  },
];

const availableAccess = ["read", "write", "create"];

export default function Permissions() {
  const [roles, setRoles] = useState<Role[]>(mockRoles);
  const [permissions, setPermissions] = useState<Permission[]>(mockPermissions);

  const [roleForm, setRoleForm] = useState<RoleForm>(defaultRoleForm);
  const [permissionForm, setPermissionForm] = useState<PermissionForm>(
    defaultPermissionForm
  );

  const [showRoleForm, setShowRoleForm] = useState(false);
  const [showPermissionForm, setShowPermissionForm] = useState(false);

  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedAccess, setSelectedAccess] = useState<string[]>([]);

  // Role handlers
  const handleRoleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setRoleForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePermissionToggle = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId)
        ? prev.filter((id) => id !== permId)
        : [...prev, permId]
    );
  };

  const handleRoleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const payload = {
      name: roleForm.name,
      description: roleForm.description,
      permissions: selectedPermissions,
    };

    console.log("Role Creation Payload:", JSON.stringify(payload, null, 2));

    // Mock: Add role to list
    const newRole: Role = {
      id: `ROLE-${String(roles.length + 1).padStart(3, "0")}`,
      name: roleForm.name,
      description: roleForm.description,
      permissionsCount: selectedPermissions.length,
      usersCount: 0,
      createdAt: new Date().toISOString().split("T")[0],
    };

    setRoles([...roles, newRole]);
    setRoleForm(defaultRoleForm);
    setSelectedPermissions([]);
    setShowRoleForm(false);
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
      id: `PERM-${String(permissions.length + 1).padStart(3, "0")}`,
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
                                      permissions.map((p) => p.id)
                                    );
                                  } else {
                                    setSelectedPermissions([]);
                                  }
                                }}
                                checked={
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
                              key={perm.id}
                              className="hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.includes(
                                    perm.id
                                  )}
                                  onChange={() =>
                                    handlePermissionToggle(perm.id)
                                  }
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
                                  {perm.description}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {perm.actions.map((action) => (
                                    <span
                                      key={action}
                                      className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded"
                                    >
                                      {action}
                                    </span>
                                  ))}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell
                    isHeader
                    className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                  >
                    Role ID
                  </TableCell>
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
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-200 dark:divide-gray-700">
                {roles.map((role) => (
                  <TableRow
                    key={role.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <TableCell className="px-4 py-3 align-middle">
                      {role.id}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      <span className="font-medium">{role.name}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      {role.description}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                        {role.permissionsCount} permissions
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                        {role.usersCount} users
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      {role.createdAt}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ComponentCard>
        </div>

        {/* Permissions Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Permissions
            </h2>
            <button
              onClick={() => setShowPermissionForm(!showPermissionForm)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              {showPermissionForm ? "Cancel" : "Create Permission"}
            </button>
          </div>

          {/* Create Permission Form */}
          {showPermissionForm && (
            <ComponentCard title="Create New Permission">
              <form onSubmit={handlePermissionSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <Label htmlFor="permissionName">Permission Name</Label>
                    <Input
                      id="permissionName"
                      name="name"
                      value={permissionForm.name}
                      onChange={handlePermissionInputChange}
                      placeholder="View Users"
                    />
                  </div>

                  <div>
                    <Label htmlFor="permissionDescription">Description</Label>
                    <TextArea
                      value={permissionForm.description}
                      onChange={(value) =>
                        setPermissionForm((prev) => ({
                          ...prev,
                          description: value,
                        }))
                      }
                      placeholder="Describe what this permission allows..."
                    />
                  </div>
                </div>

                {/* Access Selection */}
                <div>
                  <Label>Access</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                    {availableAccess.map((access) => (
                      <label
                        key={access}
                        className="flex items-center gap-2 p-3 border border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAccess.includes(access)}
                          onChange={() => handleAccessToggle(access)}
                          className="w-4 h-4 text-brand-500 rounded focus:ring-brand-500"
                        />
                        <span className="text-sm capitalize">{access}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPermissionForm(false)}
                    className="px-6 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors"
                  >
                    Create Permission
                  </button>
                </div>
              </form>
            </ComponentCard>
          )}

          {/* Permissions Table */}
          <ComponentCard title="All Permissions">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell
                    isHeader
                    className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                  >
                    Permission ID
                  </TableCell>
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
                    key={permission.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <TableCell className="px-4 py-3 align-middle">
                      {permission.id}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      <span className="font-medium">{permission.name}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      {permission.description}
                    </TableCell>

                    <TableCell className="px-4 py-3 align-middle">
                      <div className="flex flex-wrap gap-1">
                        {permission.actions.map((action) => (
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
                      {permission.createdAt}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ComponentCard>
        </div>
      </div>
    </>
  );
}
