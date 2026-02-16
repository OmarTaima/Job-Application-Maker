import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import ComponentCard from "../../../components/common/ComponentCard";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import Select from "../../../components/form/Select";
import Switch from "../../../components/form/switch/Switch";
import { PlusIcon, PencilIcon, TrashBinIcon, CheckCircleIcon } from "../../../icons";
import { useCreateSavedField, useUpdateSavedField } from "../../../hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { savedFieldsKeys } from "../../../hooks/queries/useSavedFields";
import Swal from "sweetalert2";
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

  // Removed unused fieldId state
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

  const createMutation = useCreateSavedField();
  const updateMutation = useUpdateSavedField();
  const qc = useQueryClient();

  useEffect(() => {
    if (!editingField) return;
    // Removed setFieldId as fieldId state is unused
    // Normalize label which may be string or object
    if (editingField.label && typeof editingField.label === "object") {
      setLabelEn(editingField.label.en || "");
      setLabelAr(editingField.label.ar || editingField.label.en || "");
    } else {
      setLabelEn(editingField.label || "");
      // If original label was a single string, use it as Arabic fallback as well
      setLabelAr(editingField.label || editingField.label?.en || "");
    }
    setInputType(editingField.inputType || "text");
    setIsRequired(!!editingField.isRequired);
    setDefaultValue(editingField.defaultValue || "");
    setMinValue(editingField.minValue ?? undefined);
    setMaxValue(editingField.maxValue ?? undefined);
    // Normalize choices
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
    }
  }, [editingField]);

  const generateFieldId = (label: string) => {
    const normalized = (label || "").trim().toLowerCase();
    if (normalized === "have a mobile") return "have_a_mobile";
    // fallback: slugify label to snake_case
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

  // Sub-field choice edit helpers
  const handleEditSubChoice = (groupIndex: number, choiceIndex: number) => {
    const sf = subFields[groupIndex] || {};
    const choice = (sf.choices || [])[choiceIndex] || { en: "", ar: "" };
    updateSubField(groupIndex, { _editingChoiceIndex: choiceIndex, _editChoiceEn: choice.en || choice || "", _editChoiceAr: choice.ar || choice.en || choice || "" });
  };

  const handleUpdateSubChoice = (groupIndex: number) => {
    const sf = subFields[groupIndex] || {};
    const idx = sf._editingChoiceIndex;
    if (idx === undefined || idx === null) return;
    const en = (sf._editChoiceEn || "").trim();
    const ar = (sf._editChoiceAr || en).trim();
    const next = (sf.choices || []).map((c: any, i: number) => (i === idx ? { en, ar } : c));
    updateSubField(groupIndex, { choices: next, _editingChoiceIndex: null, _editChoiceEn: "", _editChoiceAr: "" });
  };

  const handleCancelSubEdit = (groupIndex: number) => {
    updateSubField(groupIndex, { _editingChoiceIndex: null, _editChoiceEn: "", _editChoiceAr: "" });
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

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    const finalFieldId = editingField?.fieldId || generateFieldId(labelEn);

    // Validation: choice-based types must have at least one choice
    const choiceTypes = ["radio", "dropdown", "checkbox"];
    if (choiceTypes.includes(inputType)) {
      if (!choices || choices.length === 0) {
        Swal.fire({ title: "Validation", text: "Please add at least one choice for this field.", icon: "warning" });
        return;
      }
    }

    // Validate group/sub-fields
    for (let i = 0; i < (subFields || []).length; i++) {
      const sf = subFields[i] || {};
      const sfType = sf.inputType;
      if (choiceTypes.includes(sfType)) {
        const sfChoices = sf.choices || [];
        if (!Array.isArray(sfChoices) || sfChoices.length === 0) {
          const label = typeof sf.label === 'string' ? sf.label : (sf.label?.en || sf.label?.ar || `#${i + 1}`);
          Swal.fire({ title: "Validation", text: `Please add at least one choice for group field "${label}".`, icon: "warning" });
          return;
        }
      }
    }

    const payload: any = {
      fieldId: finalFieldId,
      // ensure Arabic fallback exists to satisfy Joi schema
      label: { en: labelEn, ar: labelAr || labelEn },
      inputType,
      isRequired,
      defaultValue,
    } as any;
    if (minValue !== undefined) payload.minValue = minValue;
    if (maxValue !== undefined) payload.maxValue = maxValue;
    payload.choices = (choices || []).map((c) => ({ en: c.en || "", ar: c.ar || c.en || "" }));
    payload.groupFields = (subFields || []).map((sf: any) => ({
      fieldId: sf.fieldId,
      label: {
        en: typeof sf.label === 'string' ? sf.label : (sf.label?.en || ""),
        ar: typeof sf.label === 'string' ? sf.label : (sf.label?.ar || sf.label?.en || ""),
      },
      inputType: sf.inputType,
      isRequired: !!sf.isRequired,
      choices: (sf.choices || []).map((c: any) => ({ en: c.en || c || "", ar: c.ar || c.en || c || "" })),
      defaultValue: sf.defaultValue ?? null,
      minValue: sf.minValue,
      maxValue: sf.maxValue,
    }));

    try {
      if (editingField) {
        // Perform network request and wait for validation
        try {
          const updated = await updateMutation.mutateAsync({ fieldId: editingField.fieldId, data: payload });
          // Update cache with server result
          qc.setQueryData(savedFieldsKeys.list(), (old: any) =>
            (old || []).map((f: any) => (f.fieldId === editingField.fieldId ? { ...f, ...updated } : f))
          );
          Swal.fire({ title: "Updated", icon: "success", timer: 1000, showConfirmButton: false });
          navigate(-1);
        } catch (err: any) {
          const resp = getErrorResponse(err);
          // Show validation errors and keep form data intact so user can fix
          const details = resp.validationErrors && resp.validationErrors.length
            ? resp.validationErrors.map(v => `${v.field}: ${v.message}`).join('\n')
            : resp.message;
          Swal.fire({ title: "Error", text: details || "Validation failed", icon: "error" });
          return;
        }
      } else {
        try {
          const created = await createMutation.mutateAsync(payload);
          // Invalidate or append to cache using returned server object
          qc.setQueryData(savedFieldsKeys.list(), (old: any) => [created, ...(old || [])]);
          Swal.fire({ title: "Created", icon: "success", timer: 1000, showConfirmButton: false });
          navigate(-1);
        } catch (err: any) {
          const resp = getErrorResponse(err);
          const details = resp.validationErrors && resp.validationErrors.length
            ? resp.validationErrors.map(v => `${v.field}: ${v.message}`).join('\n')
            : resp.message;
          Swal.fire({ title: "Error", text: details || "Validation failed", icon: "error" });
          return;
        }
      }
    } catch (err: any) {
      const resp = getErrorResponse(err);
      Swal.fire({ title: "Error", text: resp.message || String(err), icon: "error" });
    }
  };

  return (
    <div className="space-y-6">
      <PageMeta title={editingField ? "Edit Saved Field" : "Create Saved Field"} description="Create or edit saved field" />
      <PageBreadcrumb pageTitle={editingField ? "Edit Saved Field" : "Create Saved Field"} />

      <ComponentCard title={editingField ? "Edit Saved Field" : "Create Saved Field"}>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Field ID is auto-generated and hidden from the user */}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Label (English)</Label>
              <Input value={labelEn} onChange={(e: any) => setLabelEn(e.target.value)} required />
            </div>
            <div>
              <Label>Label (Arabic)</Label>
              <Input value={labelAr} onChange={(e: any) => setLabelAr(e.target.value)} required />
            </div>
          </div>

          <div>
            <Label>Input Type</Label>
            <Select
              options={inputTypeOptions}
              value={inputType}
              onChange={(v: string) => setInputType(v)}
              placeholder="Select input type"
              className="w-56"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            
            {inputType === "number" && (
              <>
                <div>
                  <Label>Min Value</Label>
                  <Input type="number" value={minValue ?? ""} onChange={(e: any) => setMinValue(e.target.value ? Number(e.target.value) : undefined)} />
                </div>
                <div>
                  <Label>Max Value</Label>
                  <Input type="number" value={maxValue ?? ""} onChange={(e: any) => setMaxValue(e.target.value ? Number(e.target.value) : undefined)} />
                </div>
              </>
            )}
          </div>

          <div>
            <Label>Required</Label>
            <div className="mt-2">
              <Switch 
                checked={isRequired} 
                onChange={(val: boolean) => setIsRequired(val)} 
                label="Required"
              />
            </div>
          </div>

          {(inputType === "radio" || inputType === "dropdown" || inputType === "checkbox" || inputType === "tags") && (
            <div>
              <Label>Choices</Label>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <Input placeholder="Choice (English)" value={newChoiceEn} onChange={(e: any) => setNewChoiceEn(e.target.value)} onKeyDown={(e: any) => { if (e.key === 'Enter') { e.preventDefault(); addChoice(); } }} />
                <Input placeholder="Choice (Arabic)" value={newChoiceAr} onChange={(e: any) => setNewChoiceAr(e.target.value)} onKeyDown={(e: any) => { if (e.key === 'Enter') { e.preventDefault(); addChoice(); } }} />
                <button type="button" onClick={addChoice} className="rounded-lg bg-brand-500 px-3 py-2 text-white">Add Choice</button>
              </div>
              <div className="mt-3 space-y-2">
                {choices.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 border rounded px-3 py-2">
                    {editingChoiceIndex === idx ? (
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Input
                          value={editChoiceEn}
                          onChange={(e: any) => setEditChoiceEn(e.target.value)}
                          onKeyDown={(e: any) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleUpdateChoice();
                            } else if (e.key === 'Escape') {
                              handleCancelEditChoice();
                            }
                          }}
                        />
                        <Input
                          value={editChoiceAr}
                          onChange={(e: any) => setEditChoiceAr(e.target.value)}
                          onKeyDown={(e: any) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleUpdateChoice();
                            } else if (e.key === 'Escape') {
                              handleCancelEditChoice();
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="flex-1">
                        <div className="text-sm font-medium">{c.en}</div>
                        {c.ar && <div className="text-xs text-gray-500">{c.ar}</div>}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {editingChoiceIndex === idx ? (
                        <>
                          <button type="button" onClick={handleUpdateChoice} className="text-green-600" title="Save">
                            <CheckCircleIcon className="size-4" />
                          </button>
                          <button type="button" onClick={handleCancelEditChoice} className="text-gray-600" title="Cancel">×</button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => handleEditChoice(idx)} className="text-brand-600" title="Edit choice">
                            <PencilIcon className="size-3" />
                          </button>
                          <button type="button" onClick={() => removeChoice(idx)} className="text-error-600" title="Remove choice">
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

          {inputType === "repeatable_group" && (
            <div>
              <Label>Group Fields</Label>
              <div className="space-y-3">
                {subFields.map((sf, idx) => (
                  <div key={sf.fieldId} className="border rounded p-3">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      <div>
                        <Label>Label (EN)</Label>
                        <Input
                          value={typeof sf.label === 'string' ? sf.label : (sf.label?.en || "")}
                          onChange={(e: any) => {
                            const base = typeof sf.label === 'string' ? { en: sf.label } : (sf.label || {});
                            updateSubField(idx, { label: { ...base, en: e.target.value } });
                          }}
                        />
                      </div>
                      <div>
                        <Label>Label (AR)</Label>
                        <Input
                          value={typeof sf.label === 'string' ? "" : (sf.label?.ar ?? "")}
                          onChange={(e: any) => {
                            const base = typeof sf.label === 'string' ? { en: sf.label } : (sf.label || {});
                            updateSubField(idx, { label: { ...base, ar: e.target.value } });
                          }}
                          required
                        />
                      </div>
                      <div>
                        <Label>Type</Label>
                        <Select
                          options={subFieldTypeOptions}
                          value={sf.inputType}
                          onChange={(v: string) => updateSubField(idx, { inputType: v })}
                          className="w-48"
                        />
                      </div>
                    </div>
                    {/* Sub-field settings depending on type */}
                    { (sf.inputType === "radio" || sf.inputType === "dropdown" || sf.inputType === "checkbox") && (
                      <div className="mt-3">
                        <Label>Choices (EN / AR)</Label>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                          <Input placeholder="Choice (English)" value={sf._newChoiceEn || ""} onChange={(e: any) => updateSubField(idx, { _newChoiceEn: e.target.value })} onKeyDown={(e: any) => { if (e.key === 'Enter') { e.preventDefault(); const en = (sf._newChoiceEn || "").trim(); const ar = (sf._newChoiceAr || "").trim(); if (!en || !ar) return; const nextChoices = (sf.choices || []).concat([{ en, ar }]); updateSubField(idx, { choices: nextChoices, _newChoiceEn: "", _newChoiceAr: "" }); } }} />
                          <Input placeholder="Choice (Arabic)" value={sf._newChoiceAr || ""} onChange={(e: any) => updateSubField(idx, { _newChoiceAr: e.target.value })} onKeyDown={(e: any) => { if (e.key === 'Enter') { e.preventDefault(); const en = (sf._newChoiceEn || "").trim(); const ar = (sf._newChoiceAr || "").trim(); if (!en || !ar) return; const nextChoices = (sf.choices || []).concat([{ en, ar }]); updateSubField(idx, { choices: nextChoices, _newChoiceEn: "", _newChoiceAr: "" }); } }} />
                          <button type="button" onClick={() => {
                            const en = (sf._newChoiceEn || "").trim();
                            const ar = (sf._newChoiceAr || "").trim();
                            if (!en || !ar) return;
                            const nextChoices = (sf.choices || []).concat([{ en, ar }]);
                            updateSubField(idx, { choices: nextChoices, _newChoiceEn: "", _newChoiceAr: "" });
                          }} className="rounded-lg bg-brand-500 px-3 py-2 text-white">Add Choice</button>
                        </div>
                          <div className="mt-3 space-y-2">
                          {(sf.choices || []).map((c: any, cidx: number) => (
                            <div key={cidx} className="flex items-center justify-between gap-2 border rounded px-3 py-2">
                              {sf._editingChoiceIndex === cidx ? (
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <Input
                                    value={sf._editChoiceEn || ""}
                                    onChange={(e: any) => updateSubField(idx, { _editChoiceEn: e.target.value })}
                                    onKeyDown={(e: any) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleUpdateSubChoice(idx);
                                      } else if (e.key === 'Escape') {
                                        handleCancelSubEdit(idx);
                                      }
                                    }}
                                  />
                                  <Input
                                    value={sf._editChoiceAr || ""}
                                    onChange={(e: any) => updateSubField(idx, { _editChoiceAr: e.target.value })}
                                    onKeyDown={(e: any) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleUpdateSubChoice(idx);
                                      } else if (e.key === 'Escape') {
                                        handleCancelSubEdit(idx);
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="flex-1">
                                  <div className="text-sm font-medium">{c.en}</div>
                                  {c.ar && <div className="text-xs text-gray-500">{c.ar}</div>}
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                {sf._editingChoiceIndex === cidx ? (
                                  <>
                                    <button type="button" onClick={() => handleUpdateSubChoice(idx)} className="text-green-600" title="Save">
                                      <CheckCircleIcon className="size-4" />
                                    </button>
                                    <button type="button" onClick={() => handleCancelSubEdit(idx)} className="text-gray-600" title="Cancel">×</button>
                                  </>
                                ) : (
                                  <>
                                    <button type="button" onClick={() => handleEditSubChoice(idx, cidx)} className="text-brand-600" title="Edit choice">
                                      <PencilIcon className="size-3" />
                                    </button>
                                    <button type="button" onClick={() => {
                                      const next = (sf.choices || []).filter((_: any, i: number) => i !== cidx);
                                      updateSubField(idx, { choices: next });
                                    }} className="text-error-600" title="Remove choice">
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

                    { sf.inputType === "number" && (
                      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        <div>
                          <Label>Min Value</Label>
                          <Input type="number" value={sf.minValue ?? ""} onChange={(e: any) => updateSubField(idx, { minValue: e.target.value ? Number(e.target.value) : undefined })} />
                        </div>
                        <div>
                          <Label>Max Value</Label>
                          <Input type="number" value={sf.maxValue ?? ""} onChange={(e: any) => updateSubField(idx, { maxValue: e.target.value ? Number(e.target.value) : undefined })} />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-3">
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={!!sf.isRequired} onChange={(e: any) => updateSubField(idx, { isRequired: e.target.checked })} />
                        <span className="text-sm text-gray-600">Required</span>
                      </label>
                      <button type="button" onClick={() => removeSubField(idx)} className="ml-auto text-red-500">Remove Field</button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addSubField} className="rounded-lg bg-brand-500 px-3 py-2 text-white inline-flex items-center gap-2"><PlusIcon /> Add Sub Field</button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button type="submit" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">{editingField ? "Update" : "Create"}</button>
            <button type="button" onClick={() => navigate(-1)} className="rounded-lg bg-gray-200 px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      </ComponentCard>
    </div>
  );
}
