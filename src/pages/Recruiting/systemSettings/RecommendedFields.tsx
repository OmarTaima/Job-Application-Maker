import { useState } from "react";
import Swal from "sweetalert2";
import ComponentCard from "../../../components/common/ComponentCard";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import Switch from "../../../components/form/switch/Switch";
import Select from "../../../components/form/Select";
import { PlusIcon, TrashBinIcon, PencilIcon } from "../../../icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  useRecommendedFields,
  useCreateRecommendedField,
  useUpdateRecommendedField,
  useDeleteRecommendedField,
} from "../../../hooks/queries";
import type { FieldType } from "../../../store/slices/recommendedFieldsSlice";

type FormField = {
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  defaultValue?: string;
  validation?: {
    min?: number | null;
    max?: number | null;
    minLength?: number | null;
    maxLength?: number | null;
    pattern?: string;
  };
};

const RecommendedFields = () => {
  // React Query hooks - data fetching happens automatically
  const {
    data: recommendedFields = [],
    isLoading: loading,
    error,
  } = useRecommendedFields();

  // Mutations
  const createFieldMutation = useCreateRecommendedField();
  const updateFieldMutation = useUpdateRecommendedField();
  const deleteFieldMutation = useDeleteRecommendedField();

  const [showForm, setShowForm] = useState(false);
  const [newChoice, setNewChoice] = useState("");
  const [form, setForm] = useState<FormField>({
    label: "",
    type: "text",
    required: false,
    options: [],
    validation: {},
  });
  const [editFieldId, setEditFieldId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeletingField, setIsDeletingField] = useState<string | null>(null);

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

  const inputTypeOptions = [
    { value: "text", label: "Text" },
    { value: "textarea", label: "Text Area" },
    { value: "number", label: "Number" },
    { value: "email", label: "Email" },
    { value: "date", label: "Date" },
    { value: "radio", label: "Radio" },
    { value: "dropdown", label: "Dropdown" },
    { value: "checkbox", label: "Checkbox" },
    { value: "url", label: "URL" },
    { value: "tags", label: "Tags" },
    { value: "boolean", label: "Boolean" },
  ];

  const handleInputChange = (
    field: string,
    value: string | number | boolean
  ) => {
    console.debug("handleInputChange", field, value);
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddChoice = () => {
    if (newChoice.trim()) {
      setForm((prev) => ({
        ...prev,
        options: [...(prev.options || []), newChoice.trim()],
      }));
      setNewChoice("");
    }
  };

  const handleRemoveChoice = (index: number) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options?.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const generatedId = `field_${Date.now()}`;
      const sanitizeLabelToId = (label?: string) => {
        if (!label) return generatedId;
        return label
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9\s_-]/g, "")
          .replace(/\s+/g, "_");
      };

      const mapTypeToInputType = (t: FieldType) => t;

      const fieldId = sanitizeLabelToId(form.label);

      const fieldData: any = {
        fieldId,
        label: form.label,
        inputType: mapTypeToInputType(form.type),
        isRequired: form.required,
      };

      // Add optional fields
      if (form.options && form.options.length > 0)
        fieldData.choices = form.options;

      // Add validation
      const validation: any = {};
      if (form.validation?.min !== undefined)
        validation.min = form.validation.min;
      if (form.validation?.max !== undefined)
        validation.max = form.validation.max;
      if (form.validation?.minLength !== undefined)
        validation.minLength = form.validation.minLength;
      if (form.validation?.maxLength !== undefined)
        validation.maxLength = form.validation.maxLength;
      if (form.validation?.pattern)
        validation.pattern = form.validation.pattern;
      if (Object.keys(validation).length > 0) fieldData.validation = validation;

      if (editFieldId) {
        // Update existing field (API expects inputType/isRequired/choices)
        const updatePayload: any = {
          label: form.label,
          inputType: mapTypeToInputType(form.type),
          isRequired: form.required,
        };
        if (form.options && form.options.length > 0)
          updatePayload.choices = form.options;
        if (Object.keys(fieldData.validation || {}).length > 0)
          updatePayload.validation = fieldData.validation;

        console.debug(
          "Updating recommended field:",
          editFieldId,
          updatePayload
        );
        await updateFieldMutation.mutateAsync({
          name: editFieldId,
          data: updatePayload,
        });
      } else {
        console.debug("Creating recommended field payload:", fieldData);
        await createFieldMutation.mutateAsync(fieldData);
      }

      await Swal.fire({
        title: "Success!",
        text: editFieldId
          ? "Field updated successfully."
          : "Field created successfully.",
        icon: "success",
        toast: true,
        position: "top-end",
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: "!mt-16",
        },
      });

      setForm({
        label: "",
        type: "text",
        required: false,
        options: [],
        validation: {},
      });
      setEditFieldId(null);
      setShowForm(false);
    } catch (err: any) {
      const errorMsg = getErrorMessage(err);
      setFormError(errorMsg);
      console.error("Error creating recommended field:", err);
    }
  };

  const handleDelete = async (fieldName: string) => {
    const result = await Swal.fire({
      title: "Delete Field?",
      text: `Are you sure you want to delete the field "${fieldName}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    try {
      setIsDeletingField(fieldName);
      await deleteFieldMutation.mutateAsync(fieldName);
      await Swal.fire({
        title: "Deleted!",
        text: "Field has been deleted successfully.",
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
      const errorMsg = getErrorMessage(err);
      setDeleteError(errorMsg);
      console.error("Error deleting recommended field:", err);
    } finally {
      setIsDeletingField(null);
    }
  };

  return (
    <>
      <PageMeta
        title="Recommended Fields - Admin"
        description="Manage reusable field templates"
      />
      <PageBreadcrumb pageTitle="Recommended Fields" />

      {loading ? (
        <LoadingSpinner fullPage message="Loading recommended fields..." />
      ) : (
        <div className="grid gap-6">
          {/* Recommended Fields List */}
          <ComponentCard
            title="Recommended Fields"
            desc="Manage reusable field templates for job creation"
          >
            <>
              {error && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
                  {String(error instanceof Error ? error.message : error)}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowForm(!showForm)}
                className="mb-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                <PlusIcon className="h-4 w-4" />
                {showForm ? "Cancel" : "Add Recommended Field"}
              </button>

              {showForm && (
                <form
                  onSubmit={handleSubmit}
                  className="mb-6 rounded-lg border border-stroke p-6 dark:border-strokedark"
                >
                  <h3 className="mb-4 text-lg font-semibold">
                    Create Recommended Field
                  </h3>

                  {formError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="label">Label *</Label>
                      <Input
                        id="label"
                        value={form.label}
                        onChange={(e) =>
                          handleInputChange("label", e.target.value)
                        }
                        placeholder="e.g., Driving License"
                      />
                    </div>

                    <div>
                      <Label htmlFor="type">Field Type *</Label>
                      <Select
                        options={inputTypeOptions}
                        placeholder="Select type"
                        onChange={(value) => handleInputChange("type", value)}
                        value={form.type}
                      />
                    </div>

                    {/* Description input removed */}

                    {form.type === "number" && (
                      <>
                        <div>
                          <Label htmlFor="minValue">Min Value</Label>
                          <Input
                            id="minValue"
                            type="number"
                            value={form.validation?.min || ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                validation: {
                                  ...prev.validation,
                                  min: parseFloat(e.target.value),
                                },
                              }))
                            }
                            placeholder="Minimum value"
                          />
                        </div>

                        <div>
                          <Label htmlFor="maxValue">Max Value</Label>
                          <Input
                            id="maxValue"
                            type="number"
                            value={form.validation?.max || ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                validation: {
                                  ...prev.validation,
                                  max: parseFloat(e.target.value),
                                },
                              }))
                            }
                            placeholder="Maximum value"
                          />
                        </div>
                      </>
                    )}

                    {(form.type === "text" || form.type === "textarea") && (
                      <>
                        <div>
                          <Label htmlFor="minLength">Min Length</Label>
                          <Input
                            id="minLength"
                            type="number"
                            value={form.validation?.minLength || ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                validation: {
                                  ...prev.validation,
                                  minLength: parseInt(e.target.value),
                                },
                              }))
                            }
                            placeholder="Minimum length"
                          />
                        </div>

                        <div>
                          <Label htmlFor="maxLength">Max Length</Label>
                          <Input
                            id="maxLength"
                            type="number"
                            value={form.validation?.maxLength || ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                validation: {
                                  ...prev.validation,
                                  maxLength: parseInt(e.target.value),
                                },
                              }))
                            }
                            placeholder="Maximum length"
                          />
                        </div>

                        <div className="col-span-2">
                          <Label htmlFor="pattern">
                            Validation Pattern (Regex)
                          </Label>
                          <Input
                            id="pattern"
                            value={form.validation?.pattern || ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                validation: {
                                  ...prev.validation,
                                  pattern: e.target.value,
                                },
                              }))
                            }
                            placeholder="e.g., ^https://.*"
                          />
                        </div>
                      </>
                    )}

                    <div className="flex items-center gap-3">
                      <Switch
                        label=""
                        checked={form.required}
                        onChange={(checked) =>
                          handleInputChange("required", checked)
                        }
                      />
                      <Label htmlFor="required">Required Field</Label>
                    </div>
                  </div>

                  {/* Options for radio, dropdown, checkbox, tags */}
                  {(form.type === "radio" ||
                    form.type === "dropdown" ||
                    form.type === "checkbox" ||
                    form.type === "tags") && (
                    <div className="mt-4">
                      <Label>Options</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newChoice}
                          onChange={(e) => setNewChoice(e.target.value)}
                          onKeyDown={(
                            e: React.KeyboardEvent<HTMLInputElement>
                          ) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddChoice();
                            }
                          }}
                          placeholder="Add an option"
                        />
                        <button
                          type="button"
                          onClick={handleAddChoice}
                          className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-500/90"
                        >
                          Add
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {form.options?.map((option, index) => (
                          <span
                            key={index}
                            className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-1 text-sm dark:bg-gray-800"
                          >
                            {option}
                            <button
                              type="button"
                              onClick={() => handleRemoveChoice(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Note: Group fields with sub-questions are not supported by the API */}

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setEditFieldId(null);
                      }}
                      className="rounded-md border border-stroke px-6 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-md bg-brand-500 px-6 py-2 text-white hover:bg-brand-500/90"
                    >
                      {editFieldId ? "Update Field" : "Create Field"}
                    </button>
                  </div>
                </form>
              )}

              {/* Table of Recommended Fields */}
              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start justify-between">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      <strong>Error:</strong> {deleteError}
                    </p>
                    <button
                      type="button"
                      onClick={() => setDeleteError("")}
                      className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
              {loading ? (
                <div className="p-12 text-center text-gray-500">
                  Loading recommended fields...
                </div>
              ) : (
                <div>
                  <div className="overflow-x-auto rounded-lg border border-stroke dark:border-strokedark">
                    <Table>
                      <TableHeader className="bg-gray-50 dark:bg-gray-800">
                        <TableRow>
                          <TableCell
                            isHeader
                            className="px-4 py-3 align-middle text-left font-semibold"
                          >
                            Label
                          </TableCell>
                          <TableCell
                            isHeader
                            className="px-4 py-3 align-middle text-left font-semibold"
                          >
                            Type
                          </TableCell>
                          <TableCell
                            isHeader
                            className="px-4 py-3 align-middle text-left font-semibold"
                          >
                            Required
                          </TableCell>
                          <TableCell
                            isHeader
                            className="px-4 py-3 align-middle text-left font-semibold"
                          >
                            Options
                          </TableCell>
                          <TableCell
                            isHeader
                            className="px-4 py-3 align-middle text-left font-semibold"
                          >
                            Actions
                          </TableCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recommendedFields.length === 0 ? (
                          <TableRow>
                            <TableCell className="px-4 py-8 text-center text-gray-500">
                              No recommended fields found. Click "Add
                              Recommended Field" to create one.
                            </TableCell>
                          </TableRow>
                        ) : (
                          recommendedFields.map((field) => (
                            <TableRow key={field.name || field.label}>
                              <TableCell className="px-4 py-3 align-middle">
                                {field.label}
                              </TableCell>
                              <TableCell className="px-4 py-3 align-middle">
                                <span className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
                                  {field.type}
                                </span>
                              </TableCell>
                              <TableCell className="px-4 py-3 align-middle">
                                {field.required ? (
                                  <span className="text-green-500">Yes</span>
                                ) : (
                                  <span className="text-gray-400">No</span>
                                )}
                              </TableCell>
                              <TableCell className="px-4 py-3 align-middle">
                                {field.options ? (
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {field.options.length} option
                                    {field.options.length !== 1 ? "s" : ""}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                              <TableCell className="px-4 py-3 align-middle flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    // populate form for editing
                                    const v = field.validation || {};
                                    setForm((prev) => ({
                                      ...prev,
                                      label: field.label || "",
                                      type: (field.type as FieldType) || "text",
                                      required: !!field.required,
                                      options: field.options || [],
                                      validation: {
                                        ...v,
                                        pattern: v.pattern ?? undefined,
                                      },
                                    }));
                                    setEditFieldId(field.name || field.label);
                                    setShowForm(true);
                                  }}
                                  className="text-gray-600 hover:text-gray-800"
                                  title="Edit field"
                                >
                                  <PencilIcon className="h-5 w-5" />
                                </button>

                                <button
                                  onClick={() =>
                                    handleDelete(field.name || field.label)
                                  }
                                  disabled={isDeletingField === (field.name || field.label)}
                                  className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={isDeletingField === (field.name || field.label) ? "Deleting..." : "Delete field"}
                                >
                                  <TrashBinIcon className="h-5 w-5" />
                                </button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          </ComponentCard>
        </div>
      )}
    </>
  );
};

export default RecommendedFields;
