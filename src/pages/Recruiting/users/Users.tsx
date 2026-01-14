import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import Swal from "sweetalert2";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import ComponentCard from "../../../components/common/ComponentCard";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { ValidationErrorAlert } from "../../../components/common/ValidationErrorAlert";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import MultiSelect from "../../../components/form/MultiSelect";
import { PlusIcon, PencilIcon } from "../../../icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  useUsers,
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
  useUpdateUserCompanies,
  useAddUserCompany,
  useRemoveUserCompany,
  useRoles,
  usePermissions,
  useCompanies,
  useDepartments,
} from "../../../hooks/queries";

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
  permissions: Array<{
    permission: string;
    access: string[];
  }>;
};

const defaultUserForm: UserForm = {
  email: "",
  password: "",
  fullName: "",
  phone: "",
  roleId: "",
  companies: [],
  permissions: [],
};

export default function Users() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  // Check permissions
  const canRead = hasPermission("User Management", "read");
  const canCreate = hasPermission("User Management", "create");
  const canWrite = hasPermission("User Management", "write");
  
  // React Query hooks - data fetching happens automatically
  const { data: users = [], isLoading: usersLoading, error } = useUsers();
  const { data: roles = [] } = useRoles();
  const { data: permissions = [] } = usePermissions();
  const { data: companies = [] } = useCompanies();
  const { data: departments = [] } = useDepartments();

  // Mutations
  const createUserMutation = useCreateUser();
  const deleteUserMutation = useDeleteUser();
  const updateUserMutation = useUpdateUser();
  const updateUserCompaniesMutation = useUpdateUserCompanies();
  const addUserCompanyMutation = useAddUserCompany();
  const removeUserCompanyMutation = useRemoveUserCompany();

  const [userForm, setUserForm] = useState<UserForm>(defaultUserForm);
  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [originalUser, setOriginalUser] = useState<UserForm | null>(null);
  const [formError, setFormError] = useState("");
  const [isDeletingUser, setIsDeletingUser] = useState<string | null>(null);

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

  const loading = usersLoading;

  // If user doesn't have read permission, show access denied
  if (!canRead) {
    return (
      <div className="space-y-6">
        <PageMeta
          title="Users | TailAdmin React"
          description="Manage users in the system"
        />
        <PageBreadcrumb pageTitle="Users" />
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
            You don't have permission to view users
          </p>
        </div>
      </div>
    );
  }

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    console.log("Input changed:", name, "=", value);
    setUserForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError("");

    // Validate companies
    if (!userForm.companies || userForm.companies.length === 0) {
      setFormError("Please select at least one company");
      return;
    }

    setIsCreating(true);
    try {
      if (editingUserId && originalUser) {
        // Update existing user - detect what changed and send appropriate requests
        
        // 1. Check if permissions changed
        const permissionsChanged = JSON.stringify(userForm.permissions) !== JSON.stringify(originalUser.permissions);
        const roleChanged = userForm.roleId !== originalUser.roleId;
        
        if (permissionsChanged || roleChanged) {
          // PUT /users/:userId - update permissions and/or role
          await updateUserMutation.mutateAsync({
            id: editingUserId,
            data: {
              ...(roleChanged && { roleId: userForm.roleId }),
              ...(permissionsChanged && { permissions: userForm.permissions }),
            },
          });
        }
        
        // 2. Detect company changes
        const originalCompanyIds = originalUser.companies.map(c => c.companyId);
        const currentCompanyIds = userForm.companies.map(c => c.companyId);
        
        // Find added companies
        const addedCompanyIds = currentCompanyIds.filter(id => !originalCompanyIds.includes(id));
        
        // Find removed companies
        const removedCompanyIds = originalCompanyIds.filter(id => !currentCompanyIds.includes(id));
        
        // POST /users/:userId/companies - add new companies
        for (const companyId of addedCompanyIds) {
          await addUserCompanyMutation.mutateAsync({
            userId: editingUserId,
            companyId,
          });
        }
        
        // DELETE /users/:userId/companies/:companyId - remove companies
        for (const companyId of removedCompanyIds) {
          await removeUserCompanyMutation.mutateAsync({
            userId: editingUserId,
            companyId,
          });
        }
        
        // 3. PUT /users/:userId/companies/:companyId/departments - update departments for existing companies
        for (const company of userForm.companies) {
          // Skip newly added companies (already handled above)
          if (addedCompanyIds.includes(company.companyId)) continue;
          
          // Check if departments changed
          const originalCompany = originalUser.companies.find(c => c.companyId === company.companyId);
          if (originalCompany) {
            const depsChanged = JSON.stringify(company.departments.sort()) !== JSON.stringify(originalCompany.departments.sort());
            
            if (depsChanged) {
              await updateUserCompaniesMutation.mutateAsync({
                userId: editingUserId,
                companyId: company.companyId,
                data: { departments: company.departments },
              });
            }
          }
        }
      } else {
        // Create new user
        const payload = {
          fullName: userForm.fullName,
          email: userForm.email,
          password: userForm.password,
          roleId: userForm.roleId,
          companies: userForm.companies,
          ...(userForm.phone && { phone: userForm.phone }),
          ...(userForm.permissions.length > 0 && {
            permissions: userForm.permissions,
          }),
        };

        await createUserMutation.mutateAsync(payload);
      }

      // Show success message
      await Swal.fire({
        title: "Success!",
        text: editingUserId
          ? "User updated successfully."
          : "User created successfully.",
        icon: "success",
        toast: true,
        position: "top-end",
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: "!mt-16",
        },
      });

      // Reset form
      setUserForm(defaultUserForm);
      setEditingUserId(null);
      setShowForm(false);
    } catch (err: any) {
      console.error(
        editingUserId ? "Error updating user:" : "Error creating user:",
        err
      );
      const errorMsg = getErrorMessage(err);
      setFormError(errorMsg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const result = await Swal.fire({
      title: "Delete User?",
      text: "Are you sure you want to delete this user?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    try {
      setIsDeletingUser(userId);
      await deleteUserMutation.mutateAsync(userId);
      await Swal.fire({
        title: "Deleted!",
        text: "User has been deleted successfully.",
        icon: "success",
        toast: true,
        position: "top-end",
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: "!mt-16",
        },
      });
    } catch (err: any) {
      console.error("Error deleting user:", err);
      const errorMsg = getErrorMessage(err);
      setFormError(errorMsg);
    } finally {
      setIsDeletingUser(null);
    }
  };

  const handleEditUser = (user: any) => {
    // Extract user data and populate the form
    const userCompanies: CompanyAssignment[] =
      user.companies?.map((c: any) => ({
        companyId:
          typeof c.companyId === "string" ? c.companyId : c.companyId._id,
        departments: (c.departments || []).map((dept: any) => 
          typeof dept === "string" ? dept : dept._id
        ),
        isPrimary: c.isPrimary || false,
      })) || [];

    const userPermissions =
      user.permissions?.map((p: any) => {
        // Handle different permission structures
        let permissionId: string;
        if (typeof p === "string") {
          permissionId = p;
        } else if (p.permission) {
          // If permission is nested (e.g., {permission: {_id, name}, access: []})
          permissionId = typeof p.permission === "string" ? p.permission : p.permission._id;
        } else {
          // If permission is at top level (e.g., {_id, name, access: []})
          permissionId = p._id;
        }
        
        return {
          permission: permissionId,
          access: p.access || [],
        };
      }) || [];

    const formData = {
      email: user.email || "",
      password: "", // Don't populate password for security
      fullName: user.fullName || user.name || "",
      phone: user.phone || "",
      roleId:
        typeof user.roleId === "string" ? user.roleId : user.roleId?._id || "",
      companies: userCompanies,
      permissions: userPermissions,
    };
    
    setUserForm(formData);
    setOriginalUser(formData); // Store original state for comparison
    setEditingUserId(user._id);
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setUserForm(defaultUserForm);
    setOriginalUser(null);
    setEditingUserId(null);
    setShowForm(false);
    setFormError("");
  };

  return (
    <>
      <PageMeta
        title="Users | Job Application Maker"
        description="Manage system users, roles, and permissions"
      />
      <PageBreadcrumb pageTitle="Users" />

      {loading ? (
        <LoadingSpinner fullPage message="Loading users..." />
      ) : (
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
              {canCreate && (
                <button
                  onClick={() => {
                    if (showForm) {
                      handleCancelEdit();
                    } else {
                      setShowForm(true);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors"
                >
                  <PlusIcon className="w-5 h-5" />
                  {showForm ? "Cancel" : "Create User"}
                </button>
              )}
            </div>
          </div>

          {/* Create/Edit User Form */}
          {showForm && (
            <ComponentCard
              title={editingUserId ? "Edit User" : "Create New User"}
            >
              {isCreating ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">
                    {editingUserId ? "Updating user..." : "Creating user..."}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <ValidationErrorAlert 
                    error={formError} 
                    onDismiss={() => setFormError("")}
                  />

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
                        disabled={!!editingUserId}
                        className={
                          editingUserId ? "bg-gray-100 dark:bg-gray-800" : ""
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="password">
                        Password{" "}
                        {!editingUserId && (
                          <span className="text-red-500">*</span>
                        )}
                        {editingUserId && (
                          <span className="text-gray-500 text-xs ml-1">
                            (leave blank to keep current)
                          </span>
                        )}
                      </Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        value={userForm.password}
                        onChange={handleInputChange}
                        placeholder="••••••••"
                        required={!editingUserId}
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

                    {/* Additional Permissions */}
                    <div className="col-span-2">
                      <Label>Additional Permissions (Optional)</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        Select extra permissions and their access levels beyond
                        what the role provides
                      </p>

                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                                Permission
                              </th>
                              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                                Read
                              </th>
                              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                                Write
                              </th>
                              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                                Create
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {permissions.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={4}
                                  className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                                >
                                  No permissions available
                                </td>
                              </tr>
                            ) : (
                              permissions.map((perm) => {
                                // Check if permission is from selected role
                                const selectedRole = roles.find(
                                  (r) => r._id === userForm.roleId
                                );

                                // Debug logging
                                if (
                                  perm.name === "Analytics Management" &&
                                  selectedRole
                                ) {
                                  console.log("Selected Role:", selectedRole);
                                  console.log(
                                    "Role permissions:",
                                    selectedRole.permissions
                                  );
                                  console.log(
                                    "Checking permission:",
                                    perm._id,
                                    perm.name
                                  );
                                }

                                // Find role permission with access info (if role has detailed permissions structure)
                                const rolePermission =
                                  selectedRole?.permissions?.find((rp: any) => {
                                    const permId =
                                      typeof rp === "string"
                                        ? rp
                                        : rp.permission?._id || rp.permission;
                                    return permId === perm._id;
                                  }) as any;
                                const isFromRole = !!rolePermission;

                                // Get access from role permission if available
                                const roleAccess =
                                  typeof rolePermission === "object" &&
                                  rolePermission?.access
                                    ? rolePermission.access
                                    : isFromRole
                                    ? ["read", "write", "create"]
                                    : []; // Default to all access if role has permission

                                const userPerm = userForm.permissions.find(
                                  (p) => p.permission === perm._id
                                );
                                const isSelected = !!userPerm || isFromRole;
                                const access = isFromRole
                                  ? roleAccess
                                  : userPerm?.access || [];

                                return (
                                  <tr
                                    key={perm._id}
                                    className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${
                                      isFromRole
                                        ? "bg-green-50/50 dark:bg-green-900/10"
                                        : isSelected
                                        ? "bg-blue-50/50 dark:bg-blue-900/10"
                                        : ""
                                    }`}
                                  >
                                    <td className="px-4 py-3">
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          disabled={isFromRole}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              // Add permission with default access
                                              setUserForm((prev) => ({
                                                ...prev,
                                                permissions: [
                                                  ...prev.permissions,
                                                  {
                                                    permission: perm._id,
                                                    access: ["read"],
                                                  },
                                                ],
                                              }));
                                            } else {
                                              // Remove permission
                                              setUserForm((prev) => ({
                                                ...prev,
                                                permissions:
                                                  prev.permissions.filter(
                                                    (p) =>
                                                      p.permission !== perm._id
                                                  ),
                                              }));
                                            }
                                          }}
                                          className="w-4 h-4 text-brand-500 rounded focus:ring-brand-500 disabled:opacity-50"
                                        />
                                        <span className="text-sm text-gray-900 dark:text-gray-100">
                                          {perm.name}
                                          {isFromRole && (
                                            <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                                              (from role)
                                            </span>
                                          )}
                                        </span>
                                      </label>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <input
                                        type="checkbox"
                                        disabled={!isSelected || isFromRole}
                                        checked={access.includes("read")}
                                        onChange={(e) => {
                                          setUserForm((prev) => ({
                                            ...prev,
                                            permissions: prev.permissions.map(
                                              (p) =>
                                                p.permission === perm._id
                                                  ? {
                                                      ...p,
                                                      access: e.target.checked
                                                        ? [...p.access, "read"]
                                                        : p.access.filter(
                                                            (a) => a !== "read"
                                                          ),
                                                    }
                                                  : p
                                            ),
                                          }));
                                        }}
                                        className="w-4 h-4 text-brand-500 rounded focus:ring-brand-500 disabled:opacity-30"
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <input
                                        type="checkbox"
                                        disabled={!isSelected || isFromRole}
                                        checked={access.includes("write")}
                                        onChange={(e) => {
                                          setUserForm((prev) => ({
                                            ...prev,
                                            permissions: prev.permissions.map(
                                              (p) =>
                                                p.permission === perm._id
                                                  ? {
                                                      ...p,
                                                      access: e.target.checked
                                                        ? [...p.access, "write"]
                                                        : p.access.filter(
                                                            (a) => a !== "write"
                                                          ),
                                                    }
                                                  : p
                                            ),
                                          }));
                                        }}
                                        className="w-4 h-4 text-brand-500 rounded focus:ring-brand-500 disabled:opacity-30"
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <input
                                        type="checkbox"
                                        disabled={!isSelected || isFromRole}
                                        checked={access.includes("create")}
                                        onChange={(e) => {
                                          setUserForm((prev) => ({
                                            ...prev,
                                            permissions: prev.permissions.map(
                                              (p) =>
                                                p.permission === perm._id
                                                  ? {
                                                      ...p,
                                                      access: e.target.checked
                                                        ? [
                                                            ...p.access,
                                                            "create",
                                                          ]
                                                        : p.access.filter(
                                                            (a) =>
                                                              a !== "create"
                                                          ),
                                                    }
                                                  : p
                                            ),
                                          }));
                                        }}
                                        className="w-4 h-4 text-brand-500 rounded focus:ring-brand-500 disabled:opacity-30"
                                      />
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
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
                                  isPrimary: false,},
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
                        const companyDepartments = departments.filter(
                          (dept) => {
                            const deptCompanyId =
                              typeof dept.companyId === "string"
                                ? dept.companyId
                                : dept.companyId._id;
                            return (
                              deptCompanyId === companyAssignment.companyId
                            );
                          }
                        );

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
                                  const newCompanies =
                                    userForm.companies.filter(
                                      (_, i) => i !== index
                                    );
                            
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
                                <Label htmlFor={`company-${index}`}>
                                  Company
                                </Label>
                                <select
                                  id={`company-${index}`}
                                  value={companyAssignment.companyId}
                                  onChange={(e) => {
                                    const newCompanies = [
                                      ...userForm.companies,
                                    ];
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
                                          i !== index &&
                                          c.companyId === company._id
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
                                    const newCompanies = [
                                      ...userForm.companies,
                                    ];
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

                              {/* Primary Company (optional) */}
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`primary-${index}`}
                                  checked={companyAssignment.isPrimary}
                                  onChange={() => {
                                    const newCompanies = userForm.companies.map(
                                      (c, i) =>
                                        i === index
                                          ? { ...c, isPrimary: !c.isPrimary }
                                          : c
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
                                  Primary Company (optional)
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
                      onClick={handleCancelEdit}
                      className="px-6 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors"
                    >
                      {editingUserId ? "Update User" : "Create User"}
                    </button>
                  </div>
                </form>
              )}
            </ComponentCard>
          )}

          {/* Users Table */}
          <ComponentCard title="All Users">
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                Loading users...
              </div>
            ) : error ? (
              <div className="p-8 text-center text-red-600">
                {error instanceof Error ? error.message : String(error)}
              </div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No users found
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
                        ? user.roleId.name || "-"
                        : typeof user.roleId === "string" 
                        ? user.roleId 
                        : "-";
                    const userName = user.fullName || user.name || "-";

                    return (
                      <TableRow
                        key={user._id}
                        onClick={() => navigate(`/user/${user._id}`)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      >
            
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
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            {canWrite && (
                              <button
                                onClick={() => handleEditUser(user)}
                                className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors inline-flex items-center gap-1"
                              >
                                <PencilIcon className="w-3 h-3" />
                                Edit
                              </button>
                            )}
                            {canCreate && (
                              <button
                                onClick={() => handleDeleteUser(user._id)}
                                disabled={isDeletingUser === user._id}
                                className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isDeletingUser === user._id ? "Deleting..." : "Delete"}
                              </button>
                            )}
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
      )}
    </>
  );
}
