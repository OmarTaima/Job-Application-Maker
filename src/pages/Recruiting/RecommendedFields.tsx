import { useState, useEffect } from "react";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Switch from "../../components/form/switch/Switch";
import Select from "../../components/form/Select";
import { PlusIcon, TrashBinIcon } from "../../icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  recommendedFieldsService,
  ApiError,
} from "../../services/recommendedFieldsService";
import type {
  RecommendedField,
  FieldType,
} from "../../services/recommendedFieldsService";

type FormField = {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  description?: string;
  defaultValue?: string;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
};

const RecommendedFields = () => {
  const [recommendedFields, setRecommendedFields] = useState<
    RecommendedField[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newChoice, setNewChoice] = useState("");
  const [form, setForm] = useState<FormField>({
    name: "",
    label: "",
    type: "text",
    required: false,
    options: [],
    description: "",
    validation: {},
  });

  useEffect(() => {
    loadRecommendedFields();
  }, []);

  const loadRecommendedFields = async () => {
    try {
      setLoading(true);
      const data = await recommendedFieldsService.getAllRecommendedFields();
      setRecommendedFields(data);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError
          ? err.message
          : "Failed to load recommended fields";
      setError(errorMessage);
      console.error("Error loading recommended fields:", err);
    } finally {
      setLoading(false);
    }
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
      const fieldData: any = {
        name: form.name || `field_${Date.now()}`,
        label: form.label,
        type: form.type,
        required: form.required,
      };

      // Add optional fields
      if (form.description) fieldData.description = form.description;
      if (form.options && form.options.length > 0)
        fieldData.options = form.options;

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

      await recommendedFieldsService.createRecommendedField(fieldData);
      await loadRecommendedFields();

      setForm({
        name: "",
        label: "",
        type: "text",
        required: false,
        options: [],
        description: "",
        validation: {},
      });
      setShowForm(false);
    } catch (err) {
      const errorMessage =
        err instanceof ApiError
          ? err.message
          : "Failed to create recommended field";
      alert(errorMessage);
      console.error("Error creating recommended field:", err);
    }
  };

  const handleDelete = async (fieldName: string) => {
    if (!confirm(`Are you sure you want to delete the field "${fieldName}"?`)) {
      return;
    }

    try {
      await recommendedFieldsService.deleteRecommendedField(fieldName);
      await loadRecommendedFields();
    } catch (err) {
      const errorMessage =
        err instanceof ApiError
          ? err.message
          : "Failed to delete recommended field";
      alert(errorMessage);
      console.error("Error deleting recommended field:", err);
    }
  };

  return (
    <>
      <PageMeta
        title="Recommended Fields - Admin"
        description="Manage reusable field templates"
      />
      <PageBreadcrumb pageTitle="Recommended Fields" />

      <div className="grid gap-6">
        {/* Recommended Fields List */}
        <ComponentCard
          title="Recommended Fields"
          desc="Manage reusable field templates for job creation"
        >
          <>
            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
                {error}
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Field Name *</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      placeholder="e.g., driving_license"
                    />
                  </div>

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
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={form.description || ""}
                      onChange={(e) =>
                        handleInputChange("description", e.target.value)
                      }
                      placeholder="Optional field description"
                    />
                  </div>

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
                      defaultChecked={form.required}
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
                        placeholder="Add an option"
                      />
                      <button
                        type="button"
                        onClick={handleAddChoice}
                        className="rounded-md bg-primary px-4 py-2 text-white hover:bg-primary/90"
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
                    onClick={() => setShowForm(false)}
                    className="rounded-md border border-stroke px-6 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-primary px-6 py-2 text-white hover:bg-primary/90"
                  >
                    Create Field
                  </button>
                </div>
              </form>
            )}

            {/* Table of Recommended Fields */}
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
                          Field Name
                        </TableCell>
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
                            No recommended fields found. Click "Add Recommended
                            Field" to create one.
                          </TableCell>
                        </TableRow>
                      ) : (
                        recommendedFields.map((field) => (
                          <TableRow key={field.name}>
                            <TableCell className="px-4 py-3 align-middle font-mono text-sm">
                              {field.name}
                            </TableCell>
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
                            <TableCell className="px-4 py-3 align-middle">
                              <button
                                onClick={() => handleDelete(field.name)}
                                className="text-red-500 hover:text-red-700"
                                title="Delete field"
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
    </>
  );
};

export default RecommendedFields;
