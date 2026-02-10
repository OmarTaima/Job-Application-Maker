import type { ChangeEvent, FormEvent } from "react";
import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { useParams, useNavigate, useLocation } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import ComponentCard from "../../../components/common/ComponentCard";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { ValidationErrorAlert } from "../../../components/common/ValidationErrorAlert";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import MultiSelect from "../../../components/form/MultiSelect";
import { PlusIcon } from "../../../icons";
import {
  useUsers,
  useUpdateUser,
  useUpdateUserCompanies,
  useAddUserCompany,
  useRemoveUserCompany,
  useRoles,
  usePermissions,
  useCompanies,
  useDepartments,
} from "../../../hooks/queries";
import { toPlainString } from "../../../utils/strings";

type CompanyAssignment = {
  companyId: string;
  departments: string[];
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
  isActive: boolean;
};

export default function EditUser() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const userFromState = location.state?.user; // Get user data from navigation state

  // Fetch data
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: roles = [] } = useRoles();
  const { data: permissions = [] } = usePermissions();
  const { data: companies = [] } = useCompanies();
  const { data: departments = [] } = useDepartments();

  // Mutations
  const updateUserMutation = useUpdateUser();
  const updateUserCompaniesMutation = useUpdateUserCompanies();
  const addUserCompanyMutation = useAddUserCompany();
  const removeUserCompanyMutation = useRemoveUserCompany();

  const [userForm, setUserForm] = useState<UserForm>({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    roleId: "",
    companies: [],
    permissions: [],
    isActive: true,
  });
  const [originalUser, setOriginalUser] = useState<UserForm | null>(null);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Find the current user - use state data if available, otherwise find in fetched users
  const user = userFromState || users.find((u) => u._id === id);

  // Populate form when user data loads
  useEffect(() => {
    if (user) {
      const userCompanies: CompanyAssignment[] =
        user.companies?.filter((c: any) => c && c.companyId).map((c: any) => ({
          companyId:
            typeof c.companyId === "string" ? c.companyId : c.companyId?._id || "",
          departments: (c.departments || [])
            .filter((dept: any) => dept)
            .map((dept: any) => (typeof dept === "string" ? dept : dept._id)),
        })) || [];

      const userPermissions =
        user.permissions?.map((p: any) => {
          let permissionId: string;
          if (typeof p === "string") {
            permissionId = p;
          } else if (p.permission) {
            permissionId =
              typeof p.permission === "string" ? p.permission : p.permission._id;
          } else {
            permissionId = p._id;
          }

          return {
            permission: permissionId,
            access: p.access || [],
          };
        }) || [];

      const formData = {
        email: user.email || "",
        password: "",
        fullName: user.fullName || user.name || "",
        phone: user.phone || "",
        roleId:
          typeof user.roleId === "string" ? user.roleId : user.roleId?._id || "",
        companies: userCompanies,
        permissions: userPermissions,
        isActive: user.isActive !== false,
      };

      setUserForm(formData);
      setOriginalUser(formData);
    }
  }, [user]);

  // Helper function to extract detailed error messages
  const getErrorMessage = (err: any): string => {
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

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setUserForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError("");

    if (!originalUser || !id) return;

    // Validate companies
    if (!userForm.companies || userForm.companies.length === 0) {
      setFormError("Please select at least one company");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Check if basic info, permissions, or role changed
      const permissionsChanged =
        JSON.stringify(userForm.permissions) !==
        JSON.stringify(originalUser.permissions);
      const roleChanged = userForm.roleId !== originalUser.roleId;
      const basicInfoChanged =
        userForm.fullName !== originalUser.fullName ||
        userForm.phone !== originalUser.phone ||
        userForm.isActive !== originalUser.isActive;

      if (permissionsChanged || roleChanged || basicInfoChanged) {
        await updateUserMutation.mutateAsync({
          id,
          data: {
            ...(basicInfoChanged && {
              fullName: userForm.fullName,
              phone: userForm.phone,
              isActive: userForm.isActive,
            }),
            ...(roleChanged && { roleId: userForm.roleId }),
            ...(permissionsChanged && { permissions: userForm.permissions }),
          },
        });
      }

      // 2. Detect company changes
      const originalcompanyId = originalUser.companies.map((c) => c.companyId);
      const currentcompanyId = userForm.companies.map((c) => c.companyId);

      // Find added companies
      const addedcompanyId = currentcompanyId.filter(
        (cid) => !originalcompanyId.includes(cid)
      );

      // Find removed companies
      const removedcompanyId = originalcompanyId.filter(
        (cid) => !currentcompanyId.includes(cid)
      );

      // Add new companies
      for (const companyId of addedcompanyId) {
        await addUserCompanyMutation.mutateAsync({
          userId: id,
          companyId,
        });
      }

      // Remove companies
      for (const companyId of removedcompanyId) {
        await removeUserCompanyMutation.mutateAsync({
          userId: id,
          companyId,
        });
      }

      // 3. Update departments for existing companies
      for (const company of userForm.companies) {
        if (addedcompanyId.includes(company.companyId)) continue;

        const originalCompany = originalUser.companies.find(
          (c) => c.companyId === company.companyId
        );
        if (originalCompany) {
          const depsChanged =
            JSON.stringify(company.departments.sort()) !==
            JSON.stringify(originalCompany.departments.sort());

          if (depsChanged) {
            await updateUserCompaniesMutation.mutateAsync({
              userId: id,
              companyId: company.companyId,
              data: { departments: company.departments },
            });
          }
        }
      }

      await Swal.fire({
        title: "Success!",
        text: "User updated successfully.",
        icon: "success",
        position: "center",
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: "!mt-16",
        },
      });

      navigate("/users");
    } catch (err: any) {
      console.error("Error updating user:", err);
      const errorMsg = getErrorMessage(err);
      setFormError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

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
        title={`Edit ${userName} | Job Application Maker`}
        description={`Edit user information for ${userName}`}
      />

      <div className="flex items-center justify-between">
        <PageBreadcrumb pageTitle={`Edit User: ${userName}`} />
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>

      <ComponentCard title="Edit User">
        {isSaving ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Updating user...</p>
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
                  required
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
                  disabled
                  className="bg-gray-100 dark:bg-gray-800"
                />
              </div>

              <div>
                <Label htmlFor="password">
                  Password
                  <span className="text-gray-500 text-xs ml-1">
                    (leave blank to keep current)
                  </span>
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
                  required
                >
                  <option value="">Select Role</option>
                  {roles.filter((role) => role && role._id).map((role) => (
                    <option key={role._id} value={role._id}>
                      {toPlainString((role as any).name)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="isActive">Status</Label>
                <select
                  id="isActive"
                  name="isActive"
                  value={userForm.isActive ? "true" : "false"}
                  onChange={(e) =>
                    setUserForm({
                      ...userForm,
                      isActive: e.target.value === "true",
                    })
                  }
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>

              {/* Additional Permissions */}
              <div className="col-span-2">
                <Label>Additional Permissions (Optional)</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Select extra permissions and their access levels beyond what
                  the role provides
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
                          const selectedRole = roles.find(
                            (r) => r._id === userForm.roleId
                          );

                          const rolePermission =
                            selectedRole?.permissions?.find((rp: any) => {
                              const permId =
                                typeof rp === "string"
                                  ? rp
                                  : rp.permission?._id || rp.permission;
                              return permId === perm._id;
                            }) as any;
                          const isFromRole = !!rolePermission;

                          const roleAccess =
                            typeof rolePermission === "object" &&
                            rolePermission?.access
                              ? rolePermission.access
                              : isFromRole
                              ? ["read", "write", "create"]
                              : [];

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
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        if (!userPerm) {
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
                                        }
                                      } else {
                                        // If unchecking a role permission, add it with empty access to override
                                        if (isFromRole && !userPerm) {
                                          setUserForm((prev) => ({
                                            ...prev,
                                            permissions: [
                                              ...prev.permissions,
                                              {
                                                permission: perm._id,
                                                access: [],
                                              },
                                            ],
                                          }));
                                        } else {
                                          setUserForm((prev) => ({
                                            ...prev,
                                            permissions: prev.permissions.filter(
                                              (p) => p.permission !== perm._id
                                            ),
                                          }));
                                        }
                                      }
                                    }}
                                    className="w-4 h-4 text-brand-500 rounded focus:ring-brand-500"
                                  />
                                  <span className="text-sm text-gray-900 dark:text-gray-100">
                                    {perm.name}
                                    {isFromRole && !userPerm && (
                                      <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                                        (from role)
                                      </span>
                                    )}
                                    {isFromRole && userPerm && (
                                      <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                                        (overridden)
                                      </span>
                                    )}
                                  </span>
                                </label>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  disabled={!isSelected}
                                  checked={access.includes("read")}
                                  onChange={(e) => {
                                    // If modifying a role permission, add it to user permissions
                                    if (isFromRole && !userPerm) {
                                      setUserForm((prev) => ({
                                        ...prev,
                                        permissions: [
                                          ...prev.permissions,
                                          {
                                            permission: perm._id,
                                            access: e.target.checked ? ["read"] : [],
                                          },
                                        ],
                                      }));
                                    } else {
                                      setUserForm((prev) => ({
                                        ...prev,
                                        permissions: prev.permissions.map((p) =>
                                          p.permission === perm._id
                                            ? {
                                                ...p,
                                                access: e.target.checked
                                                  ? [...p.access, "read"]
                                                  : p.access.filter((a) => a !== "read"),
                                              }
                                            : p
                                        ),
                                      }));
                                    }
                                  }}
                                  className="w-4 h-4 text-brand-500 rounded focus:ring-brand-500 disabled:opacity-30"
                                />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  disabled={!isSelected}
                                  checked={access.includes("write")}
                                  onChange={(e) => {
                                    if (isFromRole && !userPerm) {
                                      setUserForm((prev) => ({
                                        ...prev,
                                        permissions: [
                                          ...prev.permissions,
                                          {
                                            permission: perm._id,
                                            access: e.target.checked ? ["write"] : [],
                                          },
                                        ],
                                      }));
                                    } else {
                                      setUserForm((prev) => ({
                                        ...prev,
                                        permissions: prev.permissions.map((p) =>
                                          p.permission === perm._id
                                            ? {
                                                ...p,
                                                access: e.target.checked
                                                  ? [...p.access, "write"]
                                                  : p.access.filter((a) => a !== "write"),
                                              }
                                            : p
                                        ),
                                      }));
                                    }
                                  }}
                                  className="w-4 h-4 text-brand-500 rounded focus:ring-brand-500 disabled:opacity-30"
                                />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  disabled={!isSelected}
                                  checked={access.includes("create")}
                                  onChange={(e) => {
                                    if (isFromRole && !userPerm) {
                                      setUserForm((prev) => ({
                                        ...prev,
                                        permissions: [
                                          ...prev.permissions,
                                          {
                                            permission: perm._id,
                                            access: e.target.checked ? ["create"] : [],
                                          },
                                        ],
                                      }));
                                    } else {
                                      setUserForm((prev) => ({
                                        ...prev,
                                        permissions: prev.permissions.map((p) =>
                                          p.permission === perm._id
                                            ? {
                                                ...p,
                                                access: e.target.checked
                                                  ? [...p.access, "create"]
                                                  : p.access.filter((a) => a !== "create"),
                                              }
                                            : p
                                        ),
                                      }));
                                    }
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
                        !userForm.companies.some((uc) => uc.companyId === c._id)
                    );
                    if (availableCompanies.length > 0) {
                      setUserForm({
                        ...userForm,
                        companies: [
                          ...userForm.companies,
                          {
                            companyId: availableCompanies[0]._id,
                            departments: [],
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
                                departments: [],
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
                                {toPlainString((company as any).name)}
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
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                disabled={isSaving}
                className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </ComponentCard>
    </div>
  );
}
