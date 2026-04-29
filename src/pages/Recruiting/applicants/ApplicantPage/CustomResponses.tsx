import { useState } from 'react';

type Props = {
  applicant: any;
  customFields?: any[];
};

const isArabic = (text?: any) => {
  if (!text || typeof text !== 'string') return false;
  return /[\u0600-\u06FF]/.test(text);
};

const formatLabel = (key: string) => {
  if (!key) return '';
  const mapping: Record<string, string> = {
    birthdate: 'Birth Date',
    birth_date: 'Birth Date',
    birthDate: 'Birth Date',
    work_experience: 'Work Experience',
    workExperience: 'Work Experience',
    courses_certifications: 'Courses & Certifications',
    coursesCertifications: 'Courses & Certifications',
    education_level: 'Education Level',
    educationLevel: 'Education Level',
    expected_salary: 'Expected Salary',
    expectedSalary: 'Expected Salary',
    military_status: 'Military Status',
    militaryStatus: 'Military Status',
    personal_skills: 'Personal Skills',
    personalSkills: 'Personal Skills',
    gender: 'Gender',
  };

  if (mapping[key]) return mapping[key];
  const normalized = key.replace(/\s|_|-/g, '').toLowerCase();
  if (mapping[normalized]) return mapping[normalized];

  // If key contains Arabic letters, preserve Arabic with spaces
  if (/[\u0600-\u06FF]/.test(key)) {
    return key.replace(/[_-]+/g, ' ');
  }

  // Insert spaces for camelCase and underscores then title-case for Latin keys
  let s = key.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  s = s.replace(/\b\w/g, (c) => c.toUpperCase());
  return s;
};

const toPlainString = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    if (typeof value.en === 'string') return value.en;
    if (typeof value.ar === 'string') return value.ar;
    if (typeof value.value === 'string') return value.value;
  }
  return String(value);
};

const normalizeLookupToken = (value: any): string => {
  return String(value || '')
    .toLowerCase()
    .replace(/\u200e|\u200f/g, '')
    .replace(/[^\w\u0600-\u06FF\s]/g, ' ')
    .replace(/[\s_-]+/g, ' ')
    .trim();
};

const getCustomFieldLabel = (field: any): string => {
  return toPlainString(field?.label) || field?.fieldId || 'Custom Field';
};

const findMatchingResponseKeyForField = (
  field: any,
  responses: Record<string, any>
): string => {
  if (!responses || typeof responses !== 'object') return '';

  const fieldId = String(field?.fieldId || '');
  if (fieldId && Object.prototype.hasOwnProperty.call(responses, fieldId)) {
    return fieldId;
  }

  const directCandidates = [field?.label?.en, field?.label?.ar, toPlainString(field?.label)]
    .filter(Boolean)
    .map((v) => String(v));

  for (const candidate of directCandidates) {
    if (Object.prototype.hasOwnProperty.call(responses, candidate)) {
      return candidate;
    }
  }

  const normalizedTargets = new Set<string>();
  [fieldId, ...directCandidates]
    .filter(Boolean)
    .forEach((token) => {
      const normalized = normalizeLookupToken(token);
      if (!normalized) return;
      normalizedTargets.add(normalized);
      normalizedTargets.add(normalized.replace(/^rec/, ''));
      normalizedTargets.add(normalized.replace(/^sav/, ''));
    });

  for (const key of Object.keys(responses || {})) {
    const normalizedKey = normalizeLookupToken(key);
    if (!normalizedKey) continue;
    if (normalizedTargets.has(normalizedKey)) return key;

    for (const target of normalizedTargets) {
      if (!target) continue;
      if (normalizedKey.includes(target) || target.includes(normalizedKey)) {
        return key;
      }
    }
  }

  return '';
};

export default function CustomResponses({ applicant, customFields }: Props) {
  const [expandedResponses, setExpandedResponses] = useState<Record<string, Set<number>>>({});
  const [expandedText, setExpandedText] = useState<Record<string, boolean>>({});
  const [expandedItemFields, setExpandedItemFields] = useState<Record<string, Record<number, Set<string>>>>({});

  const rawResponses: Record<string, any> =
    applicant?.customResponses && typeof applicant.customResponses === 'object'
      ? applicant.customResponses
      : applicant?.customFieldResponses && typeof applicant.customFieldResponses === 'object'
      ? applicant.customFieldResponses
      : {};

  const customResponseEntries: Array<{ key: string; label: string; value: any }> = (() => {
    const entries: Array<{ key: string; label: string; value: any }> = [];
    const usedKeys = new Set<string>();

    if (Array.isArray(customFields) && customFields.length > 0) {
      const orderedFields = [...customFields].sort((a: any, b: any) => {
        const ao = Number(a?.displayOrder ?? a?.order ?? 0);
        const bo = Number(b?.displayOrder ?? b?.order ?? 0);
        return ao - bo;
      });

      orderedFields.forEach((field: any, index: number) => {
        const fieldId = String(field?.fieldId || `field_${index}`);
        const matchedKey = findMatchingResponseKeyForField(field, rawResponses);
        const sourceKey =
          matchedKey && Object.prototype.hasOwnProperty.call(rawResponses, matchedKey)
            ? matchedKey
            : fieldId;
        const value = rawResponses[sourceKey];

        if (matchedKey) usedKeys.add(matchedKey);
        if (Object.prototype.hasOwnProperty.call(rawResponses, fieldId)) usedKeys.add(fieldId);

        entries.push({
          key: fieldId,
          label: getCustomFieldLabel(field),
          value,
        });
      });
    }

    Object.entries(rawResponses).forEach(([key, value]) => {
      if (usedKeys.has(key)) return;
      entries.push({
        key,
        label: formatLabel(key),
        value,
      });
    });

    return entries;
  })();

  if (customResponseEntries.length === 0) return null;

  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 border-2 border-blue-200 dark:border-blue-900/50 shadow-lg">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 px-8 py-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-white">Application Responses</h3>
            <p className="text-sm text-blue-100 mt-0.5">Custom field responses and additional information</p>
          </div>
        </div>
      </div>
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        {customResponseEntries.map(({ key, label, value }) => {
          try {
            const norm = (k: string) => (k || '').toString().replace(/\s|_|-/g, '').toLowerCase();
            const isExpectedKey = ['expectedsalary', 'expected_salary', 'expected salary', 'expectedsalary', 'expected_salary', 'expected_salary', 'expected', 'الراتبالمتوقع', 'الراتب_المتوقع', 'راتب'].includes(norm(key));
            if (isExpectedKey && (applicant && (applicant.expectedSalary !== undefined && applicant.expectedSalary !== null && String(applicant.expectedSalary) !== ''))) {
              return null;
            }
          } catch (e) {
            // ignore
          }

          const toggleExpand = (index: number) => {
            setExpandedResponses((prev) => {
              const newState = { ...prev };
              if (!newState[key]) newState[key] = new Set();
              const currentSet = new Set(newState[key]);
              if (currentSet.has(index)) currentSet.delete(index);
              else currentSet.add(index);
              newState[key] = currentSet;
              return newState;
            });
          };

          const renderValue = () => {
            if (value === undefined || value === null) return '-';

            // try to parse stringified JSON
            let v: any = value;
            if (typeof v === 'string') {
              const t = v.trim();
              if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
                try {
                  v = JSON.parse(t);
                } catch (e) {
                  // ignore
                }
              }
            }

            const formatValueNode = (val: any): { node: any; text: string } => {
              let vv = val;
              if (typeof vv === 'string') {
                const tt = vv.trim();
                if ((tt.startsWith('{') && tt.endsWith('}')) || (tt.startsWith('[') && tt.endsWith(']'))) {
                  try {
                    vv = JSON.parse(tt);
                  } catch (e) {
                    // ignore
                  }
                }
              }

              if (typeof vv === 'boolean') return { node: vv ? 'Yes' : 'No', text: vv ? 'Yes' : 'No' };
              if (vv === null || vv === undefined) return { node: '-', text: '-' };
              if (Array.isArray(vv)) {
                const txt = vv.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ');
                return { node: txt, text: txt };
              }
              if (typeof vv === 'object') {
                const candidate = vv.answer ?? vv.value ?? vv.en ?? vv.ar ?? null;
                if (candidate !== null && (typeof candidate === 'string' || typeof candidate === 'number' || typeof candidate === 'boolean')) {
                  const txt = String(candidate);
                  if (/^https?:\/\//i.test(txt) || String(vv.type || '').toLowerCase() === 'url') {
                    const href = /^https?:\/\//i.test(txt) ? txt : `http://${txt}`;
                    return { node: (<a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline break-words">{txt}</a>), text: txt };
                  }
                  return { node: txt, text: txt };
                }
                // find primitive property as fallback summary
                for (const [, val] of Object.entries(vv)) {
                  if (val === null || val === undefined) continue;
                  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
                    const txt = String(val);
                    return { node: txt, text: txt };
                  }
                }
                try {
                  const txt = JSON.stringify(vv, null, 2);
                  return { node: <pre className="whitespace-pre-wrap">{txt}</pre>, text: txt };
                } catch (e) {
                  const txt = String(vv);
                  return { node: txt, text: txt };
                }
              }

              const txt = String(vv);
              if (/^https?:\/\//i.test(txt)) return { node: (<a href={txt} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline break-words">{txt}</a>), text: txt };
              return { node: txt, text: txt };
            };

            // arrays
            if (Array.isArray(v)) {
              if (v.length === 0) return '-';
              if (v.length > 0 && typeof v[0] === 'object' && v[0] !== null) {
                return (
                  <div className="flex flex-wrap gap-2">
                    {v.map((item: any, idx: number) => {
                      const isExpanded = expandedResponses[key]?.has(idx) || false;

                      const firstKey = Object.keys(item)[0];
                      const firstVal = item[firstKey];
                      const summaryCandidate = firstVal ?? Object.values(item).find((vv: any) => typeof vv === 'string' || typeof vv === 'number') ?? `Item ${idx + 1}`;
                      const summaryText = String((summaryCandidate && (summaryCandidate.answer ?? summaryCandidate.value ?? summaryCandidate.en ?? summaryCandidate.ar ?? summaryCandidate)));
                      const summaryIsArabic = isArabic(summaryText);
                      const displaySummary = summaryIsArabic
                        ? (summaryText.length > 30 ? '...' + summaryText.slice(-30) : summaryText)
                        : (summaryText.length > 30 ? summaryText.substring(0, 30) + '...' : summaryText);

                      return (
                        <div key={idx} className="w-full">
                          <button
                            onClick={() => toggleExpand(idx)}
                            className={
                              (() => {
                                const normalizedKey = key.replace(/\s|_/g, '').toLowerCase();
                                const isGrayTag = ['workexperience', 'certifications'].includes(normalizedKey);
                                return `inline-flex items-center justify-between w-full gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition ${isGrayTag ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800/30 dark:text-gray-300 dark:hover:bg-gray-800/50' : 'bg-brand-100 text-brand-700 hover:bg-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50'}`;
                              })()
                            }
                          >
                            <span dir={summaryIsArabic ? 'rtl' : undefined} className={`${summaryIsArabic ? 'text-right w-full' : ''} font-cairo`}>
                              {displaySummary}
                            </span>
                            <svg
                              className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {isExpanded && (
                            <div className="mt-3">
                              <div className="mb-3 flex flex-wrap items-center gap-2"></div>
                              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                {(() => {
                                  const entries = Object.entries(item).filter(([_, vv]) => {
                                    if (vv === null || vv === undefined) return false;
                                    const s = typeof vv === 'string' ? vv : String(vv);
                                    return s.trim() !== "";
                                  });

                                  return (
                                    <div className="space-y-3">
                                      {entries.map(([itemKey, itemValue]) => {
                                        const label = formatLabel(itemKey);
                                        const { node: displayNode, text: displayText } = formatValueNode(itemValue);
                                        const valueIsArabic = typeof displayText === 'string' && isArabic(displayText);
                                        const rowIsArabic = valueIsArabic || isArabic(label);

                                        const isFieldExpanded = (expandedItemFields[key] && expandedItemFields[key][idx] && expandedItemFields[key][idx].has(itemKey)) || false;
                                        const needsTruncate = typeof displayText === 'string' && displayText.length > 20;

                                        const toggleField = (fieldName: string) => {
                                          setExpandedItemFields((prev) => {
                                            const newState = { ...prev };
                                            if (!newState[key]) newState[key] = {};
                                            if (!newState[key][idx]) newState[key][idx] = new Set<string>();
                                            if (newState[key][idx].has(fieldName)) {
                                              newState[key][idx].delete(fieldName);
                                            } else {
                                              newState[key][idx].add(fieldName);
                                            }
                                            return { ...newState };
                                          });
                                        };

                                        return (
                                          <div
                                            key={itemKey}
                                            className="rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 transition hover:bg-white hover:shadow-sm"
                                          >
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-6">
                                              <div
                                                className={`text-[10px] font-bold uppercase tracking-widest text-gray-400 shrink-0 sm:pt-1 min-w-[150px] text-left`}
                                              >
                                                <span className="opacity-80">{label} :</span>
                                              </div>

                                              <div
                                                dir={rowIsArabic ? 'rtl' : 'ltr'}
                                                className={`text-sm font-semibold text-gray-800 whitespace-pre-wrap wrap-break-word leading-relaxed flex-1 ${rowIsArabic ? 'text-right' : 'text-left'}`}
                                              >
                                                {needsTruncate && !isFieldExpanded ? (
                                                  <span className="inline-flex items-center gap-1">
                                                    <span>{displayText.slice(0, 40)}</span>
                                                    <button
                                                      type="button"
                                                      onClick={() => toggleField(itemKey)}
                                                      className="text-brand-600 hover:text-brand-700 font-bold px-1 transition-colors"
                                                      aria-label={`Expand ${label}`}
                                                    >
                                                      ...
                                                    </button>
                                                  </span>
                                                ) : (
                                                  <span>{displayNode}</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }

              const joined = v.join(', ');
              if (!joined.trim()) return '-';
              if (v.some((vv: any) => isArabic(String(vv)))) {
                return (
                  <div dir="rtl" className="text-right text-gray-900 dark:text-white">
                    {joined}
                  </div>
                );
              }
              return joined;
            }

            if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
              const candidate = v.answer ?? v.value ?? v.en ?? v.ar ?? null;
              if (candidate !== null && (typeof candidate === 'string' || typeof candidate === 'number' || typeof candidate === 'boolean')) {
                const txt = String(candidate);
                if (/^https?:\/\//i.test(txt) || String(v.type || '').toLowerCase() === 'url') {
                  const href = /^https?:\/\//i.test(txt) ? txt : `http://${txt}`;
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline break-words">
                      {txt}
                    </a>
                  );
                }
                return String(txt);
              }
              if (typeof v.en === 'string' || typeof v.ar === 'string') return toPlainString(v);
              try {
                return JSON.stringify(v, null, 2);
              } catch (e) {
                return String(v);
              }
            }

            if (typeof v === 'string') {
              if (!v.trim()) return '-';
              const containsNewline = v.includes('\n');
              if (isArabic(v)) {
                return (
                  <div dir="rtl" className="text-right text-gray-900 dark:text-white">
                    {containsNewline ? (
                      <div className="whitespace-pre-wrap">{v}</div>
                    ) : (
                      v
                    )}
                  </div>
                );
              }
              if (containsNewline) {
                return (
                  <div className="whitespace-pre-wrap text-gray-900 dark:text-white">
                    {v}
                  </div>
                );
              }
              const trimmed = v.trim();
              if (/^https?:\/\//i.test(trimmed)) {
                return (
                  <a href={trimmed} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline break-words">
                    {trimmed}
                  </a>
                );
              }
              return String(v);
            }

            const asString = String(v);
            return asString.trim() ? asString : '-';
          };

          const valueIsArabicOverall = (() => {
            if (Array.isArray(value)) {
              if (value.length === 0) return false;
              return value.some((v: any) => {
                if (typeof v === 'string') return isArabic(String(v));
                if (typeof v === 'object' && v !== null) {
                  return Object.values(v).some((x) => typeof x === 'string' && isArabic(x));
                }
                return false;
              });
            }
            if (typeof value === 'string') return isArabic(value);
            if (typeof value === 'object' && value !== null) {
              return Object.values(value).some((v) => typeof v === 'string' && isArabic(v));
            }
            return false;
          })();

          const normalizedKey = `${key} ${label}`.replace(/\s|_/g, '').toLowerCase();
          const isCoverText = typeof value === 'string' && /cover/.test(normalizedKey);

          return (
            <div key={key} className={`group self-start p-4 bg-white dark:bg-gray-800 rounded-xl hover:shadow-md transition-all duration-200 border-l-4 border-blue-500`}>
              <div className="flex items-start gap-4">
                <span className={`text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider whitespace-nowrap font-cairo`}>
                  {label}:
                </span>

                {isCoverText ? (
                  <button
                    type="button"
                    onClick={() => setExpandedText((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className="inline-flex items-center gap-2 px-2 py-1 text-xs font-medium rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                  >
                    {expandedText[key] ? 'Collapse' : 'Expand'}
                    <svg className={`w-3 h-3 text-blue-600 dark:text-blue-300 transition-transform ${expandedText[key] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                ) : (
                  <div className={`text-sm text-gray-900 dark:text-white leading-relaxed ${valueIsArabicOverall ? 'flex-none max-w-[60%] min-w-0 break-words text-right' : 'flex-1'}`}>
                    {renderValue()}
                  </div>
                )}
              </div>

              {isCoverText && expandedText[key] && (
                <div className={`mt-3 p-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 whitespace-pre-wrap ${valueIsArabicOverall ? 'text-right' : ''} max-h-40 overflow-auto`} dir={typeof value === 'string' && isArabic(value) ? 'rtl' : undefined}>
                  {value}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
