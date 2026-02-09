import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import ComponentCard from "../../../components/common/ComponentCard";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import Switch from "../../../components/form/switch/Switch";
import Select from "../../../components/form/Select";
import { PlusIcon, TrashBinIcon, PencilIcon, CheckCircleIcon } from "../../../icons";
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

type GroupField = {
  fieldId: string;
  label: string;
  labelAr?: string;
  inputType:
    | "text"
    | "number"
    | "email"
    | "date"
    | "checkbox"
    | "radio"
    | "dropdown"
    | "textarea"
    | "url"
    | "tags";
  isRequired: boolean;
  choices?: string[];
  choicesAr?: string[];
};

type FormField = {
  label: string;
  labelAr: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  optionsAr?: string[];
  defaultValue?: string;
  validation?: {
    min?: number | null;
    max?: number | null;
  };
  groupFields?: GroupField[];
};

const subFieldTypeOptions = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "date", label: "Date" },
  { value: "radio", label: "Radio" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "url", label: "URL" },
  { value: "tags", label: "Tags" },
];

const RecommendedFields = () => {
  // React Query hooks - data fetching happens automatically
  const {
    data: recommendedFields = [],
    isLoading: loading,
    error,
  } = useRecommendedFields();

  // Log fetched fields for debugging
  useEffect(() => {
    if (recommendedFields.length > 0) {
      console.log("Fetched recommended fields:", recommendedFields);
      console.log("Field IDs:", recommendedFields.map(f => f.fieldId));
    }
  }, [recommendedFields]);

  // Mutations
  const createFieldMutation = useCreateRecommendedField();
  const updateFieldMutation = useUpdateRecommendedField();
  const deleteFieldMutation = useDeleteRecommendedField();

  const [showForm, setShowForm] = useState(false);
  const [newChoice, setNewChoice] = useState("");
  const [newChoiceAr, setNewChoiceAr] = useState("");
  const [editingChoiceIndex, setEditingChoiceIndex] = useState<number | null>(null);
  const [editChoiceValue, setEditChoiceValue] = useState("");
  const [editChoiceValueAr, setEditChoiceValueAr] = useState("");
  const [newGroupFieldChoice, setNewGroupFieldChoice] = useState<Record<string, string>>({});
  const [newGroupFieldChoiceAr, setNewGroupFieldChoiceAr] = useState<Record<string, string>>({});
  const [form, setForm] = useState<FormField>({
    label: "",
    labelAr: "",
    type: "text",
    required: false,
    options: [],
    optionsAr: [],
    validation: {},
    groupFields: [],
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
    { value: "repeatable_group", label: "Repeatable Group" },
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
        optionsAr: [...(prev.optionsAr || []), newChoiceAr.trim() || newChoice.trim()],
      }));
      setNewChoice("");
      setNewChoiceAr("");
    }
  };

  const handleRemoveChoice = (index: number) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options?.filter((_, i) => i !== index),
      optionsAr: prev.optionsAr?.filter((_, i) => i !== index),
    }));
    // If we're editing this choice, cancel edit
    if (editingChoiceIndex === index) {
      setEditingChoiceIndex(null);
      setEditChoiceValue("");
      setEditChoiceValueAr("");
    }
  };

  const handleEditChoice = (index: number) => {
    setEditingChoiceIndex(index);
    setEditChoiceValue(form.options?.[index] || "");
    setEditChoiceValueAr(form.optionsAr?.[index] || "");
  };

  const handleUpdateChoice = () => {
    if (editingChoiceIndex !== null && editChoiceValue.trim()) {
      setForm((prev) => ({
        ...prev,
        options: prev.options?.map((opt, i) => i === editingChoiceIndex ? editChoiceValue : opt),
        optionsAr: prev.optionsAr?.map((opt, i) => i === editingChoiceIndex ? (editChoiceValueAr.trim() || editChoiceValue) : opt),
      }));
      setEditingChoiceIndex(null);
      setEditChoiceValue("");
      setEditChoiceValueAr("");
    }
  };

  const handleCancelEditChoice = () => {
    setEditingChoiceIndex(null);
    setEditChoiceValue("");
    setEditChoiceValueAr("");
  };

  // GroupField handlers
  const handleAddGroupField = () => {
    const newGroupField: GroupField = {
      fieldId: `groupfield_${Date.now()}`,
      label: "",
      inputType: "text",
      isRequired: false,
    };
    setForm((prev) => ({
      ...prev,
      groupFields: [...(prev.groupFields || []), newGroupField],
    }));
  };

  const handleRemoveGroupField = (groupFieldIndex: number) => {
    setForm((prev) => ({
      ...prev,
      groupFields: prev.groupFields?.filter((_, si) => si !== groupFieldIndex),
    }));
  };

  const handleGroupFieldChange = (
    groupFieldIndex: number,
    field: keyof GroupField,
    value: any
  ) => {
    setForm((prev) => ({
      ...prev,
      groupFields: prev.groupFields?.map((gf, si) =>
        si === groupFieldIndex ? { ...gf, [field]: value } : gf
      ),
    }));
  };

  const handleAddGroupFieldChoice = (groupFieldIndex: number) => {
    const key = `${groupFieldIndex}`;
    const choice = newGroupFieldChoice[key] || "";
    const choiceAr = newGroupFieldChoiceAr[key] || "";
    if (choice.trim()) {
      setForm((prev) => ({
        ...prev,
        groupFields: prev.groupFields?.map((gf, si) =>
          si === groupFieldIndex
            ? {
                ...gf,
                choices: [...(gf.choices || []), choice],
                choicesAr: [...(gf.choicesAr || []), choiceAr.trim() || choice],
              }
            : gf
        ),
      }));
      setNewGroupFieldChoice(prev => ({ ...prev, [key]: "" }));
      setNewGroupFieldChoiceAr(prev => ({ ...prev, [key]: "" }));
    }
  };

  const handleRemoveGroupFieldChoice = (
    groupFieldIndex: number,
    choiceIndex: number
  ) => {
    setForm((prev) => ({
      ...prev,
      groupFields: prev.groupFields?.map((gf, si) =>
        si === groupFieldIndex
          ? {
              ...gf,
              choices: gf.choices?.filter((_, ci) => ci !== choiceIndex),
              choicesAr: gf.choicesAr?.filter((_, ci) => ci !== choiceIndex),
            }
          : gf
      ),
    }));
  };

  // Helper to convert API response objects to strings
  const convertToString = (value: any): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
      // Check if it's a bilingual object {en: string, ar: string}
      if (value.en) return value.en;
      // Otherwise it's an indexed object like {0: 'E', 1: 'x', 2: 'e', ...}
      return Object.keys(value)
        .filter(key => !isNaN(Number(key)) && key !== '_id')
        .sort((a, b) => Number(a) - Number(b))
        .map(key => value[key])
        .join('');
    }
    return '';
  };

  const convertChoicesArray = (choices: any): string[] => {
    if (!Array.isArray(choices)) return [];
    return choices.map((choice: any) => {
      if (typeof choice === 'object' && choice !== null && choice.en) {
        return choice.en;
      }
      return convertToString(choice);
    });
  };

  const convertChoicesArrayAr = (choices: any): string[] => {
    if (!Array.isArray(choices)) return [];
    return choices.map((choice: any) => {
      if (typeof choice === 'object' && choice !== null && choice.ar) {
        return choice.ar;
      }
      return convertToString(choice);
    });
  };

  // Map input type value to a human friendly label
  const getInputTypeLabel = (val: string) => {
    const opt = inputTypeOptions.find((o) => o.value === val);
    return opt ? opt.label : val;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const mapTypeToInputType = (t: FieldType) => t;
      
      // Convert label to snake_case for fieldId (e.g., "Military Status" -> "military_status")
      const generateFieldId = (label: string) => {
        return label
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '') // Remove special characters
          .replace(/\s+/g, '_'); // Replace spaces with underscores
      };

      // Backend Mongoose schema expects bilingual objects
      const bilingualLabel = {
        en: form.label,
        ar: form.labelAr || form.label,
      };

      const bilingualChoices = form.options?.map((option, index) => ({
        en: option,
        ar: form.optionsAr?.[index] || option,
      }));

      const fieldData: any = {
        fieldId: editFieldId || generateFieldId(form.label),
        label: bilingualLabel,
        inputType: mapTypeToInputType(form.type),
        isRequired: form.required,
        displayOrder: 0,
      };

      // Add choices as bilingual array
      if (bilingualChoices && bilingualChoices.length > 0) {
        fieldData.choices = bilingualChoices;
      }

      // Add validation fields directly (not nested)
      if (form.validation?.min !== undefined && form.validation.min !== null) {
        fieldData.minValue = form.validation.min;
      }
      if (form.validation?.max !== undefined && form.validation.max !== null) {
        fieldData.maxValue = form.validation.max;
      }

      // Add groupFields for repeatable_group
      if (form.type === "repeatable_group" && form.groupFields && form.groupFields.length > 0) {
        fieldData.groupFields = form.groupFields.map((gf) => ({
          fieldId: gf.fieldId,
          label: { en: gf.label, ar: gf.labelAr || gf.label },
          inputType: gf.inputType,
          isRequired: gf.isRequired,
          ...(gf.choices && gf.choices.length > 0
            ? {
                choices: gf.choices.map((choice, idx) => ({
                  en: choice,
                  ar: gf.choicesAr?.[idx] || choice,
                })),
              }
            : {}),
        }));
      }

      if (editFieldId) {
        // Update existing field
        const updatePayload: any = {
          label: bilingualLabel,
          inputType: mapTypeToInputType(form.type),
          isRequired: form.required,
        };
        if (bilingualChoices && bilingualChoices.length > 0) {
          updatePayload.choices = bilingualChoices;
        }
        // Add validation fields directly
        if (form.validation?.min !== undefined && form.validation.min !== null) {
          updatePayload.minValue = form.validation.min;
        }
        if (form.validation?.max !== undefined && form.validation.max !== null) {
          updatePayload.maxValue = form.validation.max;
        }

        // Add groupFields for repeatable_group
        if (form.type === "repeatable_group" && form.groupFields && form.groupFields.length > 0) {
          updatePayload.groupFields = form.groupFields.map((gf) => ({
            fieldId: gf.fieldId,
            label: { en: gf.label, ar: gf.labelAr || gf.label },
            inputType: gf.inputType,
            isRequired: gf.isRequired,
            ...(gf.choices && gf.choices.length > 0
              ? {
                  choices: gf.choices.map((choice, idx) => ({
                    en: choice,
                    ar: gf.choicesAr?.[idx] || choice,
                  })),
                }
              : {}),
          }));
        }

        console.debug(
          "Updating recommended field:",
          "editFieldId:", editFieldId,
          "updatePayload:", updatePayload
        );
        await updateFieldMutation.mutateAsync({
          fieldId: editFieldId,
          data: updatePayload,
        });
      } else {
        console.debug("Creating recommended field payload:", fieldData);
        console.log("FULL PAYLOAD BEING SENT:", JSON.stringify(fieldData, null, 2));
        await createFieldMutation.mutateAsync(fieldData);
      }

      await Swal.fire({
        title: "Success!",
        text: editFieldId
          ? "Field updated successfully."
          : "Field created successfully.",
        icon: "success",
        position: "center",
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: "!mt-16",
        },
      });

      setForm({
        label: "",
        labelAr: "",
        type: "text",
        required: false,
        options: [],
        optionsAr: [],
        validation: {},
        groupFields: [],
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
        position: "center",
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
                onClick={() => {
                  // If opening the form for adding a new field, reset form state
                  if (!showForm) {
                    setForm({
                      label: "",
                      labelAr: "",
                      type: "text",
                      required: false,
                      options: [],
                      optionsAr: [],
                      validation: {},
                      groupFields: [],
                    });
                    setEditFieldId(null);
                    setNewChoice("");
                    setNewChoiceAr("");
                    setEditingChoiceIndex(null);
                    setEditChoiceValue("");
                    setEditChoiceValueAr("");
                  }
                  setShowForm(!showForm);
                }}
                className="mb-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 sm:px-4 py-1.5 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
              >
                <PlusIcon className="h-3 w-3 sm:h-4 sm:w-4" />
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
                      <Label htmlFor="label">Label (English) *</Label>
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
                      <Label htmlFor="labelAr">Label (Arabic) *</Label>
                      <Input
                        id="labelAr"
                        value={form.labelAr}
                        onChange={(e) =>
                          handleInputChange("labelAr", e.target.value)
                        }
                        placeholder="e.g., رخصة القيادة"
                      />
                    </div>

                    <div className="col-span-2">
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
                      <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                        <div>
                          <Label>Choices (English)</Label>
                          <div className="flex gap-2">
                            <div className="flex-1">
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
                                placeholder="Add a choice"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleAddChoice}
                              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
                            >
                              <PlusIcon className="size-4" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <Label>Choices (Arabic)</Label>
                          <div className="flex gap-2">
                            <div dir="rtl" className="flex-1">
                              <Input
                                value={newChoiceAr}
                                onChange={(e) => setNewChoiceAr(e.target.value)}
                                onKeyDown={(
                                  e: React.KeyboardEvent<HTMLInputElement>
                                ) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddChoice();
                                  }
                                }}
                                placeholder="أضف خيارًا"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleAddChoice}
                              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
                            >
                              <PlusIcon className="size-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                        {form.options?.map((option, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
                          >
                            {editingChoiceIndex === index ? (
                              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                                <Input
                                  value={editChoiceValue}
                                  onChange={(e) => setEditChoiceValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleUpdateChoice();
                                    } else if (e.key === "Escape") {
                                      handleCancelEditChoice();
                                    }
                                  }}
                                  placeholder="English"
                                />
                                <Input
                                  value={editChoiceValueAr}
                                  onChange={(e) => setEditChoiceValueAr(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleUpdateChoice();
                                    } else if (e.key === "Escape") {
                                      handleCancelEditChoice();
                                    }
                                  }}
                                  placeholder="Arabic"
                                />
                              </div>
                            ) : (
                              <span className="text-gray-700 dark:text-gray-300">
                                EN: {option}
                                {form.optionsAr?.[index] && (
                                  <span className="mt-1 block" dir="rtl">
                                    AR: {form.optionsAr[index]}
                                  </span>
                                )}
                              </span>
                            )}
                            <div className="flex items-center gap-2">
                              {editingChoiceIndex === index ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={handleUpdateChoice}
                                    className="text-brand-600 hover:text-brand-700 dark:text-brand-400"
                                    title="Save"
                                  >
                                    <CheckCircleIcon className="size-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEditChoice}
                                    className="text-gray-600 hover:text-gray-700 dark:text-gray-400"
                                    title="Cancel"
                                  >
                                    ×
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleEditChoice(index)}
                                    className="text-brand-600 hover:text-brand-700 dark:text-brand-400"
                                    title="Edit"
                                  >
                                    <PencilIcon className="size-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveChoice(index)}
                                    className="text-error-600 hover:text-error-700 dark:text-error-400"
                                    title="Delete"
                                  >
                                    <TrashBinIcon className="size-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Repeatable Group Sub-Questions */}
                  {form.type === "repeatable_group" && (
                    <div className="mt-4 border-l-4 border-brand-500 pl-4">
                      <div className="mb-3 flex items-center justify-between">
                        <Label>Sub-Questions</Label>
                        <button
                          type="button"
                          onClick={handleAddGroupField}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-200 dark:bg-brand-900/30 dark:text-brand-300"
                        >
                          <PlusIcon className="size-3" />
                          Add Sub-Question
                        </button>
                      </div>

                      <div className="space-y-4">
                        {form.groupFields?.map((groupField, groupFieldIndex) => (
                          <div
                            key={groupField.fieldId}
                            className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Sub-Question #{groupFieldIndex + 1}
                              </h5>
                              <button
                                type="button"
                                onClick={() => handleRemoveGroupField(groupFieldIndex)}
                                className="text-error-600 hover:text-error-700 dark:text-error-400"
                              >
                                <TrashBinIcon className="size-4" />
                              </button>
                            </div>

                            <div className="space-y-3">
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div>
                                  <Label htmlFor={`groupfield-label-${groupFieldIndex}`}>
                                    Label (English)
                                  </Label>
                                  <Input
                                    id={`groupfield-label-${groupFieldIndex}`}
                                    value={groupField.label}
                                    onChange={(e) =>
                                      handleGroupFieldChange(
                                        groupFieldIndex,
                                        "label",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Enter question label"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`groupfield-label-ar-${groupFieldIndex}`}>
                                    Label (Arabic)
                                  </Label>
                                  <div dir="rtl">
                                    <Input
                                      id={`groupfield-label-ar-${groupFieldIndex}`}
                                      value={groupField.labelAr || ""}
                                      onChange={(e) =>
                                        handleGroupFieldChange(
                                          groupFieldIndex,
                                          "labelAr",
                                          e.target.value
                                        )
                                      }
                                      placeholder="أدخل تسمية السؤال"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label htmlFor={`groupfield-type-${groupFieldIndex}`}>
                                    Input Type
                                  </Label>
                                  <Select
                                    options={subFieldTypeOptions}
                                    value={groupField.inputType}
                                    placeholder="Select type"
                                    onChange={(value) =>
                                      handleGroupFieldChange(
                                        groupFieldIndex,
                                        "inputType",
                                        value
                                      )
                                    }
                                  />
                                </div>

                                <div className="flex items-end pb-2">
                                  <Switch
                                    label="Required"
                                    checked={groupField.isRequired}
                                    onChange={(checked) =>
                                      handleGroupFieldChange(
                                        groupFieldIndex,
                                        "isRequired",
                                        checked
                                      )
                                    }
                                  />
                                </div>
                              </div>

                              {/* Group field choices for radio, checkbox, dropdown */}
                              {(groupField.inputType === "radio" ||
                                groupField.inputType === "checkbox" ||
                                groupField.inputType === "dropdown") && (
                                <div>
                                  <Label>Choices (English)</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      value={newGroupFieldChoice[`${groupFieldIndex}`] || ""}
                                      onChange={(e) =>
                                        setNewGroupFieldChoice(prev => ({ ...prev, [`${groupFieldIndex}`]: e.target.value }))
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          handleAddGroupFieldChoice(groupFieldIndex);
                                        }
                                      }}
                                      placeholder="Add a choice"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleAddGroupFieldChoice(groupFieldIndex)}
                                      className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
                                    >
                                      <PlusIcon className="size-4" />
                                    </button>
                                  </div>
                                  <div className="mt-2">
                                    <Label>Choices (Arabic)</Label>
                                    <div className="flex gap-2">
                                      <div dir="rtl" className="flex-1">
                                        <Input
                                          value={newGroupFieldChoiceAr[`${groupFieldIndex}`] || ""}
                                          onChange={(e) =>
                                            setNewGroupFieldChoiceAr(prev => ({ ...prev, [`${groupFieldIndex}`]: e.target.value }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                              handleAddGroupFieldChoice(groupFieldIndex);
                                            }
                                          }}
                                          placeholder="أضف خيارًا"
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleAddGroupFieldChoice(groupFieldIndex)}
                                        className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
                                      >
                                        <PlusIcon className="size-4" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="mt-2 space-y-1">
                                    {groupField.choices?.map((choice, choiceIndex) => (
                                      <div
                                        key={choiceIndex}
                                        className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
                                      >
                                        <span className="text-gray-700 dark:text-gray-300">
                                          EN: {choice}
                                          {groupField.choicesAr?.[choiceIndex] && (
                                            <span className="mt-1 block" dir="rtl">
                                              AR: {groupField.choicesAr[choiceIndex]}
                                            </span>
                                          )}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRemoveGroupFieldChoice(
                                              groupFieldIndex,
                                              choiceIndex
                                            )
                                          }
                                          className="text-error-600 hover:text-error-700 dark:text-error-400"
                                        >
                                          <TrashBinIcon className="size-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setEditFieldId(null);
                        setForm({
                          label: "",
                          labelAr: "",
                          type: "text",
                          required: false,
                          options: [],
                          optionsAr: [],
                          validation: {},
                          groupFields: [],
                        });
                        setNewChoice("");
                        setNewChoiceAr("");
                        setEditingChoiceIndex(null);
                        setEditChoiceValue("");
                        setEditChoiceValueAr("");
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
                            <TableRow key={field.fieldId}>
                              <TableCell className="px-4 py-3 align-middle max-w-[260px]">
                                <div className="overflow-hidden whitespace-nowrap truncate" title={(field.label && typeof field.label === 'object' && field.label.en) ? field.label.en : convertToString(field.label)}>
                                  {(field.label && typeof field.label === 'object' && field.label.en) ? field.label.en : convertToString(field.label)}
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-3 align-middle">
                                <span className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
                                  {getInputTypeLabel(field.inputType)}
                                </span>
                              </TableCell>
                              <TableCell className="px-4 py-3 align-middle">
                                {field.isRequired ? (
                                  <span className="text-green-500">Yes</span>
                                ) : (
                                  <span className="text-gray-400">No</span>
                                )}
                              </TableCell>
                              <TableCell className="px-4 py-3 align-middle max-w-[280px]">
                                {field.choices && field.choices.length > 0 ? (
                                  <span
                                    className="text-sm text-gray-600 dark:text-gray-400 overflow-hidden whitespace-nowrap truncate block"
                                    title={convertChoicesArray(field.choices).join(", ")}
                                  >
                                    {convertChoicesArray(field.choices).slice(0, 3).join(", ")}{convertChoicesArray(field.choices).length > 3 ? "..." : ""}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                              <TableCell className="px-4 py-3 align-middle flex items-center gap-3">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        // Extract label - could be string or bilingual object
                                        const labelEn = convertToString(field.label);
                                        const labelAr = (typeof field.label === 'object' && field.label !== null && field.label.ar) ? field.label.ar : '';
                                        
                                        // Extract groupFields if they exist
                                        const extractedGroupFields = field.groupFields ? field.groupFields.map((gf: any) => ({
                                          fieldId: gf.fieldId,
                                          label: convertToString(gf.label),
                                          labelAr: (typeof gf.label === 'object' && gf.label !== null && gf.label.ar) ? gf.label.ar : '',
                                          inputType: gf.inputType,
                                          isRequired: gf.isRequired,
                                          choices: convertChoicesArray(gf.choices),
                                          choicesAr: convertChoicesArrayAr(gf.choices),
                                        })) : [];
                                        
                                        setForm((prev) => ({
                                          ...prev,
                                          label: labelEn,
                                          labelAr: labelAr,
                                          type: field.inputType,
                                          required: field.isRequired,
                                          options: convertChoicesArray(field.choices),
                                          optionsAr: convertChoicesArrayAr(field.choices),
                                          validation: {
                                            min: field.minValue,
                                            max: field.maxValue,
                                          },
                                          groupFields: extractedGroupFields,
                                        }));
                                        console.log("Editing field with fieldId:", field.fieldId, "Full field:", field);
                                        setEditFieldId(field.fieldId);
                                        setShowForm(true);
                                      }}
                                      className="rounded p-1.5 text-brand-600 transition hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                                      title="Edit field"
                                    >
                                      <PencilIcon className="size-4" />
                                    </button>

                                    <button
                                      onClick={() => handleDelete(field.fieldId)}
                                      disabled={isDeletingField === field.fieldId}
                                      className="rounded p-1.5 text-error-600 transition hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                      title={isDeletingField === field.fieldId ? "Deleting..." : "Delete field"}
                                    >
                                      <TrashBinIcon className="size-4" />
                                    </button>
                                  </div>
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
