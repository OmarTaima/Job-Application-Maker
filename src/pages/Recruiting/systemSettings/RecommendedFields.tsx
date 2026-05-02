import { useState } from "react";
import Swal from '../../../utils/swal';
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import Switch from "../../../components/form/switch/Switch";
import Select from "../../../components/form/Select";
import { PlusIcon, TrashBinIcon, PencilIcon } from "../../../icons";
import {
  useRecommendedFields,
  useCreateRecommendedField,
  useUpdateRecommendedField,
  useDeleteRecommendedField,
} from "../../../hooks/queries";
import type { FieldType } from "../../../types/recommendedFields";

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
  const { data: recommendedFields = [], isLoading: loading } = useRecommendedFields();
  const createFieldMutation = useCreateRecommendedField();
  const updateFieldMutation = useUpdateRecommendedField();
  const deleteFieldMutation = useDeleteRecommendedField();

  const [showForm, setShowForm] = useState(false);
  const [newChoice, setNewChoice] = useState("");
  const [newChoiceAr, setNewChoiceAr] = useState("");
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
  const [isDeletingField, setIsDeletingField] = useState<string | null>(null);
  const [collapsedSubFields, setCollapsedSubFields] = useState<Set<number>>(new Set());

  const handleInputChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
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
    setCollapsedSubFields(new Set());
  };

  const handleEdit = (field: any) => {
    setEditFieldId(field.fieldId);
    setForm({
      label: typeof field.label === "string" ? field.label : (field.label?.en || ""),
      labelAr: typeof field.label === "string" ? (field.labelAr || "") : (field.label?.ar || ""),
      type: field.inputType || "text",
      required: field.isRequired || false,
      options: field.choices || [],
      optionsAr: field.choicesAr || [],
      validation: {
        min: field.minValue,
        max: field.maxValue,
      },
      groupFields: field.groupFields || [],
    });
    setCollapsedSubFields(new Set((field.groupFields || []).map((_: any, i: number) => i)));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const generateFieldId = (label: string) => {
    return (label || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `field_${Date.now()}`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalFieldId = editFieldId || generateFieldId(form.label);
    
    // Construct payload as a CreateRecommendedFieldRequest / UpdateRecommendedFieldRequest
    const payload: any = {
      fieldId: finalFieldId,
      label: {
        en: form.label,
        ar: form.labelAr || form.label,
      },
      inputType: form.type,
      isRequired: form.required,
      choices: form.options,
      choicesAr: form.optionsAr,
      minValue: form.validation?.min,
      maxValue: form.validation?.max,
      groupFields: (form.groupFields || []).map(gf => ({
        ...gf,
        label: {
          en: typeof gf.label === "string" ? gf.label : (gf.label as any)?.en || "",
          ar: typeof gf.label === "string" ? gf.labelAr || gf.label : (gf.label as any)?.ar || (gf.label as any)?.en || "",
        },
        choicesAr: gf.choicesAr || gf.choices
      }))
    };

    try {
      if (editFieldId) {
        await updateFieldMutation.mutateAsync({ fieldId: editFieldId, data: payload });
        Swal.fire({ title: "Updated", icon: "success", timer: 1000, showConfirmButton: false });
      } else {
        await createFieldMutation.mutateAsync(payload);
        Swal.fire({ title: "Created", icon: "success", timer: 1000, showConfirmButton: false });
      }
      resetForm();
    } catch (err: any) {
      Swal.fire({ title: "Error", text: err.response?.data?.message || "Failed to save field", icon: "error" });
    }
  };

  const handleDelete = async (fieldId: string) => {
    const result = await Swal.fire({
      title: "Delete Recommended Field?",
      text: "This will remove it from the system preset list.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EF4444",
      confirmButtonText: "Delete",
      customClass: { popup: "rounded-3xl", confirmButton: "rounded-xl", cancelButton: "rounded-xl" }
    });
    if (!result.isConfirmed) return;

    setIsDeletingField(fieldId);
    try {
      await deleteFieldMutation.mutateAsync(fieldId);
      Swal.fire({ title: "Deleted", icon: "success", timer: 1000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ title: "Error", text: "Failed to delete field", icon: "error" });
    } finally {
      setIsDeletingField(null);
    }
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

  const toggleSubFieldCollapse = (index: number) => {
    setCollapsedSubFields((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (loading) return <LoadingSpinner fullPage message="Loading system fields..." />;

  return (
    <div className="mx-auto max-w-[1200px] space-y-8 pb-20">
      <PageMeta title="Recommended Fields" description="System preset fields for job applications" />
      
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageBreadcrumb pageTitle="System Presets" />
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-500 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-brand-500/25 transition-all hover:bg-brand-600 hover:shadow-brand-500/40 active:scale-95"
          >
            <PlusIcon className="size-5" />
            Add New Preset
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="animate-in fade-in slide-in-from-top-4 space-y-8">
          <div className="group relative overflow-hidden rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-10 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{editFieldId ? "Edit Preset Field" : "Create Preset Field"}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Configure system-wide reusable field definitions</p>
              </div>
              <button 
                type="button" 
                onClick={resetForm}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-8">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="label" required>Label (EN)</Label>
                  <Input
                    id="label"
                    value={form.label}
                    onChange={(e: any) => handleInputChange("label", e.target.value)}
                    placeholder="e.g. Passport Number"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="labelAr" required className="block w-full text-right">Label (AR)</Label>
                  <Input
                    id="labelAr"
                    value={form.labelAr}
                    onChange={(e: any) => handleInputChange("labelAr", e.target.value)}
                    placeholder="مثال: رقم الجواز"
                    required
                    className="text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="space-y-4">
                  <Label>Behavior</Label>
                  <div className="rounded-2xl bg-gray-50/50 p-4 dark:bg-gray-800/30">
                    <Switch 
                      checked={form.required} 
                      onChange={(val) => handleInputChange("required", val)} 
                      label="Mandatory by default"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Data Type</Label>
                  <Select
                    options={inputTypeOptions}
                    value={form.type}
                    onChange={(v: string) => handleInputChange("type", v)}
                  />
                </div>
              </div>

              {form.type === "number" && (
                <div className="flex gap-4 rounded-2xl border border-blue-100 bg-blue-50/30 p-5 dark:border-blue-900/30 dark:bg-blue-900/10">
                  <div className="flex-1 space-y-2">
                    <Label>Minimum</Label>
                    <Input type="number" value={form.validation?.min ?? ""} onChange={(e: any) => handleInputChange("validation", { ...form.validation, min: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>Maximum</Label>
                    <Input type="number" value={form.validation?.max ?? ""} onChange={(e: any) => handleInputChange("validation", { ...form.validation, max: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {(["radio", "dropdown", "checkbox", "tags"].includes(form.type)) && (
            <div className="animate-in slide-in-from-bottom-4 rounded-[2rem] border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
              <h4 className="mb-6 text-xl font-bold">Manage Options</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input placeholder="Option (EN)" value={newChoice} onChange={(e: any) => setNewChoice(e.target.value)} />
                <Input placeholder="Option (AR)" value={newChoiceAr} onChange={(e: any) => setNewChoiceAr(e.target.value)} className="text-right" />
              </div>
              <button 
                type="button" 
                onClick={handleAddChoice} 
                className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-600 hover:text-brand-700"
              >
                <PlusIcon className="size-4" /> Add Option
              </button>

              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {form.options?.map((opt, i) => (
                  <div key={i} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/20">
                    <div className="overflow-hidden">
                      <div className="font-bold truncate text-gray-900 dark:text-white">{typeof opt === 'string' ? opt : ((opt as any)?.en || '')}</div>
                      <div className="text-xs text-gray-500 truncate text-right">{(() => {
                        const a = form.optionsAr?.[i];
                        return typeof a === 'string' ? a : ((a as any)?.ar || '');
                      })()}</div>
                    </div>
                    <button type="button" onClick={() => handleInputChange("options", form.options?.filter((_, idx) => idx !== i))} className="text-error-500 hover:bg-error-50 p-2 rounded-lg transition-colors">
                      <TrashBinIcon className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {form.type === "repeatable_group" && (
            <div className="animate-in slide-in-from-bottom-4 rounded-[2rem] border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
               <div className="mb-6 flex items-center justify-between">
                <h4 className="text-xl font-bold">Group Schema</h4>
                <button 
                  type="button" 
                  onClick={() => handleInputChange("groupFields", [...(form.groupFields || []), { fieldId: `gf_${Date.now()}`, label: "", inputType: "text", isRequired: false }])}
                  className="inline-flex items-center gap-2 text-sm font-bold text-brand-600"
                >
                  <PlusIcon className="size-4" /> Add Nested Field
                </button>
               </div>

               <div className="space-y-4">
                  {form.groupFields?.map((gf, idx) => (
                    <div key={gf.fieldId} className="rounded-2xl border border-gray-100 bg-gray-50/30 dark:border-gray-800 dark:bg-gray-800/10">
                        <div 
                          className="flex cursor-pointer items-center justify-between p-4"
                          onClick={() => toggleSubFieldCollapse(idx)}
                        >
                          <span className="font-bold text-gray-700 dark:text-gray-300">{typeof gf.label === 'string' ? gf.label : ((gf.label as any)?.en || 'Unnamed Nested Field')} <span className="text-[10px] font-black opacity-50 ml-2 uppercase tracking-widest">{gf.inputType}</span></span>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleInputChange("groupFields", form.groupFields?.filter((_, i) => i !== idx)); }} className="p-2 text-gray-400 hover:text-error-600"><TrashBinIcon className="size-4" /></button>
                            <svg className={`size-5 transform transition-transform ${collapsedSubFields.has(idx) ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </div>
                        {!collapsedSubFields.has(idx) && (
                          <div className="p-5 pt-0 border-t border-gray-100 dark:border-gray-800 grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-in fade-in">
                            <Input placeholder="Label (EN)" value={typeof gf.label === 'string' ? (gf.label as string) : ((gf.label as any)?.en || '')} onChange={(e: any) => { const next = [...(form.groupFields || [])]; next[idx].label = e.target.value; handleInputChange("groupFields", next); }} />
                            <Input placeholder="Label (AR)" value={typeof gf.label === 'string' ? (gf.labelAr || '') : ((gf.label as any)?.ar || '')} onChange={(e: any) => { const next = [...(form.groupFields || [])]; next[idx].labelAr = e.target.value; handleInputChange("groupFields", next); }} className="text-right" />
                            <Select options={subFieldTypeOptions} value={gf.inputType} onChange={(val: string) => { const next = [...(form.groupFields || [])]; (next[idx].inputType as any) = val; handleInputChange("groupFields", next); }} />
                            <div className="pt-2"><Switch checked={gf.isRequired} onChange={(val) => { const next = [...(form.groupFields || [])]; next[idx].isRequired = val; handleInputChange("groupFields", next); }} label="Required" /></div>
                          </div>
                        )}
                    </div>
                  ))}
               </div>
            </div>
          )}

          <div className="flex justify-end gap-4">
            <button type="button" onClick={resetForm} className="rounded-2xl bg-white px-8 py-3 text-sm font-bold text-gray-700 shadow-lg dark:bg-gray-800 dark:text-gray-300">Cancel</button>
            <button type="submit" className="rounded-2xl bg-brand-500 px-10 py-3 text-sm font-bold text-white shadow-xl shadow-brand-500/25 hover:bg-brand-600">
              {editFieldId ? "Save Changes" : "Create Preset"}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {recommendedFields.filter(f => f.fieldId !== isDeletingField).map((f: any) => (
          <div key={f.fieldId} className="group relative overflow-hidden rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm transition-all hover:border-brand-200 hover:shadow-xl dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-start justify-between">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-gray-50 px-2.5 py-1 dark:bg-gray-800">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{f.inputType.replace("_", " ")}</span>
                  </div>
                  {f.isRequired && <span className="rounded-full bg-error-50 px-2 py-0.5 text-[10px] font-bold text-error-600 dark:bg-error-500/10">REQUIRED</span>}
                </div>
                <div>
                  <h4 className="text-lg font-black text-gray-900 dark:text-white group-hover:text-brand-600 transition-colors capitalize">{typeof f.label === "string" ? f.label : (f.label?.en || "Unnamed")}</h4>
                  <p className="mt-1 text-sm text-gray-400 font-medium" dir="rtl">{typeof f.label === "string" ? f.labelAr : (f.label?.ar || "")}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-tighter">
                  {f.choices?.length > 0 && <span>• {f.choices.length} Options</span>}
                  {f.groupFields?.length > 0 && <span>• {f.groupFields.length} Nested Fields</span>}
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <button onClick={() => handleEdit(f)} className="rounded-xl p-2.5 bg-gray-50 text-gray-400 hover:text-brand-600 dark:bg-gray-800"><PencilIcon className="size-5" /></button>
                <button onClick={() => handleDelete(f.fieldId)} className="rounded-xl p-2.5 bg-gray-50 text-gray-400 hover:text-error-600 dark:bg-gray-800"><TrashBinIcon className="size-5" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecommendedFields;
