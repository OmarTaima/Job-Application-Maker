import type { ChangeEvent, FormEvent } from "react";
import { useState, useEffect } from "react";
import { Link } from "react-router";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import MultiSelect from "../../components/form/MultiSelect";
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
import { companiesService } from "../../services/companiesService";
import { departmentsService } from "../../services/departmentsService";
import type { User as ApiUser } from "../../services/usersService";
import type { Role } from "../../services/rolesService";
import type { Company } from "../../services/companiesService";
import type { Department } from "../../services/departmentsService";

type CompanyAssignment = {
  companyId: string;
  departments: string[];
  isPrimary: boolean;
};

type UserForm = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  roleId: string;
  companies: CompanyAssignment[];
};

const defaultUserForm: UserForm = {
  email: "",
  password: "",
  fullName: "",
  phone: "",
  roleId: "",
  companies: [],
};

export default function Users() {
  const [userForm, setUserForm] = useState<UserForm>(defaultUserForm);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    loadUsers();
    loadRoles();
    loadCompanies();
    loadDepartments();
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

  const loadCompanies = async () => {
    try {
      const data = await companiesService.getAllCompanies();
      setCompanies(data);
    } catch (err) {
      console.error("Error loading companies:", err);
    }
  };

  const loadDepartments = async () => {
    try {
      const data = await departmentsService.getAllDepartments();
      setDepartments(data);
    } catch (err) {
      console.error("Error loading departments:", err);
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

    // Validate companies
    if (!userForm.companies || userForm.companies.length === 0) {
      setError("Please select at least one company");
      return;
    }

    // Validate at least one primary company
    const hasPrimary = userForm.companies.some((c) => c.isPrimary);
    if (!hasPrimary) {
      setError("Please select a primary company");
      return;
    }

    const payload = {
      fullName: userForm.fullName,
      email: userForm.email,
      password: userForm.password,
      roleId: userForm.roleId,
      companies: userForm.companies,
      ...(userForm.phone && { phone: userForm.phone }),
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

                {/* Companies Section */}
                <div className="col-span-2 space-y-4">
                  <Label>
                    Companies <span className="text-red-500">*</span>
                  </Label>

                  {/* Add Company Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const availableCompanies = companies.filter(
                        (c) =>
                          !userForm.companies.some(
                            (uc) => uc.companyId === c._id
                          )
                      );
                      if (availableCompanies.length > 0) {
                        setUserForm({
                          ...userForm,
                          companies: [
                            ...userForm.companies,
                            {
                              companyId: availableCompanies[0]._id,
                              departments: [],
                              isPrimary: userForm.companies.length === 0,
                            },
                          ],
                        });
                      }
                    }}
                    className="w-full px-4 py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:border-brand-500 dark:hover:border-brand-500 transition-colors text-gray-600 dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-500 flex items-center justify-center gap-2"
                  >
                    <PlusIcon className="w-5 h-5" />
                    Add Company
                  </button>

                  {/* Company Assignments */}
                  {userForm.companies.map((companyAssignment, index) => {
                    const companyDepartments = departments.filter((dept) => {
                      const deptCompanyId =
                        typeof dept.companyId === "string"
                          ? dept.companyId
                          : dept.companyId._id;
                      return deptCompanyId === companyAssignment.companyId;
                    });

                    return (
                      <div
                        key={index}
                        className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3 bg-gray-50/50 dark:bg-gray-800/50"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">
                            Company {index + 1}
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              const newCompanies = userForm.companies.filter(
                                (_, i) => i !== index
                              );
                              // If removing primary, make first one primary
                              if (
                                companyAssignment.isPrimary &&
                                newCompanies.length > 0
                              ) {
                                newCompanies[0].isPrimary = true;
                              }
                              setUserForm({
                                ...userForm,
                                companies: newCompanies,
                              });
                            }}
                            className="text-red-500 hover:text-red-600 text-sm"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="space-y-3">
                          {/* Company Select */}
                          <div>
                            <Label htmlFor={`company-${index}`}>Company</Label>
                            <select
                              id={`company-${index}`}
                              value={companyAssignment.companyId}
                              onChange={(e) => {
                                const newCompanies = [...userForm.companies];
                                newCompanies[index] = {
                                  ...newCompanies[index],
                                  companyId: e.target.value,
                                  departments: [], // Reset departments when company changes
                                };
                                setUserForm({
                                  ...userForm,
                                  companies: newCompanies,
                                });
                              }}
                              className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                            >
                              {companies.map((company) => (
                                <option
                                  key={company._id}
                                  value={company._id}
                                  disabled={userForm.companies.some(
                                    (c, i) =>
                                      i !== index && c.companyId === company._id
                                  )}
                                >
                                  {company.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Departments MultiSelect */}
                          <div>
                            <Label htmlFor={`departments-${index}`}>
                              Departments (Optional)
                            </Label>
                            <MultiSelect
                              label=""
                              options={companyDepartments.map((dept) => ({
                                value: dept._id,
                                text: dept.name,
                              }))}
                              value={companyAssignment.departments}
                              onChange={(values) => {
                                const newCompanies = [...userForm.companies];
                                newCompanies[index] = {
                                  ...newCompanies[index],
                                  departments: values,
                                };
                                setUserForm({
                                  ...userForm,
                                  companies: newCompanies,
                                });
                              }}
                              placeholder={
                                companyDepartments.length === 0
                                  ? "No departments available"
                                  : "Select departments"
                              }
                              disabled={companyDepartments.length === 0}
                            />
                          </div>

                          {/* Primary Company Checkbox */}
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              id={`primary-${index}`}
                              name="primaryCompany"
                              checked={companyAssignment.isPrimary}
                              onChange={() => {
                                const newCompanies = userForm.companies.map(
                                  (c, i) => ({
                                    ...c,
                                    isPrimary: i === index,
                                  })
                                );
                                setUserForm({
                                  ...userForm,
                                  companies: newCompanies,
                                });
                              }}
                              className="w-4 h-4 text-brand-500 focus:ring-brand-500"
                            />
                            <Label
                              htmlFor={`primary-${index}`}
                              className="!mb-0"
                            >
                              Primary Company
                            </Label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
