import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import Select from "../../../components/form/Select";
import Switch from "../../../components/form/switch/Switch";
import { PlusIcon, PencilIcon, TrashBinIcon, CheckCircleIcon } from "../../../icons";
import { useCreateSavedField, useUpdateSavedField } from "../../../hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { savedFieldsKeys } from "../../../hooks/queries/useUsers";
import Swal from '../../../utils/swal';
import { getErrorResponse} from "../../../utils/errorHandler";

const inputTypeOptions = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "date", label: "Date" },
  { value: "url", label: "URL" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio" },
  { value: "dropdown", label: "Dropdown" },
  { value: "tags", label: "Tags" },
  { value: "repeatable_group", label: "Group Field" },
];

const subFieldTypeOptions = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "date", label: "Date" },
  { value: "url", label: "URL" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio" },
  { value: "dropdown", label: "Dropdown" },
  { value: "tags", label: "Tags" },
];

export default function CreateSavedField() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const editingField = state?.field;

  const [labelEn, setLabelEn] = useState("");
  const [labelAr, setLabelAr] = useState("");
  const [inputType, setInputType] = useState("text");
  const [isRequired, setIsRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState("");
  const [minValue, setMinValue] = useState<number | undefined>(undefined);
  const [maxValue, setMaxValue] = useState<number | undefined>(undefined);

  const [choices, setChoices] = useState<Array<{ en: string; ar?: string }>>([]);
  const [newChoiceEn, setNewChoiceEn] = useState("");
  const [newChoiceAr, setNewChoiceAr] = useState("");
  const [editingChoiceIndex, setEditingChoiceIndex] = useState<number | null>(null);
  const [editChoiceEn, setEditChoiceEn] = useState("");
  const [editChoiceAr, setEditChoiceAr] = useState("");

  const [subFields, setSubFields] = useState<any[]>([]);
  const [collapsedSubFields, setCollapsedSubFields] = useState<Set<number>>(new Set());

  const createMutation = useCreateSavedField();
  const updateMutation = useUpdateSavedField();
  const qc = useQueryClient();

  useEffect(() => {
    if (!editingField) return;
    if (editingField.label && typeof editingField.label === "object") {
      setLabelEn(editingField.label.en || "");
      setLabelAr(editingField.label.ar || editingField.label.en || "");
    } else {
      setLabelEn(editingField.label || "");
      setLabelAr(editingField.label || editingField.label?.en || "");
    }
    setInputType(editingField.inputType || "text");
    setIsRequired(!!editingField.isRequired);
    setDefaultValue(editingField.defaultValue || "");
    setMinValue(editingField.minValue ?? undefined);
    setMaxValue(editingField.maxValue ?? undefined);
    if (Array.isArray(editingField.choices)) {
      setChoices(
        editingField.choices.map((c: any) =>
          typeof c === "string"
            ? { en: c, ar: c }
            : { en: c.en || "", ar: c.ar || c.en || "" }
        )
      );
    }
    if (Array.isArray(editingField.groupFields)) {
      setSubFields(editingField.groupFields || []);
      setCollapsedSubFields(new Set(editingField.groupFields.map((_: any, i: number) => i)));
    }
  }, [editingField]);

  const toggleSubFieldCollapse = (index: number) => {
    setCollapsedSubFields((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const generateFieldId = (label: string) => {
    const normalized = (label || "").trim().toLowerCase();
    if (normalized === "have a mobile") return "have_a_mobile";
    const slug = normalized
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (slug) return slug;
    return `field_${Date.now()}`;
  };

  const addChoice = () => {
    if (!newChoiceEn.trim() || !newChoiceAr.trim()) return;
    setChoices((s) => [...s, { en: newChoiceEn.trim(), ar: newChoiceAr.trim() }]);
    setNewChoiceEn("");
    setNewChoiceAr("");
  };

  const handleEditChoice = (index: number) => {
    const c = choices[index];
    setEditingChoiceIndex(index);
    setEditChoiceEn(c?.en || "");
    setEditChoiceAr(c?.ar || c?.en || "");
  };

  const handleUpdateChoice = () => {
    if (editingChoiceIndex === null) return;
    const idx = editingChoiceIndex;
    const next = choices.map((c, i) => (i === idx ? { en: editChoiceEn.trim(), ar: editChoiceAr.trim() || editChoiceEn.trim() } : c));
    setChoices(next);
    setEditingChoiceIndex(null);
    setEditChoiceEn("");
    setEditChoiceAr("");
  };

  const handleCancelEditChoice = () => {
    setEditingChoiceIndex(null);
    setEditChoiceEn("");
    setEditChoiceAr("");
  };

  const removeChoice = (index: number) => {
    setChoices((s) => s.filter((_, i) => i !== index));
  };

  const addSubField = () => {
    setSubFields((s) => [
      ...s,
      {
        fieldId: `sub_${Date.now()}_${Math.random()}`,
        label: { en: "", ar: "" },
        inputType: "text",
        isRequired: false,
      },
    ]);
  };

  const updateSubField = (index: number, patch: any) => {
    setSubFields((s) => s.map((sf, i) => (i === index ? { ...sf, ...patch } : sf)));
  };

  const removeSubField = (index: number) => {
    setSubFields((s) => s.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: any) => { e.preventDefault();
    const finalFieldId = editingField?.fieldId || generateFieldId(labelEn);
    const choiceTypes = ["radio", "dropdown", "checkbox"];
    if (choiceTypes.includes(inputType)) {
      if (!choices || choices.length === 0) {
        Swal.fire({ title: "Validation", text: "Please add at least one choice for this field.", icon: "warning" });
        return;
      }
    }
    for (let i = 0; i < (subFields || []).length; i++) {
      const sf = subFields[i] || {};
      if (choiceTypes.includes(sf.inputType)) {
        if (!Array.isArray(sf.choices) || sf.choices.length === 0) {
          const label = typeof sf.label === "string" ? sf.label : (sf.label?.en || sf.label?.ar || `#${i + 1}`);
          Swal.fire({ title: "Validation", text: `Please add at least one choice for group field "${label}".`, icon: "warning" });
          return;
        }
      }
    }
    const payload: any = {
      fieldId: finalFieldId,
      label: { en: labelEn, ar: labelAr || labelEn },
      inputType,
      isRequired,
      defaultValue,
      choices: (choices || []).map((c) => ({ en: c.en || "", ar: c.ar || c.en || "" })),
      groupFields: (subFields || []).map((sf: any) => ({
        fieldId: sf.fieldId,
        label: {
          en: typeof sf.label === "string" ? sf.label : (sf.label?.en || ""),
          ar: typeof sf.label === "string" ? sf.label : (sf.label?.ar || sf.label?.en || ""),
        },
        inputType: sf.inputType,
        isRequired: !!sf.isRequired,
        choices: (sf.choices || []).map((c: any) => ({ en: c.en || c || "", ar: c.ar || c.en || c || "" })),
        defaultValue: sf.defaultValue ?? null,
        minValue: sf.minValue,
        maxValue: sf.maxValue,
      })),
    };
    if (minValue !== undefined) payload.minValue = minValue;
    if (maxValue !== undefined) payload.maxValue = maxValue;
    try {
      if (editingField) {
        const updated = await updateMutation.mutateAsync({ fieldId: editingField.fieldId, data: payload });
        qc.setQueryData(savedFieldsKeys.list(), (old: any) => (old || []).map((f: any) => (f.fieldId === editingField.fieldId ? { ...f, ...updated } : f)));
        Swal.fire({ title: "Updated", icon: "success", timer: 1000, showConfirmButton: false });
        navigate(-1);
      } else {
        const created = await createMutation.mutateAsync(payload);
        qc.setQueryData(savedFieldsKeys.list(), (old: any) => [created, ...(old || [])]);
        Swal.fire({ title: "Created", icon: "success", timer: 1000, showConfirmButton: false });
        navigate(-1);
      }
    } catch (err: any) {
      const resp = getErrorResponse(err);
      Swal.fire({ title: "Error", text: resp.message || String(err), icon: "error" });
    }
  };

  return (
    <div className="mx-auto max-w-[1000px] space-y-8 pb-20">
      <PageMeta
        title={editingField ? "Edit Saved Field" : "Create Saved Field"}
        description="Configure a reusable field template with bilingual support."
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageBreadcrumb pageTitle={editingField ? "Edit Field Template" : "New Field Template"} />
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/50"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="group relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Field Company</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Basic identification and display labels</p>
            </div>
            <div className="rounded-2xl bg-brand-50 p-3 text-brand-600 dark:bg-brand-500/10">
              <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
          </div>

          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="labelEn" required>Display Label (EN)</Label>
                <Input
                  id="labelEn"
                  value={labelEn}
                  onChange={(e: any) => setLabelEn(e.target.value)}
                  placeholder="e.g. Years of Experience"
                  required
                />
              </div>
              <div className="space-y-2" dir="rtl">
                <Label htmlFor="labelAr" required className="block w-full text-right">عنوان الحقل (بالعربية)</Label>
                <Input
                  id="labelAr"
                  value={labelAr}
                  onChange={(e: any) => setLabelAr(e.target.value)}
                  placeholder="مثال: سنوات الخبرة"
                  required
                  className="text-right"
                />
              </div>
            </div>

            <div className="h-px bg-gray-100 dark:bg-gray-800" />

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div className="space-y-3">
                <Label>Input Behavior</Label>
                <div className="flex flex-col gap-4 rounded-2xl bg-gray-50/50 p-4 dark:bg-gray-800/30">
                  <div className="group/toggle relative">
                    <Switch 
                      checked={isRequired} 
                      onChange={(val: boolean) => setIsRequired(val)} 
                      label="Required Field"
                    />
                    <p className="ml-11 mt-1 text-[11px] text-gray-500 opacity-70 group-hover/toggle:opacity-100 transition-opacity">
                      Applicants cannot submit the form without filling this field.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="inputType">Data Type</Label>
                <Select
                  options={inputTypeOptions}
                  value={inputType}
                  onChange={(v: string) => setInputType(v)}
                  placeholder="Select input type"
                />
                <p className="text-[11px] text-gray-500 italic">
                  Defines how the input will be rendered to the applicant.
                </p>
              </div>
            </div>

            {inputType === "number" && (
              <div className="animate-in slide-in-from-top-2 flex gap-4 rounded-2xl border border-blue-100 bg-blue-50/30 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
                <div className="flex-1 space-y-2">
                  <Label>Minimum Allowed</Label>
                  <Input 
                    type="number" 
                    value={minValue ?? ""} 
                    onChange={(e: any) => setMinValue(e.target.value ? Number(e.target.value) : undefined)} 
                    placeholder="None"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Maximum Allowed</Label>
                  <Input 
                    type="number" 
                    value={maxValue ?? ""} 
                    onChange={(e: any) => setMaxValue(e.target.value ? Number(e.target.value) : undefined)} 
                    placeholder="None"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {(inputType === "radio" || inputType === "dropdown" || inputType === "checkbox" || inputType === "tags") && (
          <div className="animate-in fade-in slide-in-from-bottom-4 group relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Options & Choices</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Manage the available selections for this field</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-3 text-amber-600 dark:bg-amber-500/10">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-800/50">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>New Choice (EN)</Label>
                    <Input 
                      placeholder="e.g. Beginner" 
                      value={newChoiceEn} 
                      onChange={(e: any) => setNewChoiceEn(e.target.value)} 
                      onKeyDown={(e: any) => { if (e.key === "Enter") { e.preventDefault(); addChoice(); } }} 
                    />
                  </div>
                  <div className="space-y-2" dir="rtl">
                    <Label className="block w-full text-right">خيار جديد (بالعربية)</Label>
                    <Input 
                      placeholder="مثال: مبتدئ" 
                      value={newChoiceAr} 
                      onChange={(e: any) => setNewChoiceAr(e.target.value)} 
                      onKeyDown={(e: any) => { if (e.key === "Enter") { e.preventDefault(); addChoice(); } }}
                      className="text-right"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <button 
                    type="button" 
                    onClick={addChoice} 
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/20 transition-all hover:bg-brand-600 hover:shadow-brand-500/40 active:scale-95"
                  >
                    <PlusIcon className="size-4" />
                    Append Choice
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {choices.map((c, idx) => (
                  <div 
                    key={idx} 
                    className="group item animate-in fade-in slide-in-from-bottom-2 duration-300 relative flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-brand-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                  >
                    <div className="absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-brand-500 opacity-0 transition-opacity group-hover:opacity-100" />
                    
                    {editingChoiceIndex === idx ? (
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-1 gap-2">
                          <Input
                            value={editChoiceEn}
                            onChange={(e: any) => setEditChoiceEn(e.target.value)}
                            className="text-sm"
                            autoFocus
                          />
                          <Input
                            value={editChoiceAr}
                            onChange={(e: any) => setEditChoiceAr(e.target.value)}
                            className="text-right text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            type="button" 
                            onClick={handleUpdateChoice} 
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400"
                          >
                            <CheckCircleIcon className="size-3" /> Save
                          </button>
                          <button 
                            type="button" 
                            onClick={handleCancelEditChoice}
                            className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 overflow-hidden">
                          <div className="truncate font-semibold text-gray-900 dark:text-white">{c.en}</div>
                          <div className="truncate text-xs text-gray-500 dark:text-gray-400" dir="rtl">{c.ar}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            type="button" 
                            onClick={() => handleEditChoice(idx)} 
                            className="rounded-lg p-2 text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
                          >
                            <PencilIcon className="size-4" />
                          </button>
                          <button 
                            type="button" 
                            onClick={() => removeChoice(idx)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10 dark:hover:text-error-400"
                          >
                            <TrashBinIcon className="size-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {inputType === "repeatable_group" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 group relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Nested Fields Configuration</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Define the schema for the repeatable group</p>
              </div>
              <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-500/10">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>

            <div className="space-y-6">
              {subFields.map((sf, idx) => (
                <div 
                  key={sf.fieldId} 
                  className={`relative overflow-hidden rounded-2xl border transition-all ${
                    collapsedSubFields.has(idx) 
                      ? "border-gray-100 bg-gray-50/30 dark:border-gray-800 dark:bg-gray-800/10" 
                      : "border-brand-200 bg-white shadow-sm dark:border-brand-800/50 dark:bg-gray-900"
                  }`}
                >
                  <div 
                    className="flex cursor-pointer items-center justify-between p-4"
                    onClick={() => toggleSubFieldCollapse(idx)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
                        collapsedSubFields.has(idx)
                          ? "bg-gray-100 text-gray-500 dark:bg-gray-800"
                          : "bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400"
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {(typeof sf.label === "string" ? sf.label : sf.label?.en) || `Untitled Field ${idx + 1}`}
                        </span>
                        <span className="ml-2 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:bg-gray-800">
                          {sf.inputType}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeSubField(idx); }}
                        className="rounded-lg p-2 text-gray-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10"
                      >
                        <TrashBinIcon className="size-4" />
                      </button>
                      <svg 
                        className={`size-5 transform text-gray-400 transition-transform duration-300 ${collapsedSubFields.has(idx) ? "" : "rotate-180"}`} 
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {!collapsedSubFields.has(idx) && (
                    <div className="animate-in fade-in slide-in-from-top-2 border-t border-gray-100 p-5 dark:border-gray-800">
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Label (EN)</Label>
                            <Input
                              value={typeof sf.label === "string" ? sf.label : (sf.label?.en || "")}
                              onChange={(e: any) => {
                                const base = typeof sf.label === "string" ? { en: sf.label } : (sf.label || {});
                                updateSubField(idx, { label: { ...base, en: e.target.value } });
                              }}
                              placeholder="e.g. Skill Name"
                            />
                          </div>
                          <div className="space-y-2" dir="rtl">
                            <Label className="block w-full text-right">عنوان الحقل (بالعربية)</Label>
                            <Input
                              value={typeof sf.label === "string" ? "" : (sf.label?.ar ?? "")}
                              onChange={(e: any) => {
                                const base = typeof sf.label === "string" ? { en: sf.label } : (sf.label || {});
                                updateSubField(idx, { label: { ...base, ar: e.target.value } });
                              }}
                              className="text-right"
                            />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Field Type</Label>
                            <Select
                              options={subFieldTypeOptions}
                              value={sf.inputType}
                              onChange={(v: string) => updateSubField(idx, { inputType: v })}
                            />
                          </div>
                          <div className="pt-4">
                            <Switch 
                              label="Is Required"
                              checked={!!sf.isRequired}
                              onChange={(val) => updateSubField(idx, { isRequired: val })}
                            />
                          </div>
                        </div>
                      </div>

                      {(sf.inputType === "radio" || sf.inputType === "dropdown" || sf.inputType === "checkbox") && (
                        <div className="mt-8 rounded-2xl bg-gray-50/50 p-4 dark:bg-gray-800/20">
                          <Label className="mb-4 block text-xs font-bold uppercase tracking-widest text-gray-400">Option Management</Label>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <Input 
                              placeholder="Choice (EN)" 
                              value={sf._newChoiceEn || ""} 
                              onChange={(e: any) => updateSubField(idx, { _newChoiceEn: e.target.value })} 
                              onKeyDown={(e: any) => { if (e.key === "Enter") { e.preventDefault(); const en = (sf._newChoiceEn || "").trim(); const ar = (sf._newChoiceAr || "").trim(); if (!en || !ar) return; const nextChoices = (sf.choices || []).concat([{ en, ar }]); updateSubField(idx, { choices: nextChoices, _newChoiceEn: "", _newChoiceAr: "" }); } }} 
                              className="bg-white dark:bg-gray-900"
                            />
                            <Input 
                              placeholder="Choice (AR)" 
                              value={sf._newChoiceAr || ""} 
                              onChange={(e: any) => updateSubField(idx, { _newChoiceAr: e.target.value })} 
                              onKeyDown={(e: any) => { if (e.key === "Enter") { e.preventDefault(); const en = (sf._newChoiceEn || "").trim(); const ar = (sf._newChoiceAr || "").trim(); if (!en || !ar) return; const nextChoices = (sf.choices || []).concat([{ en, ar }]); updateSubField(idx, { choices: nextChoices, _newChoiceEn: "", _newChoiceAr: "" }); } }} 
                              className="text-right bg-white dark:bg-gray-900"
                            />
                          </div>
                          <button 
                            type="button" 
                            onClick={() => {
                              const en = (sf._newChoiceEn || "").trim();
                              const ar = (sf._newChoiceAr || "").trim();
                              if (!en || !ar) return;
                              const nextChoices = (sf.choices || []).concat([{ en, ar }]);
                              updateSubField(idx, { choices: nextChoices, _newChoiceEn: "", _newChoiceAr: "" });
                            }} 
                            className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                          >
                            <PlusIcon className="size-4" /> Add Sub-option
                          </button>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {(sf.choices || []).map((c: any, cidx: number) => (
                              <div key={cidx} className="group/choice relative flex items-center gap-2 rounded-xl border border-gray-100 bg-white py-1.5 pl-3 pr-2 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                  {typeof c === "string" ? c : c.en}
                                </span>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const next = sf.choices.filter((_: any, i: number) => i !== cidx);
                                    updateSubField(idx, { choices: next });
                                  }}
                                  className="rounded-md p-1 text-gray-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      { sf.inputType === "number" && (
                        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Min Value</Label>
                            <Input type="number" value={sf.minValue ?? ""} onChange={(e: any) => updateSubField(idx, { minValue: e.target.value ? Number(e.target.value) : undefined })} placeholder="None" />
                          </div>
                          <div className="space-y-2">
                            <Label>Max Value</Label>
                            <Input type="number" value={sf.maxValue ?? ""} onChange={(e: any) => updateSubField(idx, { maxValue: e.target.value ? Number(e.target.value) : undefined })} placeholder="None" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addSubField}
                className="flex i w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-6 text-sm font-bold text-gray-500 transition-all hover:border-brand-300 hover:bg-brand-50/30 hover:text-brand-600 dark:border-gray-800 dark:hover:border-brand-800/50 dark:hover:bg-brand-500/5"
              >
                <PlusIcon className="size-5" />
                Add Group Field
              </button>
            </div>
          </div>
        )}

        <div className="sticky bottom-6 z-20 flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-2xl bg-white/80 px-8 py-3 text-sm font-bold text-gray-700 shadow-lg backdrop-blur-md transition-all hover:bg-gray-50 dark:bg-gray-900/80 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="flex items-center gap-2 rounded-2xl bg-brand-500 px-10 py-3 text-sm font-bold text-white shadow-xl shadow-brand-500/25 transition-all hover:bg-brand-600 hover:shadow-brand-500/40 active:scale-95 disabled:opacity-50"
          >
            {createMutation.isPending || updateMutation.isPending ? "Saving..." : (editingField ? "Update Field" : "Save Field")}
          </button>
        </div>
      </form>
    </div>
  );
}
