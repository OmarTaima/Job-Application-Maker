import { useState } from "react";
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

type SubField = {
  fieldId: string;
  label: string;
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
};

type RecommendedField = {
  fieldId: string;
  label: string;
  inputType:
    | "text"
    | "textarea"
    | "number"
    | "email"
    | "date"
    | "radio"
    | "dropdown"
    | "checkbox"
    | "url"
    | "tags"
    | "groupField";
  defaultValue?: string;
  minValue?: number;
  maxValue?: number;
  isRequired: boolean;
  displayOrder: number;
  choices?: string[];
  subFields?: SubField[];
};

const RecommendedFields = () => {
  const [recommendedFields, setRecommendedFields] = useState<RecommendedField[]>([
    {
      fieldId: "years_experience_template",
      label: "Years of Experience",
      inputType: "number",
      isRequired: true,
      minValue: 0,
      maxValue: 50,
      displayOrder: 1,
    },
    {
      fieldId: "education_level_template",
      label: "Education Level",
      inputType: "dropdown",
      isRequired: true,
      displayOrder: 2,
      choices: ["High School", "Bachelor's", "Master's", "PhD"],
    },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [newChoice, setNewChoice] = useState("");
  const [newSubFieldChoice, setNewSubFieldChoice] = useState("");
  const [form, setForm] = useState<RecommendedField>({
    fieldId: "",
    label: "",
    inputType: "text",
    isRequired: false,
    displayOrder: 0,
    choices: [],
    subFields: [],
  });

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
    { value: "groupField", label: "Group Field" },
  ];

  const subFieldTypeOptions = [
    { value: "text", label: "Text" },
    { value: "number", label: "Number" },
    { value: "email", label: "Email" },
    { value: "date", label: "Date" },
    { value: "checkbox", label: "Checkbox" },
    { value: "radio", label: "Radio" },
    { value: "dropdown", label: "Dropdown" },
    { value: "textarea", label: "Text Area" },
    { value: "url", label: "URL" },
    { value: "tags", label: "Tags" },
  ];

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddChoice = () => {
    if (newChoice.trim()) {
      setForm((prev) => ({
        ...prev,
        choices: [...(prev.choices || []), newChoice.trim()],
      }));
      setNewChoice("");
    }
  };

  const handleRemoveChoice = (index: number) => {
    setForm((prev) => ({
      ...prev,
      choices: prev.choices?.filter((_, i) => i !== index),
    }));
  };

  const handleAddSubField = () => {
    const newSubField: SubField = {
      fieldId: `subfield_${Date.now()}`,
      label: "",
      inputType: "text",
      isRequired: false,
    };
    setForm((prev) => ({
      ...prev,
      subFields: [...(prev.subFields || []), newSubField],
    }));
  };

  const handleRemoveSubField = (subFieldIndex: number) => {
    setForm((prev) => ({
      ...prev,
      subFields: prev.subFields?.filter((_, si) => si !== subFieldIndex),
    }));
  };

  const handleSubFieldChange = (
    subFieldIndex: number,
    field: keyof SubField,
    value: any
  ) => {
    setForm((prev) => ({
      ...prev,
      subFields: prev.subFields?.map((sf, si) =>
        si === subFieldIndex ? { ...sf, [field]: value } : sf
      ),
    }));
  };

  const handleAddSubFieldChoice = (subFieldIndex: number) => {
    if (newSubFieldChoice.trim()) {
      setForm((prev) => ({
        ...prev,
        subFields: prev.subFields?.map((sf, si) =>
          si === subFieldIndex
            ? { ...sf, choices: [...(sf.choices || []), newSubFieldChoice] }
            : sf
        ),
      }));
      setNewSubFieldChoice("");
    }
  };

  const handleRemoveSubFieldChoice = (subFieldIndex: number, choiceIndex: number) => {
    setForm((prev) => ({
      ...prev,
      subFields: prev.subFields?.map((sf, si) =>
        si === subFieldIndex
          ? { ...sf, choices: sf.choices?.filter((_, ci) => ci !== choiceIndex) }
          : sf
      ),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newField: RecommendedField = {
      ...form,
      fieldId: form.fieldId || `field_${Date.now()}`,
      displayOrder: recommendedFields.length + 1,
    };

    console.log("Creating recommended field:", newField);
    setRecommendedFields((prev) => [...prev, newField]);
    setForm({
      fieldId: "",
      label: "",
      inputType: "text",
      isRequired: false,
      displayOrder: 0,
      choices: [],
      subFields: [],
    });
    setShowForm(false);
  };

  const handleDelete = (fieldId: string) => {
    setRecommendedFields((prev) => prev.filter((field) => field.fieldId !== fieldId));
  };

  return (
    <>
      <PageMeta title="Recommended Fields - Admin" description="Manage reusable field templates" />
      <PageBreadcrumb pageTitle="Recommended Fields" />

      <div className="grid gap-6">
        {/* Recommended Fields List */}
        <ComponentCard title="Recommended Fields" desc="Manage reusable field templates for job creation">
          <>
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="mb-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              <PlusIcon className="h-4 w-4" />
              {showForm ? "Cancel" : "Add Recommended Field"}
            </button>

            {showForm && (
            <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-stroke p-6 dark:border-strokedark">
              <h3 className="mb-4 text-lg font-semibold">Create Recommended Field</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fieldId">Field ID</Label>
                  <Input
                    id="fieldId"
                    value={form.fieldId}
                    onChange={(e) => handleInputChange("fieldId", e.target.value)}
                    placeholder="e.g., years_experience_template"
                  />
                </div>

                <div>
                  <Label htmlFor="label">Label</Label>
                  <Input
                    id="label"
                    value={form.label}
                    onChange={(e) => handleInputChange("label", e.target.value)}
                    placeholder="e.g., Years of Experience"
                  />
                </div>

                <div>
                  <Label htmlFor="inputType">Input Type</Label>
                  <Select
                    options={inputTypeOptions}
                    placeholder="Select type"
                    onChange={(value) => handleInputChange("inputType", value)}
                  />
                </div>

                <div>
                  <Label htmlFor="defaultValue">Default Value</Label>
                  <Input
                    id="defaultValue"
                    value={form.defaultValue || ""}
                    onChange={(e) => handleInputChange("defaultValue", e.target.value)}
                    placeholder="Optional default value"
                  />
                </div>

                {form.inputType === "number" && (
                  <>
                    <div>
                      <Label htmlFor="minValue">Min Value</Label>
                      <Input
                        id="minValue"
                        type="number"
                        value={form.minValue || ""}
                        onChange={(e) => handleInputChange("minValue", parseFloat(e.target.value))}
                        placeholder="Minimum value"
                      />
                    </div>

                    <div>
                      <Label htmlFor="maxValue">Max Value</Label>
                      <Input
                        id="maxValue"
                        type="number"
                        value={form.maxValue || ""}
                        onChange={(e) => handleInputChange("maxValue", parseFloat(e.target.value))}
                        placeholder="Maximum value"
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center gap-3">
                  <Switch
                    label=""
                    defaultChecked={form.isRequired}
                    onChange={(checked) => handleInputChange("isRequired", checked)}
                  />
                  <Label htmlFor="isRequired">Required Field</Label>
                </div>
              </div>

              {/* Choices for radio, dropdown, checkbox, tags */}
              {(form.inputType === "radio" ||
                form.inputType === "dropdown" ||
                form.inputType === "checkbox" ||
                form.inputType === "tags") && (
                <div className="mt-4">
                  <Label>Choices</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newChoice}
                      onChange={(e) => setNewChoice(e.target.value)}
                      placeholder="Add a choice"
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
                    {form.choices?.map((choice, index) => (
                      <span
                        key={index}
                        className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-1 text-sm dark:bg-gray-800"
                      >
                        {choice}
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

              {/* Group Field Sub-Questions */}
              {form.inputType === "groupField" && (
                <div className="mt-4 border-l-4 border-blue-500 pl-4">
                  <div className="mb-3 flex items-center justify-between">
                    <Label>Sub-Questions</Label>
                    <button
                      type="button"
                      onClick={handleAddSubField}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300"
                    >
                      <PlusIcon className="h-3 w-3" />
                      Add Sub-Question
                    </button>
                  </div>

                  <div className="space-y-4">
                    {form.subFields?.map((subField, subFieldIndex) => (
                      <div
                        key={subField.fieldId}
                        className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Sub-Question #{subFieldIndex + 1}
                          </h5>
                          <button
                            type="button"
                            onClick={() => handleRemoveSubField(subFieldIndex)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400"
                          >
                            <TrashBinIcon className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <Label htmlFor={`subfield-label-${subFieldIndex}`}>Label</Label>
                            <Input
                              id={`subfield-label-${subFieldIndex}`}
                              value={subField.label}
                              onChange={(e) =>
                                handleSubFieldChange(subFieldIndex, "label", e.target.value)
                              }
                              placeholder="Enter question label"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor={`subfield-type-${subFieldIndex}`}>Input Type</Label>
                              <Select
                                options={subFieldTypeOptions}
                                placeholder="Select type"
                                onChange={(value) =>
                                  handleSubFieldChange(subFieldIndex, "inputType", value)
                                }
                              />
                            </div>

                            <div className="flex items-end pb-2">
                              <div className="flex items-center gap-2">
                                <Switch
                                  label=""
                                  defaultChecked={subField.isRequired}
                                  onChange={(checked) =>
                                    handleSubFieldChange(subFieldIndex, "isRequired", checked)
                                  }
                                />
                                <Label>Required</Label>
                              </div>
                            </div>
                          </div>

                          {/* Sub-field choices for radio, checkbox, dropdown, tags */}
                          {(subField.inputType === "radio" ||
                            subField.inputType === "checkbox" ||
                            subField.inputType === "dropdown" ||
                            subField.inputType === "tags") && (
                            <div>
                              <Label>Choices</Label>
                              <div className="flex gap-2">
                                <Input
                                  value={newSubFieldChoice}
                                  onChange={(e) => setNewSubFieldChoice(e.target.value)}
                                  placeholder="Add a choice"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddSubFieldChoice(subFieldIndex)}
                                  className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
                                >
                                  <PlusIcon className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="mt-2 space-y-1">
                                {subField.choices?.map((choice, choiceIndex) => (
                                  <div
                                    key={choiceIndex}
                                    className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
                                  >
                                    <span className="text-gray-700 dark:text-gray-300">
                                      {choice}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveSubFieldChoice(subFieldIndex, choiceIndex)
                                      }
                                      className="text-red-600 hover:text-red-700 dark:text-red-400"
                                    >
                                      <TrashBinIcon className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {(!form.subFields || form.subFields.length === 0) && (
                      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/30 dark:text-gray-400">
                        No sub-questions added yet. Click "Add Sub-Question" to add questions to this group.
                      </div>
                    )}
                  </div>
                </div>
              )}

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
          <div>
            <div className="overflow-x-auto rounded-lg border border-stroke dark:border-strokedark">
              <Table>
                <TableHeader className="bg-gray-50 dark:bg-gray-800">
                  <TableRow>
                    <TableCell isHeader className="px-4 py-3 align-middle text-left font-semibold">Field ID</TableCell>
                    <TableCell isHeader className="px-4 py-3 align-middle text-left font-semibold">Label</TableCell>
                    <TableCell isHeader className="px-4 py-3 align-middle text-left font-semibold">Type</TableCell>
                    <TableCell isHeader className="px-4 py-3 align-middle text-left font-semibold">Required</TableCell>
                    <TableCell isHeader className="px-4 py-3 align-middle text-left font-semibold">Order</TableCell>
                    <TableCell isHeader className="px-4 py-3 align-middle text-left font-semibold">Actions</TableCell>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {recommendedFields.map((field) => (
                  <TableRow key={field.fieldId}>
                    <TableCell className="px-4 py-3 align-middle font-mono text-sm">
                      {field.fieldId}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">{field.label}</TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      <span className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
                        {field.inputType}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      {field.isRequired ? (
                        <span className="text-green-500">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-middle">{field.displayOrder}</TableCell>
                    <TableCell className="px-4 py-3 align-middle">
                      <button
                        onClick={() => handleDelete(field.fieldId)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <TrashBinIcon className="h-5 w-5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>
          </>
        </ComponentCard>
      </div>
    </>
  );
};

export default RecommendedFields;
