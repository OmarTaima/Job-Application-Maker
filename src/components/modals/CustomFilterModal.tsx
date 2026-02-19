import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, FormControlLabel, Checkbox } from "@mui/material";

type Props = {
  open: boolean;
  onClose: () => void;
  jobPositions: any[];
  applicants?: any[];
  jobPositionMap?: Record<string, any>;
  customFilters: any[];
  setCustomFilters: React.Dispatch<React.SetStateAction<any[]>>;
  columnFilters: any[];
  setColumnFilters: React.Dispatch<React.SetStateAction<any[]>>;
  genderOptions?: Array<{ id: string; title: string }>;
};

export const normalizeLabelSimple = (l: any) => (l || '').toString().replace(/\u200E|\u200F/g, '').replace(/[^\w\u0600-\u06FF\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
export const normalizeForCompare = (s: any) => (s || '').toString().replace(/\u200E|\u200F/g, '').trim().toLowerCase();

// Canonical map for tolerant matching of special fields
export const canonicalMap: Record<string, string[]> = {
  salary: ['expected salary', 'expected_salary', 'الراتب المتوقع', 'الراتب_المتوقع', 'راتب'],
  education_level: ['education level', 'education_level', 'المؤهل الدراسي', 'المؤهل_الدراسي'],
  engineering_specialization: ['engineering specialization', 'engineering_specialization', 'التخصص الهندسي', 'التخصص_الهندسي', 'engineering specializaion', 'engineering_specializaion'],
};

export const getCanonicalType = (f: any) => {
  if (!f) return undefined;
  try {
    const lbl = normalizeLabelSimple(`${f.labelEn || f.label?.en || ''} ${f.labelAr || f.label?.ar || ''} ${f.fieldId || ''}`);
    for (const [k, vals] of Object.entries(canonicalMap)) {
      for (const v of vals) {
        const nv = normalizeLabelSimple(v);
        if (!nv) continue;
        if (lbl.includes(nv) || nv.includes(lbl) || String(f.fieldId || '').toLowerCase().includes(nv)) return k;
      }
    }
  } catch (e) {
    // ignore
  }
  return undefined;
};

// Helper to robustly read a custom response value for a given filter definition
export const getCustomResponseValue = (a: any, f: any) => {
  if (!a) return '';
  const responses = a.customResponses || a.customFieldResponses || {};
  const top = a || {};

  const tryKey = (k: any) => {
    if (k === undefined || k === null) return undefined;
    if (typeof k !== 'string' && typeof k !== 'number') return undefined;
    const key = String(k);
    if (responses && Object.prototype.hasOwnProperty.call(responses, key)) return responses[key];
    if (top && Object.prototype.hasOwnProperty.call(top, key)) return top[key];
    return undefined;
  };

  const byId = tryKey(f.fieldId);
  if (byId !== undefined) return byId;
  const byEn = tryKey(f.labelEn);
  if (byEn !== undefined) return byEn;
  const byAr = tryKey(f.labelAr);
  if (byAr !== undefined) return byAr;
  const byLabel = tryKey(f.label);
  if (byLabel !== undefined) return byLabel;

  const norm = (s: any) => (s || '').toString().replace(/\u200E|\u200F/g, '').replace(/[^\w\u0600-\u06FF\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const rawTargets = [f.labelEn, f.labelAr, f.fieldId].filter(Boolean);
  const targetSet = new Set<string>();
  rawTargets.map(norm).forEach((t) => {
    if (!t) return;
    targetSet.add(t);
    targetSet.add(t.replace(/\s+/g, '_'));
    targetSet.add(t.replace(/_/g, ' '));
  });

  const canonical = getCanonicalType(f);
  if (canonical && canonicalMap[canonical]) {
    const allowed = canonicalMap[canonical].map((s) => normalizeLabelSimple(s));
    for (const [k, v] of Object.entries(responses || {})) {
      try {
        const nk = normalizeLabelSimple(k);
        if (allowed.includes(nk) || allowed.some((al) => nk.includes(al) || al.includes(nk))) return v;
      } catch (e) {
        // ignore
      }
    }
    return '';
  }

  for (const [k, v] of Object.entries({ ...(responses || {}), ...(top || {}) })) {
    const nk = norm(k);
    if (targetSet.has(nk)) return v;
    if (targetSet.has(nk.replace(/\s+/g, '_'))) return v;
    if (targetSet.has(nk.replace(/_/g, ' '))) return v;
  }

  const matchesSalaryLabel = (/salary|expected salary|الراتب|الراتب المتوقع|راتب/).test(((f.label?.en || '') + ' ' + (f.label?.ar || '')).toString().toLowerCase());
  if (f.type === 'range' || matchesSalaryLabel) {
    for (const v of Object.values({ ...(responses || {}), ...(top || {}) })) {
      if (typeof v === 'number') return v;
      if (typeof v === 'string' && /\d|[\u0660-\u0669\u06F0-\u06F9]/.test(v)) return v;
      if (Array.isArray(v)) {
        const found = v.find((it: any) => (typeof it === 'number') || (typeof it === 'string' && /\d/.test(it)));
        if (found !== undefined) return found;
      }
      if (typeof v === 'object' && v !== null) {
        const candidateKeys = ['value','val','amount','salary','expectedSalary','min','max','amountValue','numeric','0'];
        for (const ck of candidateKeys) {
          if (Object.prototype.hasOwnProperty.call(v, ck)) {
            const cand = (v as any)[ck];
            if (cand !== undefined && cand !== null && (typeof cand === 'number' || (typeof cand === 'string' && /\d/.test(cand)))) return cand;
          }
        }
      }
    }
  }

  return '';
};

// Normalize any raw response into array of primitive strings for comparison
export const extractResponseItems = (raw: any): string[] => {
  if (raw === null || raw === undefined) return [];
  const pickFromObject = (o: any) => {
    if (o === null || o === undefined) return '';
    if (typeof o === 'number') return String(o);
    if (typeof o === 'string') return o;
    return (o.id ?? o._id ?? o.value ?? o.val ?? o.en ?? o.ar ?? o.label ?? o.name ?? '') + '';
  };
  if (Array.isArray(raw)) return raw.map(pickFromObject).filter((s) => s !== '');
  if (typeof raw === 'object') {
    const candidates: string[] = [];
    const prim = pickFromObject(raw);
    if (prim) candidates.push(prim);
    Object.entries(raw).forEach(([k, v]) => {
      if (v === null || v === undefined) return;
      if (typeof v === 'object') return;
      if (typeof v === 'boolean') {
        if (v) candidates.push(String(k));
        return;
      }
      candidates.push(String(v));
      candidates.push(String(k));
    });
    return Array.from(new Set(candidates)).filter((s) => s !== '');
  }
  return [String(raw)];
};

export const expandForms = (s: string) => {
  const out = new Set<string>();
  if (!s) return [] as string[];
  out.add(s);
  out.add(s.replace(/\s+/g, '_'));
  out.add(s.replace(/_/g, ' '));
  return Array.from(out);
};

// Attach helpers to window for reuse/debugging (counts as usage to satisfy TS)
try {
  (window as any).__customFilterHelpers = { getCustomResponseValue, extractResponseItems, expandForms, getCanonicalType, canonicalMap };
} catch (e) {
  // ignore
}

export const buildFieldToJobIds = (jobPositions: any[]) => {
  const map: Record<string, Set<string>> = {};
  const getId = (v: any) => (typeof v === 'string' ? v : v?._id ?? v?.id ?? '');
  (jobPositions || []).forEach((job: any) => {
    const jid = getId(job._id) || getId(job.id);
    if (!jid) return;
    if (!Array.isArray(job.customFields)) return;
    job.customFields.forEach((cf: any) => {
      const raw = `${cf.label?.en || ''} ${cf.label?.ar || ''} ${cf.fieldId || ''}`;
      const key = normalizeLabelSimple(raw) || String(cf.fieldId || '');
      if (!map[key]) map[key] = new Set<string>();
      map[key].add(String(jid));
      if (cf.fieldId) {
        const fid = String(cf.fieldId);
        if (!map[fid]) map[fid] = new Set<string>();
        map[fid].add(String(jid));
      }
      try {
        const canon = getCanonicalType(cf) || getCanonicalType({ label: cf.label, fieldId: cf.fieldId });
        if (canon) {
          if (!map[canon]) map[canon] = new Set<string>();
          map[canon].add(String(jid));
          const variants = canonicalMap[canon] || [];
          variants.forEach((v) => {
            const nk = normalizeLabelSimple(v);
            if (!map[nk]) map[nk] = new Set<string>();
            map[nk].add(String(jid));
          });
        }
      } catch (e) {
        // ignore
      }
    });
  });
  return map;
};

// Fields to hide entirely from the Custom Filter modal (normalized)
const _excludedRaw: string[] = [
  // keep gender and birthdate available in modal
  // 'gender', 'النوع',
  // 'birthdate', 'تاريخ الميلاد',
  // keep courses & personal skills available as boolean filters
  // 'courses & certifications', 'الدورات والشهادات',
  // 'personal skills', 'المهارات الشخصية',
];
const _excludedSet = new Set(_excludedRaw.map((r) => normalizeLabelSimple(r)));
export const isExcludedLabel = (rawLabel: any) => {
  try {
    const n = normalizeLabelSimple(rawLabel || '');
    for (const ex of Array.from(_excludedSet)) {
      if (!ex) continue;
      if (n.includes(ex) || ex.includes(n)) return true;
    }
  } catch (e) {
    // ignore
  }
  return false;
};

 
const CustomFilterModal: React.FC<Props> = ({ open, onClose, jobPositions = [], customFilters = [], setCustomFilters, columnFilters = [], setColumnFilters, genderOptions = [] }) => {
  const [modalSelectedJobIds, setModalSelectedJobIds] = useState<string[]>([]);
  const [modalJobQuery, setModalJobQuery] = useState<string>('');
  const isExcludedLabel = (_: string) => false;

  useEffect(() => {
    // initialize selected jobs from existing columnFilters if present
    try {
      const jf = Array.isArray(columnFilters) ? columnFilters.find((c: any) => c.id === 'jobPositionId') : undefined;
      if (jf && Array.isArray(jf.value)) setModalSelectedJobIds(jf.value.map(String));
    } catch (e) {
      // ignore
    }
  }, [open, columnFilters]);

  // Persist customFilters immediately when they change so entered values
  // survive navigation/back until cleared or overwritten.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('applicants_table_state');
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.customFilters = customFilters || [];
      // also store current columnFilters so state stays consistent
      parsed.columnFilters = columnFilters || parsed.columnFilters || [];
      const str = JSON.stringify(parsed);
      sessionStorage.setItem('applicants_table_state', str);
      try { localStorage.setItem('applicants_table_state', str); } catch (e) { /* ignore */ }
    } catch (e) {
      // ignore
    }
  }, [customFilters, columnFilters]);

  return (
    <>
     {/* Custom Filter Modal */}
  
      {/* Declare modalJobQuery state */}
      {(() => {
        // Declare modalJobQuery state
        // Attach to window for debugging if needed
        // (window as any).modalJobQuery = modalJobQuery;
        return null;
      })()}
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Custom Filter Settings</DialogTitle>
        <DialogContent>
          <div className="bg-white dark:bg-gray-800 rounded p-4">
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Jobs</div>
                {/* Job search input */}
                <TextField
                  size="small"
                  placeholder="Search jobs..."
                  value={modalJobQuery}
                  onChange={e => setModalJobQuery(e.target.value)}
                  className="mb-2"
                />
                <div className="flex gap-2 flex-wrap">
                  {(jobPositions || []).filter((job: any) => {
                    const jid = (typeof job._id === 'string' ? job._id : job._id?._id || job.id || '') || '';
                    const title = (job.title && (typeof job.title === 'string' ? job.title : job.title?.en)) || job.name || jid;
                    if (!modalJobQuery || !String(modalJobQuery).trim()) return true;
                    const q = String(modalJobQuery).toLowerCase().trim();
                    return String(title || '').toLowerCase().includes(q) || String(jid || '').toLowerCase().includes(q);
                  }).map((job: any) => {
                    const jid = (typeof job._id === 'string' ? job._id : job._id?._id || job.id || '') || '';
                    const title = (job.title && (typeof job.title === 'string' ? job.title : job.title?.en)) || job.name || jid;
                    return (
                      <FormControlLabel key={jid} control={<Checkbox size="small" checked={modalSelectedJobIds.includes(String(jid))} onChange={(e) => {
                        const checked = e.target.checked;
                        setModalSelectedJobIds(prev => {
                          if (checked) return Array.from(new Set([...prev, String(jid)]));
                          return prev.filter((x) => x !== String(jid));
                        });
                      }} />} label={<span className="text-sm">{title}</span>} />
                    );
                  })}
                </div>
              </div>

              {/* Hardcoded Personal Information filters (not from job custom fields) */}
              <div className="pt-3 border-t mt-3">
                <div className="text-sm font-medium mb-2">Personal Information</div>
                <div className="flex flex-col gap-3">
                  {/* Gender (multi-select checkboxes) */}
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-medium">Gender</div>
                    <div className="flex gap-3 flex-wrap">
                      {(genderOptions || []).map((opt: any) => {
                        const existing = customFilters.find((cf: any) => cf.fieldId === '__gender') || {};
                        const selected = Array.isArray(existing.value) ? existing.value : (existing.value ? [existing.value] : []);
                        return (
                          <FormControlLabel key={opt.id} control={<Checkbox size="small" checked={selected.includes(opt.id)} onChange={(e) => {
                            const checked = e.target.checked;
                            setCustomFilters(prev => {
                              const next = prev.filter((p: any) => p.fieldId !== '__gender');
                              let vals = Array.isArray(existing.value) ? [...existing.value] : [];
                              if (checked) vals = [...new Set([...vals, opt.id])]; else vals = vals.filter((v: any) => v !== opt.id);
                              if (vals.length) next.push({ fieldId: '__gender', labelEn: 'Gender', labelAr: 'النوع', type: 'multi', value: vals, choices: (genderOptions || []).map((o: any) => ({ en: o.title, id: o.id })) });
                              return next;
                            });
                          }} />} label={<span className="text-sm">{opt.title}</span>} />
                        );
                      })}
                    </div>
                  </div>

                  {/* Birth Year (Before / After) */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="sm:w-1/3 text-sm font-medium">Birth Date</div>
                    <div className="flex gap-2 items-center w-full">
                      {(() => {
                        const existing = customFilters.find((cf: any) => cf.fieldId === '__birthdate') || {};
                        const yearVal = existing.value?.year ?? '';
                        const modeVal = existing.value?.mode ?? 'after';
                        return (
                          <>
                            <TextField size="small" type="number" label="Year" value={yearVal} onChange={(e) => {
                              const nv = e.target.value;
                              const parsed = nv ? Number(nv) : '';
                              setCustomFilters(prev => {
                                const next = prev.filter((p: any) => p.fieldId !== '__birthdate');
                                if (nv) next.push({ fieldId: '__birthdate', labelEn: 'Birth Date', labelAr: 'تاريخ الميلاد', type: 'birthYear', value: { year: parsed, mode: modeVal } });
                                return next;
                              });
                            }} />
                            <Button variant={modeVal === 'after' ? 'contained' : 'outlined'} size="small" onClick={() => {
                              const newMode = 'after';
                              setCustomFilters(prev => {
                                const next = prev.filter((p: any) => p.fieldId !== '__birthdate');
                                if (yearVal) next.push({ fieldId: '__birthdate', labelEn: 'Birth Date', labelAr: 'تاريخ الميلاد', type: 'birthYear', value: { year: Number(yearVal), mode: newMode } });
                                return next;
                              });
                            }}>After</Button>
                            <Button variant={modeVal === 'before' ? 'contained' : 'outlined'} size="small" onClick={() => {
                              const newMode = 'before';
                              setCustomFilters(prev => {
                                const next = prev.filter((p: any) => p.fieldId !== '__birthdate');
                                if (yearVal) next.push({ fieldId: '__birthdate', labelEn: 'Birth Date', labelAr: 'تاريخ الميلاد', type: 'birthYear', value: { year: Number(yearVal), mode: newMode } });
                                return next;
                              });
                            }}>Before</Button>
                            <Button size="small" onClick={() => { setCustomFilters(prev => prev.filter((p: any) => p.fieldId !== '__birthdate')); }}>Clear</Button>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Has CV (presence) */}
                  <div className="flex items-center gap-3">
                    <div className="sm:w-1/3 text-sm font-medium">Has CV</div>
                    <div className="flex gap-2">
                      {(() => {
                        const existing = customFilters.find((cf: any) => cf.fieldId === '__has_cv') || {};
                        const val = existing.value ?? 'any';
                        return (
                          <>
                            <Button variant={val === true ? 'contained' : 'outlined'} size="small" onClick={() => { setCustomFilters(prev => { const next = prev.filter((p: any) => p.fieldId !== '__has_cv'); next.push({ fieldId: '__has_cv', labelEn: 'Has CV', labelAr: 'لديه سيرة ذاتية', type: 'hasCV', value: true }); return next; }); }}>Has</Button>
                            <Button variant={val === false ? 'contained' : 'outlined'} size="small" onClick={() => { setCustomFilters(prev => { const next = prev.filter((p: any) => p.fieldId !== '__has_cv'); next.push({ fieldId: '__has_cv', labelEn: 'Has CV', labelAr: 'لديه سيرة ذاتية', type: 'hasCV', value: false }); return next; }); }}>No</Button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Applicants preview for selected jobs */}
              {modalSelectedJobIds.length > 0 && (
                <div className="pt-3 border-t mt-3">
                  <div className="flex items-center justify-between">
                    
                    
                  </div>
                 
                </div>
              )}

              {/* Build merged fields from selected jobs (dedupe by normalized label/fieldId) */}
              {modalSelectedJobIds.length === 0 ? (
                <div className="text-sm text-gray-500">Select one or more jobs to display their custom fields.</div>
              ) : (
                (() => {
                  const map: Record<string, any> = {};
                  const getId = (v: any) => (typeof v === 'string' ? v : v?._id ?? v?.id ?? '');
                  (jobPositions || []).forEach((job: any) => {
                    const jid = getId(job._id) || getId(job.id);
                    if (!jid) return;
                    // If modalSelectedJobIds is empty, include all jobs. Otherwise
                    // only include the jobs the user checked.
                    if (modalSelectedJobIds.length > 0 && !modalSelectedJobIds.includes(String(jid))) return;
                    if (!Array.isArray(job.customFields)) return;
                    job.customFields.forEach((cf: any) => {
                      // Use the human label (EN/AR) for deduplication key — avoid
                      // including fieldId which may be unique per-job and cause
                      // duplicate entries for the same visible field.
                      const labelOnly = (cf.label?.en || cf.label?.ar || cf.label || '').toString();
                      const key = normalizeLabelSimple(labelOnly) || String(cf.fieldId || '');
                      if (!key) return; // skip empty/invalid
                      if (!map[key]) map[key] = { ...(cf || {}), jobs: new Set<string>([String(jid)]) };
                      else {
                        // merge choices
                        const existing = map[key];
                        if (Array.isArray(existing.choices) && Array.isArray(cf.choices)) {
                          const merged = Array.from(new Set([...(existing.choices || []).map(JSON.stringify), ...cf.choices.map(JSON.stringify)])).map((s) => JSON.parse(s));
                          existing.choices = merged;
                        } else if (!existing.choices && Array.isArray(cf.choices)) {
                          existing.choices = cf.choices;
                        }
                        existing.jobs.add(String(jid));
                      }
                    });
                  });
                  const fields = Object.values(map).map((v: any) => ({ ...v, jobs: Array.from(v.jobs) }));
                  if (!fields.length) return <div className="text-sm text-gray-500">No custom fields found for selected jobs.</div>;

                  // No hardcoded education values — treat education as presence

                  return fields.map((f: any) => {
                    const rawLabel = `${f.label?.en || ''} ${f.label?.ar || ''}`;
                    if (isExcludedLabel(rawLabel)) return null;
                    const fieldKey = f.fieldId ?? (f.label?.en ?? f.label?.ar ?? '');
                    const fieldKeyNormalized = normalizeLabelSimple(rawLabel) || String(f.fieldId || '');
                    // When matching persisted filters, allow matching by fieldId OR by normalized label
                    const existing = customFilters.find((cf: any) => {
                      try {
                        if (cf.fieldId && String(cf.fieldId) === String(f.fieldId)) return true;
                        const cfLabelNorm = normalizeLabelSimple(cf.labelEn || cf.label || cf.labelAr || '');
                        if (cfLabelNorm && cfLabelNorm === fieldKeyNormalized) return true;
                      } catch (e) {
                        // ignore
                      }
                      return false;
                    }) || {};
                    const saveFieldId = f.fieldId ?? fieldKeyNormalized;
                    const normLabel = normalizeForCompare(rawLabel);
                    const isSalaryField = /salary|expected salary|الراتب|الراتب المتوقع|راتب/.test(normLabel);
                    const isWorkExp = /work experience|work_experience|workexperience|الخبرة|خبرة/.test(normLabel);
                    const isEducation = /education|education level|المؤهل|المؤهل الدراسي/.test(normLabel);
                    const isEngineering = /engineering|speciali|specialization|التخصص|التخصص الهندسي|التخصص_الهندسي/.test(normLabel);
                    const isCourses = /courses|certifications|الدورات|شهادات|الشهادات/.test(normLabel);
                    const isPersonalSkills = /personal skills|skills|المهارات الشخصية|المهارات/.test(normLabel);
                    const isGender = /gender|النوع/.test(normLabel);
                    const isBirthdate = /birthdate|date of birth|تarih|تاريخ الميلاد/.test(normLabel);

                    if (isWorkExp) {
                      const val = existing.value ?? 'any';
                      return (
                        <div key={fieldKey} className="flex items-center gap-3">
                          <div className="sm:w-1/3 text-sm font-medium">{f.label?.en || 'Work Experience'}</div>
                          <div className="flex gap-2">
                            <Button variant={val === true ? 'contained' : 'outlined'} size="small" onClick={() => { setCustomFilters(prev => { const next = prev.filter((p: any) => p.fieldId !== saveFieldId); next.push({ fieldId: saveFieldId, labelEn: f.label?.en, labelAr: f.label?.ar, type: 'hasWorkExperience', value: true }); return next; }); }}>Has</Button>
                            <Button variant={val === false ? 'contained' : 'outlined'} size="small" onClick={() => { setCustomFilters(prev => { const next = prev.filter((p: any) => p.fieldId !== saveFieldId); next.push({ fieldId: saveFieldId, labelEn: f.label?.en, labelAr: f.label?.ar, type: 'hasWorkExperience', value: false }); return next; }); }}>No</Button>
                          </div>
                        </div>
                      );
                    }

                    if (isCourses || isPersonalSkills) {
                      const val = existing.value ?? 'any';
                      const labelText = isCourses ? (f.label?.en || 'Courses / Certifications') : (f.label?.en || 'Personal Skills');
                      return (
                        <div key={fieldKey} className="flex items-center gap-3">
                          <div className="sm:w-1/3 text-sm font-medium">{labelText}</div>
                          <div className="flex gap-2">
                            <Button variant={val === true ? 'contained' : 'outlined'} size="small" onClick={() => { setCustomFilters(prev => { const next = prev.filter((p: any) => p.fieldId !== saveFieldId); next.push({ fieldId: saveFieldId, labelEn: f.label?.en, labelAr: f.label?.ar, type: 'hasField', value: true }); return next; }); }}>Has</Button>
                            <Button variant={val === false ? 'contained' : 'outlined'} size="small" onClick={() => { setCustomFilters(prev => { const next = prev.filter((p: any) => p.fieldId !== saveFieldId); next.push({ fieldId: saveFieldId, labelEn: f.label?.en, labelAr: f.label?.ar, type: 'hasField', value: false }); return next; }); }}>No</Button>
                          </div>
                        </div>
                      );
                    }

                    // Place Education and Engineering next to Work Experience / Courses
                    if (isEducation || isEngineering) {
                      const val = existing.value ?? 'any';
                      const labelText = isEducation ? (f.label?.en || 'Education Level') : (f.label?.en || 'Engineering Specialization');
                      return (
                        <div key={fieldKey} className="flex items-center gap-3">
                          <div className="sm:w-1/3 text-sm font-medium">{labelText}</div>
                          <div className="flex gap-2">
                            <Button variant={val === true ? 'contained' : 'outlined'} size="small" onClick={() => { setCustomFilters(prev => { const next = prev.filter((p: any) => p.fieldId !== saveFieldId); next.push({ fieldId: saveFieldId, labelEn: f.label?.en, labelAr: f.label?.ar, type: 'hasField', value: true }); return next; }); }}>Has</Button>
                            <Button variant={val === false ? 'contained' : 'outlined'} size="small" onClick={() => { setCustomFilters(prev => { const next = prev.filter((p: any) => p.fieldId !== saveFieldId); next.push({ fieldId: saveFieldId, labelEn: f.label?.en, labelAr: f.label?.ar, type: 'hasField', value: false }); return next; }); }}>No</Button>
                          </div>
                        </div>
                      );
                    }

                    if (isGender) {
                      const options = genderOptions || [];
                      const selected = Array.isArray(existing.value) ? existing.value : (existing.value ? [existing.value] : []);
                      return (
                        <div key={saveFieldId} className="flex flex-col gap-2">
                          <div className="text-sm font-medium">{f.label?.en || 'Gender'}</div>
                          <div className="flex gap-3 flex-wrap">
                            {options.map((opt: any) => (
                              <FormControlLabel key={opt.id} control={<Checkbox size="small" checked={selected.includes(opt.id)} onChange={(e) => {
                                const checked = e.target.checked;
                                setCustomFilters(prev => {
                                  const next = prev.filter((p: any) => p.fieldId !== saveFieldId);
                                  let vals = Array.isArray(existing.value) ? [...existing.value] : [];
                                  if (checked) vals = [...new Set([...vals, opt.id])]; else vals = vals.filter((v: any) => v !== opt.id);
                                  next.push({ fieldId: saveFieldId, labelEn: f.label?.en, labelAr: f.label?.ar, type: 'multi', value: vals, choices: options.map((o: any) => ({ en: o.title, id: o.id })) });
                                  return next;
                                });
                              }} />} label={<span className="text-sm">{opt.title}</span>} />
                            ))}
                          </div>
                        </div>
                      );
                    }

                    if (isBirthdate) {
                      const existingVal = existing.value ?? {};
                      const yearVal = existingVal?.year ?? '';
                      const modeVal = existingVal?.mode ?? 'after';
                      return (
                        <div key={saveFieldId} className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="sm:w-1/3 text-sm font-medium">{f.label?.en || 'Birth Date'}</div>
                          <div className="flex gap-2 items-center w-full">
                            <TextField
                              size="small"
                              type="number"
                              label="Year"
                              value={yearVal}
                              onChange={(e) => {
                                const nv = e.target.value;
                                const parsed = nv ? Number(nv) : '';
                                setCustomFilters(prev => {
                                  const next = prev.filter((p: any) => p.fieldId !== saveFieldId);
                                  if (nv) next.push({ fieldId: saveFieldId, labelEn: f.label?.en, labelAr: f.label?.ar, type: 'birthYear', value: { year: parsed, mode: modeVal } });
                                  return next;
                                });
                              }}
                            />
                            <Button variant={modeVal === 'after' ? 'contained' : 'outlined'} size="small" onClick={() => {
                              const newMode = 'after';
                              setCustomFilters(prev => {
                                const next = prev.filter((p: any) => p.fieldId !== saveFieldId);
                                if (yearVal) next.push({ fieldId: saveFieldId, labelEn: f.label?.en, labelAr: f.label?.ar, type: 'birthYear', value: { year: Number(yearVal), mode: newMode } });
                                return next;
                              });
                            }}>After</Button>
                            <Button variant={modeVal === 'before' ? 'contained' : 'outlined'} size="small" onClick={() => {
                              const newMode = 'before';
                              setCustomFilters(prev => {
                                const next = prev.filter((p: any) => p.fieldId !== saveFieldId);
                                if (yearVal) next.push({ fieldId: saveFieldId, labelEn: f.label?.en, labelAr: f.label?.ar, type: 'birthYear', value: { year: Number(yearVal), mode: newMode } });
                                return next;
                              });
                            }}>Before</Button>
                            <Button size="small" onClick={() => { setCustomFilters(prev => prev.filter((p: any) => p.fieldId !== saveFieldId)); }}>Clear</Button>
                          </div>
                        </div>
                      );
                    }

                    if (isSalaryField) {
                      const min = existing.value?.min ?? '';
                      const max = existing.value?.max ?? '';
                      return (
                        <div key={saveFieldId} className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="sm:w-1/3 text-sm font-medium">{f.label?.en || 'Salary'}</div>
                          <div className="flex gap-2 w-full">
                            <TextField fullWidth size="small" type="number" label="Min" value={min} onChange={(e) => {
                              const nv = e.target.value;
                              setCustomFilters(prev => { const next = prev.filter((p: any) => p.fieldId !== saveFieldId); next.push({ fieldId: saveFieldId, labelEn: f.label?.en, labelAr: f.label?.ar, type: 'range', value: { min: nv, max }, choices: f.choices }); return next; });
                            }} />
                            <TextField fullWidth size="small" type="number" label="Max" value={max} onChange={(e) => {
                              const nv = e.target.value;
                              setCustomFilters(prev => { const next = prev.filter((p: any) => p.fieldId !== saveFieldId); next.push({ fieldId: saveFieldId, labelEn: f.label?.en, labelAr: f.label?.ar, type: 'range', value: { min, max: nv }, choices: f.choices }); return next; });
                            }} />
                          </div>
                        </div>
                      );
                    }

                    // choices / select
                    if (Array.isArray(f.choices) && f.choices.length > 0) {
                      const seen = new Set<string>();
                      const choices = f.choices
                        .map((c: any) => ({ id: c.en || c.ar, title: `${c.en || ''}${c.ar ? ' / ' + c.ar : ''}` }))
                        .filter((ch: any) => {
                          const key = (ch.id || '').toString().trim().toLowerCase();
                          if (seen.has(key)) return false;
                          seen.add(key);
                          return true;
                        });
                      const sel = Array.isArray(existing.value) ? existing.value : [];
                      return (
                        <div key={saveFieldId} className="flex flex-col gap-2">
                          <div className="text-sm font-medium">{f.label?.en || ''}</div>
                          <div className="flex gap-3 flex-wrap">
                            {choices.map((ch: any) => (
                              <FormControlLabel key={ch.id} className="text-sm" control={<Checkbox size="small" checked={sel.includes(ch.id)} onChange={(e) => {
                                const checked = e.target.checked;
                                setCustomFilters(prev => {
                                  const next = prev.filter((p: any) => p.fieldId !== saveFieldId);
                                  let vals = Array.isArray(existing.value) ? [...existing.value] : [];
                                  if (checked) vals = [...new Set([...vals, ch.id])]; else vals = vals.filter((v: any) => v !== ch.id);
                                  next.push({ fieldId: saveFieldId, labelEn: f.label?.en, labelAr: f.label?.ar, type: 'multi', value: vals, choices: f.choices });
                                  return next;
                                });
                              }} />} label={<span className="text-sm">{ch.title}</span>} />
                            ))}
                          </div>
                        </div>
                      );
                    }

                    // default: text search
                      return (
                      <div key={saveFieldId} className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="sm:w-1/3 text-sm font-medium">{f.label?.en || f.label?.ar || ''}</div>
                        <TextField fullWidth size="small" label="Contains" value={existing.value || ''} onChange={(e) => {
                          const nv = e.target.value;
                          setCustomFilters(prev => {
                            const next = prev.filter((p: any) => p.fieldId !== saveFieldId);
                            if (nv) next.push({ fieldId: saveFieldId, labelEn: f.label?.en, labelAr: f.label?.ar, type: 'text', value: nv, choices: f.choices });
                            return next;
                          });
                        }} />
                      </div>
                    );
                  });
                })()
              )}
            </div>
            </div>
          </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            // clear modal selections and remove jobPositionId filter
            setCustomFilters([]);
            setModalSelectedJobIds([]);
            setColumnFilters(prev => {
              const next = Array.isArray(prev) ? prev.filter((p: any) => p.id !== 'jobPositionId') : prev;
              try {
                const raw = sessionStorage.getItem('applicants_table_state');
                const parsed = raw ? JSON.parse(raw) : {};
                parsed.columnFilters = next;
                parsed.customFilters = [];
                const str = JSON.stringify(parsed);
                sessionStorage.setItem('applicants_table_state', str);
                try { localStorage.setItem('applicants_table_state', str); } catch (e) { /* ignore */ }
              } catch (e) {
                // ignore
              }
              return next as any;
            });
            onClose();
          }}>Clear</Button>
          <Button onClick={() => {
            // Save custom filters and apply selected jobs as a column filter
            onClose();
            setColumnFilters(prev => {
              const base = Array.isArray(prev) ? prev.filter((p: any) => p.id !== 'jobPositionId') : [];
              const next = Array.isArray(base) ? [...base] : [];
              if (modalSelectedJobIds && modalSelectedJobIds.length > 0) {
                next.push({ id: 'jobPositionId', value: modalSelectedJobIds });
              }
              try {
                const raw = sessionStorage.getItem('applicants_table_state');
                const parsed = raw ? JSON.parse(raw) : {};
                parsed.columnFilters = next;
                // persist the customFilters alongside columnFilters so navigation/back restores them
                parsed.customFilters = customFilters || [];
                const str = JSON.stringify(parsed);
                sessionStorage.setItem('applicants_table_state', str);
                try { localStorage.setItem('applicants_table_state', str); } catch (e) { /* ignore */ }
              } catch (e) {
                // ignore
              }
              return next as any;
            });
          }} variant="contained" color="primary">Save</Button>
        </DialogActions>
        </Dialog>
        </>
  );
};

export default CustomFilterModal;
