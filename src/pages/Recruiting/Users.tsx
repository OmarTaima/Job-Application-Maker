import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { Link } from "react-router";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import { PlusIcon } from "../../icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";

type UserForm = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  roleId: string;
  companyId: string;
  departments: string[];
  isPrimary: boolean;
  permissions: {
    permissionId: string;
    access: string[];
  }[];
};

type User = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: string;
  company: string;
  departments: string[];
  createdAt: string;
  status: "active" | "inactive";
};

const defaultUserForm: UserForm = {
  email: "",
  password: "",
  fullName: "",
  phone: "",
  roleId: "",
  companyId: "",
  departments: [],
  isPrimary: true,
  permissions: [],
};

// Mock data
const mockUsers: User[] = [
  {
    id: "USR-001",
    email: "john.doe@company.com",
    fullName: "John Doe",
    phone: "+1234567890",
    role: "HR Manager",
    company: "Tech Solutions Inc.",
    departments: ["Engineering", "HR"],
    createdAt: "2025-12-20",
    status: "active",
  },
  {
    id: "USR-002",
    email: "jane.smith@company.com",
    fullName: "Jane Smith",
    phone: "+1234567891",
    role: "Recruiter",
    company: "Innovation Labs",
    departments: ["Recruitment"],
    createdAt: "2025-12-22",
    status: "active",
  },
];

const mockRoles = [
  {
    id: "ROLE-001",
    name: "HR Manager",
    permissions: ["PERM-001", "PERM-002", "PERM-003", "PERM-005"],
  },
  {
    id: "ROLE-002",
    name: "Recruiter",
    permissions: ["PERM-001", "PERM-005"],
  },
  {
    id: "ROLE-003",
    name: "Admin",
    permissions: ["PERM-001", "PERM-002", "PERM-003", "PERM-004", "PERM-005"],
  },
];

const mockCompanies = [
  { id: "COMP-001", name: "Tech Solutions Inc." },
  { id: "COMP-002", name: "Innovation Labs" },
];

const mockDepartments = [
  { id: "DEPT-001", name: "Engineering" },
  { id: "DEPT-002", name: "HR" },
  { id: "DEPT-003", name: "Recruitment" },
  { id: "DEPT-004", name: "Sales" },
];

const mockPermissions = [
  { id: "PERM-001", name: "View Users" },
  { id: "PERM-002", name: "Create Users" },
  { id: "PERM-003", name: "Edit Users" },
  { id: "PERM-004", name: "Delete Users" },
  { id: "PERM-005", name: "Manage Jobs" },
];

export default function Users() {
  const [userForm, setUserForm] = useState<UserForm>(defaultUserForm);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [showForm, setShowForm] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setUserForm((prev) => ({ ...prev, [name]: value }));

    // Auto-select role permissions when role is selected
    if (name === "roleId" && value) {
      const selectedRole = mockRoles.find((r) => r.id === value);
      if (selectedRole) {
        setRolePermissions(selectedRole.permissions);
        // Merge role permissions with any additional user permissions
        setSelectedPermissions((prev) => {
          const combined = [...new Set([...selectedRole.permissions, ...prev])];
          return combined;
        });
      }
    }
  };

  const handleDepartmentToggle = (deptId: string) => {
    setSelectedDepartments((prev) =>
      prev.includes(deptId)
        ? prev.filter((id) => id !== deptId)
        : [...prev, deptId]
    );
  };

  const handlePermissionToggle = (permId: string) => {
    // Don't allow unchecking role-based permissions
    if (rolePermissions.includes(permId)) {
      return;
    }

    setSelectedPermissions((prev) =>
      prev.includes(permId)
        ? prev.filter((id) => id !== permId)
        : [...prev, permId]
    );
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Prepare payload
    // Only include additional permissions (not from role)
    const additionalPermissions = selectedPermissions.filter(
      (permId) => !rolePermissions.includes(permId)
    );

    const payload = {
      email: userForm.email,
      password: userForm.password,
      fullName: userForm.fullName,
      phone: userForm.phone,
      roleId: userForm.roleId,
      companies: [
        {
          companyId: userForm.companyId,
          departments: selectedDepartments,
          isPrimary: userForm.isPrimary,
        },
      ],
      permissions: additionalPermissions.map((permId) => ({
        permission: permId,
        access: ["read", "write"],
      })),
    };

    console.log("User Creation Payload:", JSON.stringify(payload, null, 2));

    // Mock: Add user to list
    const newUser: User = {
      id: `USR-${String(users.length + 1).padStart(3, "0")}`,
      email: userForm.email,
      fullName: userForm.fullName,
      phone: userForm.phone,
      role: mockRoles.find((r) => r.id === userForm.roleId)?.name || "",
      company:
        mockCompanies.find((c) => c.id === userForm.companyId)?.name || "",
      departments: selectedDepartments.map(
        (id) => mockDepartments.find((d) => d.id === id)?.name || ""
      ),
      createdAt: new Date().toISOString().split("T")[0],
      status: "active",
    };

    setUsers([...users, newUser]);
    setUserForm(defaultUserForm);
    setSelectedDepartments([]);
    setSelectedPermissions([]);
    setRolePermissions([]);
    setShowForm(false);
  };

  return (
    <>
      <PageMeta
        title="Users | Job Application Maker"
        description="Manage system users, roles, and permissions"
      />
      <PageBreadcrumb pageTitle="Users" />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Users Management
          </h1>
          <div className="flex gap-3">
            <Link
              to="/permissions"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              Manage Permissions
            </Link>
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              {showForm ? "Cancel" : "Create User"}
            </button>
          </div>
        </div>

        {/* Create User Form */}
        {showForm && (
          <ComponentCard title="Create New User">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    value={userForm.fullName}
                    onChange={handleInputChange}
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={userForm.email}
                    onChange={handleInputChange}
                    placeholder="user@company.com"
                  />
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={userForm.password}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={userForm.phone}
                    onChange={handleInputChange}
                    placeholder="+1234567890"
                  />
                </div>

                <div>
                  <Label htmlFor="roleId">Role</Label>
                  <select
                    id="roleId"
                    name="roleId"
                    value={userForm.roleId}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Role</option>
                    {mockRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="companyId">Company</Label>
                  <select
                    id="companyId"
                    name="companyId"
                    value={userForm.companyId}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Company</option>
                    {mockCompanies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Departments */}
              <div>
                <Label>Departments</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                  {mockDepartments.map((dept) => (
                    <label
                      key={dept.id}
                      className="flex items-center gap-2 p-3 border border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDepartments.includes(dept.id)}
                        onChange={() => handleDepartmentToggle(dept.id)}
                        className="w-4 h-4 text-brand-500 rounded focus:ring-brand-500"
                      />
                      <span className="text-sm">{dept.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Permissions */}
              <div>
                <Label>Permissions</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Permissions from role are automatically selected. You can add
                  additional permissions for this user.
                </p>
                <div className="mt-2 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium w-12"></th>
                        <th className="px-4 py-3 text-left text-sm font-medium">
                          Permission
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium">
                          Source
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {mockPermissions.map((perm) => {
                        const isFromRole = rolePermissions.includes(perm.id);
                        const isSelected = selectedPermissions.includes(
                          perm.id
                        );

                        return (
                          <tr
                            key={perm.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handlePermissionToggle(perm.id)}
                                disabled={isFromRole}
                                className="w-4 h-4 text-brand-500 rounded focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm">{perm.name}</td>
                            <td className="px-4 py-3 text-sm">
                              {isFromRole ? (
                                <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                  From Role
                                </span>
                              ) : isSelected ? (
                                <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                                  Additional
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors"
                >
                  Create User
                </button>
              </div>
            </form>
          </ComponentCard>
        )}

        {/* Users Table */}
        <ComponentCard title="All Users">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell
                  isHeader
                  className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                >
                  User ID
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                >
                  Full Name
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
                  Role
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                >
                  Company
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 text-left text-sm font-medium bg-gray-50 dark:bg-gray-800"
                >
                  Departments
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
                  Created At
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <TableRow
                  key={user.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <TableCell className="px-4 py-3 align-middle">
                    {user.id}
                  </TableCell>
                  <TableCell className="px-4 py-3 align-middle">
                    {user.fullName}
                  </TableCell>
                  <TableCell className="px-4 py-3 align-middle">
                    {user.email}
                  </TableCell>
                  <TableCell className="px-4 py-3 align-middle">
                    {user.phone}
                  </TableCell>
                  <TableCell className="px-4 py-3 align-middle">
                    {user.role}
                  </TableCell>
                  <TableCell className="px-4 py-3 align-middle">
                    {user.company}
                  </TableCell>
                  <TableCell className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap gap-1">
                      {user.departments.map((dept, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                        >
                          {dept}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 align-middle">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        user.status === "active"
                          ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                          : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                      }`}
                    >
                      {user.status}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 align-middle">
                    {user.createdAt}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ComponentCard>
      </div>
    </>
  );
}
