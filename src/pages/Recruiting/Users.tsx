import type { ChangeEvent, FormEvent } from "react";
import { useState, useEffect } from "react";
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
import {
  usersService,
  ApiError as UsersApiError,
} from "../../services/usersService";
import { rolesService } from "../../services/rolesService";
import type { User as ApiUser } from "../../services/usersService";
import type { Role } from "../../services/rolesService";

type UserForm = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  roleId: string;
  department: string;
};

const defaultUserForm: UserForm = {
  email: "",
  password: "",
  fullName: "",
  phone: "",
  roleId: "",
  department: "",
};

export default function Users() {
  const [userForm, setUserForm] = useState<UserForm>(defaultUserForm);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await usersService.getAllUsers();
      console.log("Loaded users:", data);
      setUsers(data);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof UsersApiError ? err.message : "Failed to load users";
      setError(errorMessage);
      console.error("Error loading users:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const data = await rolesService.getAllRoles();
      setRoles(data);
    } catch (err) {
      console.error("Error loading roles:", err);
    }
  };

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    console.log("Input changed:", name, "=", value);
    setUserForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const payload = {
      fullName: userForm.fullName,
      email: userForm.email,
      password: userForm.password,
      roleId: userForm.roleId,
      ...(userForm.phone && { phone: userForm.phone }),
      ...(userForm.department && { department: userForm.department }),
    };

    console.log("Form state:", userForm);
    console.log("Creating user with payload:", payload);

    try {
      await usersService.createUser(payload);

      // Refresh users list
      await loadUsers();

      // Reset form
      setUserForm(defaultUserForm);
      setShowForm(false);
    } catch (err) {
      const errorMessage =
        err instanceof UsersApiError ? err.message : "Failed to create user";
      setError(errorMessage);
      console.error("Error creating user:", err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      await usersService.deleteUser(userId);
      await loadUsers();
    } catch (err) {
      const errorMessage =
        err instanceof UsersApiError ? err.message : "Failed to delete user";
      setError(errorMessage);
      console.error("Error deleting user:", err);
    }
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
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div>
                  <Label htmlFor="fullName">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    value={userForm.fullName}
                    onChange={handleInputChange}
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <Label htmlFor="email">
                    Email <span className="text-red-500">*</span>
                  </Label>
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
                  <Label htmlFor="password">
                    Password <span className="text-red-500">*</span>
                  </Label>
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
                  <Label htmlFor="roleId">
                    Role <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="roleId"
                    name="roleId"
                    value={userForm.roleId}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    <option value="">Select Role</option>
                    {roles.map((role) => (
                      <option key={role._id} value={role._id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    name="department"
                    value={userForm.department}
                    onChange={handleInputChange}
                    placeholder="Engineering"
                  />
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
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Loading users...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">{error}</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No users found</div>
          ) : (
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
                    Role
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
                    Actions
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const roleName =
                    typeof user.roleId === "object" && user.roleId
                      ? user.roleId.name
                      : user.roleId || "-";
                  const userName = user.fullName || user.name || "-";

                  return (
                    <TableRow
                      key={user._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <TableCell className="px-4 py-3 text-sm font-mono">
                        {user._id.slice(-8)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        {userName}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        {user.email}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        {user.phone || "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        {roleName}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">
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
                      <TableCell className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteUser(user._id)}
                            className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                          >
                            Delete
                          </button>
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
    </>
  );
}
