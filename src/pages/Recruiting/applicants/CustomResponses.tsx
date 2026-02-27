import { useState } from 'react';

type Props = { applicant: any };

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

export default function CustomResponses({ applicant }: Props) {
  const [expandedResponses, setExpandedResponses] = useState<Record<string, Set<number>>>({});
  const [expandedText, setExpandedText] = useState<Record<string, boolean>>({});
  const [expandedItemFields, setExpandedItemFields] = useState<Record<string, Record<number, Set<string>>>>({});

  if (!applicant?.customResponses || Object.keys(applicant.customResponses).length === 0) return null;

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
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-5">
        {Object.entries(applicant.customResponses).map(
          ([key, value]) => {
            // If backend now exposes expected salary as a top-level field, skip
            // rendering any customResponses entry that represents expected salary
            // to avoid duplicate display in Personal Information.
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
              setExpandedResponses(prev => {
                const newState = { ...prev };
                if (!newState[key]) {
                  newState[key] = new Set();
                }
                const currentSet = new Set(newState[key]);
                if (currentSet.has(index)) {
                  currentSet.delete(index);
                } else {
                  currentSet.add(index);
                }
                newState[key] = currentSet;
                return newState;
              });
            };

            const renderValue = () => {
              if (Array.isArray(value)) {
                if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
                  return (
                    <div className="flex flex-wrap gap-2">
                      {value.map((item: any, idx: number) => {
                        const isExpanded = expandedResponses[key]?.has(idx) || false;
                        const firstKey = Object.keys(item)[0];
                        const summary = item[firstKey] || `Item ${idx + 1}`;
                        const summaryText = String(summary);
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
                                    const entries = Object.entries(item).filter(([_, v]) => {
                                      if (v === null || v === undefined) return false;
                                      const s = typeof v === 'string' ? v : String(v);
                                      return s.trim() !== "";
                                    });

                                    const formatValue = (v: any) => {
                                      if (typeof v === "boolean") return v ? "Yes" : "No";
                                      if (v === null || v === undefined) return "-";
                                      if (Array.isArray(v)) return v.join(", ");
                                      if (typeof v === "object") return JSON.stringify(v, null, 2);
                                      return String(v);
                                    };

                                    return (
                                      <div className="space-y-3">
                                        {entries.map(([itemKey, itemValue]) => {
                                          const label = formatLabel(itemKey);

                                          const valueStr = formatValue(itemValue);
                                          const valueIsArabic =
                                            typeof valueStr === "string" && isArabic(valueStr);

                                          const rowIsArabic = valueIsArabic || isArabic(label);

                                          const isFieldExpanded = (expandedItemFields[key] && expandedItemFields[key][idx] && expandedItemFields[key][idx].has(itemKey)) || false;
                                          const needsTruncate = typeof valueStr === 'string' && valueStr.length > 20;

                                          const toggleField = (fieldName: string) => {
                                            setExpandedItemFields(prev => {
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
                                              dir={rowIsArabic ? 'rtl' : 'ltr'}
                                              className={`
                                                rounded-xl border border-gray-100 bg-gray-50 px-3 py-2
                                                dark:border-gray-700/60 dark:bg-gray-900/30
                                                transition
                                              `}
                                            >
                                              <div
                                                className={`
                                                  grid grid-cols-1 gap-1
                                                  ${rowIsArabic ? 'sm:grid-cols-[170px_1fr] sm:gap-4' : 'sm:grid-cols-[170px_1fr] sm:gap-4'}
                                                `}
                                              >
                                                <div
                                                  className={`
                                                    text-xs font-semibold mt-1 uppercase tracking-wide
                                                    text-gray-500 dark:text-gray-400
                                                    ${rowIsArabic ? "text-right" : "text-left"}
                                                  `}
                                                >
                                                  <span className="font-cairo">{label} :</span>
                                                </div>

                                                <div
                                                  className={`
                                                    text-sm font-medium -mr-15 text-gray-900 dark:text-white
                                                    whitespace-pre-wrap break-words leading-relaxed
                                                    ${rowIsArabic ? "text-right" : "text-left"}
                                                  `}
                                                >
                                                  {needsTruncate && !isFieldExpanded ? (
                                                    <span className="inline-flex items-center gap-2">
                                                      <span>{valueStr.slice(0, 20)}</span>
                                                      <button
                                                        type="button"
                                                        onClick={() => toggleField(itemKey)}
                                                        className="text-xs text-brand-600 hover:text-brand-700"
                                                        aria-label={`Expand ${label}`}
                                                      >
                                                        ⋯
                                                      </button>
                                                    </span>
                                                  ) : (
                                                    <span>
                                                      {valueStr}
                                                    </span>
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
                const joined = value.join(', ');
                if (value.some((v: any) => isArabic(String(v)))) {
                  return (
                    <div dir="rtl" className="text-right text-gray-900 dark:text-white">
                      {joined}
                    </div>
                  );
                }
                return joined;
              }
              if (typeof value === 'string') {
                const containsNewline = value.includes('\n');
                if (isArabic(value)) {
                  return (
                    <div dir="rtl" className="text-right text-gray-900 dark:text-white">
                      {containsNewline ? (
                        <div className="whitespace-pre-wrap">{value}</div>
                      ) : (
                        value
                      )}
                    </div>
                  );
                }
                if (containsNewline) {
                  return (
                    <div className="whitespace-pre-wrap text-gray-900 dark:text-white">
                      {value}
                    </div>
                  );
                }
                return String(value);
              }
              return String(value);
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

            const normalizedKey = key.replace(/\s|_/g, '').toLowerCase();
            const isCoverText = typeof value === 'string' && /cover/.test(normalizedKey);

            return (
              <div key={key} className={`group p-4 bg-white dark:bg-gray-800 rounded-xl hover:shadow-md transition-all duration-200 border-l-4 border-blue-500`}>
                <div className="flex items-center gap-4">
                  <span className={`text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider whitespace-nowrap font-cairo`}>
                    {key
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (c) => c.toUpperCase())}:
                  </span>

                  {isCoverText ? (
                    <button
                      type="button"
                      onClick={() => setExpandedText(prev => ({ ...prev, [key]: !prev[key] }))}
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
          }
        )}
      </div>
    </div>
  );
}
