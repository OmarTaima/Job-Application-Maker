// utils/filterHelpers.ts
import type { Applicant } from '../../../../../store/slices/applicantsSlice';

// Extend the Applicant type to include optional properties that might exist at runtime
interface ExtendedApplicant extends Applicant {
  birthdate?: string;
  dateOfBirth?: string;
  dob?: string;
  customResponses?: Record<string, any>;
  customFieldResponses?: Record<string, any>;
  workExperiences?: any[];
  experiences?: any[];
  resume?: string;
  cv?: string;
  attachments?: string;
  resumeUrl?: string;
  cvFilePath?: string;
  cvFile?: string;
  cvUrl?: string;
  resumeFilePath?: string;
  resumeFile?: string;
  cv_file_path?: string;
  cv_file?: string;
  cv_path?: string;
  [key: string]: any; // Index signature for dynamic properties
}

export interface CustomFilter {
  fieldId: string;
  value: any;
  type: string;
  label?: string;
  labelEn?: string;
  labelAr?: string;
  choices?: Array<{ id: string; title: string }>;
}

export interface FilterContext {
  jobPositionMap: Record<string, any>;
  fieldToJobIds: Map<string, Set<string>>;
  currentUserId: string;
}

// Type for option objects in multi-select
interface SelectOption {
  id?: string;
  _id?: string;
  en?: string;
  ar?: string;
  value?: string;
  label?: string;
  title?: string;
  name?: string;
}



// Extract string from option value


// Normalize strings for comparison (remove special characters, trim, lowercase)
export function normalizeForCompare(s: any): string {
  return (s || '')
    .toString()
    .replace(/\u200E|\u200F/g, '') // Remove Unicode control characters
    .trim()
    .toLowerCase();
}

// Expand string forms (with spaces vs underscores)
export function expandForms(s: string): string[] {
  const out = new Set<string>();
  if (!s) return [];
  out.add(s);
  out.add(s.replace(/\s+/g, '_'));
  out.add(s.replace(/_/g, ' '));
  return Array.from(out);
}

// Normalize gender values (English and Arabic)
export function normalizeGender(raw: any): string {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  const arabicMale = ['ذكر', 'ذكرً', 'ذَكر'];
  const arabicFemale = ['انثى', 'أنثى', 'انثي', 'انسه', 'أنسه', 'انثا'];
  
  if (arabicMale.includes(s) || arabicMale.includes(lower)) return 'Male';
  if (arabicFemale.includes(s) || arabicFemale.includes(lower)) return 'Female';
  if (lower === 'male' || lower === 'm') return 'Male';
  if (lower === 'female' || lower === 'f') return 'Female';
  
  // Fallback: title-case the original
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Extract response items from various data structures
export function extractResponseItems(raw: any): string[] {
  if (raw === null || raw === undefined) return [];
  
  const pickFromObject = (o: any): string => {
    if (o === null || o === undefined) return '';
    if (typeof o === 'number') return String(o);
    if (typeof o === 'string') return o;
    // Common object shapes
    const obj = o as Record<string, any>;
    return String(
      obj.id ??
        obj._id ??
        obj.value ??
        obj.val ??
        obj.en ??
        obj.ar ??
        obj.label ??
        obj.name ??
        ''
    );
  };

  if (Array.isArray(raw)) {
    return raw.map(pickFromObject).filter(s => s !== '');
  }
  
  if (typeof raw === 'object') {
    const candidates: string[] = [];
    const prim = pickFromObject(raw);
    if (prim) candidates.push(prim);
    
    // Include any primitive child values
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
    
    return Array.from(new Set(candidates)).filter(s => s !== '');
  }

  return [String(raw)];
}

// Get custom response value from applicant for a given filter
export function getCustomResponseValue(applicant: ExtendedApplicant | null | undefined, filter: CustomFilter): any {
  if (!applicant) return '';
  
  const responses = applicant.customResponses || applicant.customFieldResponses || {};
  const top = applicant || {};

  const tryKey = (k: any) => {
    if (k === undefined || k === null) return undefined;
    if (typeof k !== 'string' && typeof k !== 'number') return undefined;
    const key = String(k);
    if (responses && Object.prototype.hasOwnProperty.call(responses, key)) {
      return responses[key];
    }
    if (top && Object.prototype.hasOwnProperty.call(top, key)) {
      return top[key];
    }
    return undefined;
  };

  // Try exact fieldId
  const byId = tryKey(filter.fieldId);
  if (byId !== undefined) return byId;

  // Try explicit labels
  const byEn = tryKey(filter.labelEn);
  if (byEn !== undefined) return byEn;
  const byAr = tryKey(filter.labelAr);
  if (byAr !== undefined) return byAr;
  const byLabel = tryKey(filter.label);
  if (byLabel !== undefined) return byLabel;

  // Try normalized matching
  const norm = (s: any) => normalizeForCompare(s);
  const rawTargets = [filter.labelEn, filter.labelAr, filter.fieldId].filter(Boolean);
  const targetSet = new Set<string>();
  rawTargets.map(norm).forEach(t => {
    if (!t) return;
    targetSet.add(t);
    targetSet.add(t.replace(/\s+/g, '_'));
    targetSet.add(t.replace(/_/g, ' '));
  });

  // Search responses map and top-level fields
  for (const [k, v] of Object.entries({ ...responses, ...top })) {
    const nk = norm(k);
    if (targetSet.has(nk)) return v;
    if (targetSet.has(nk.replace(/\s+/g, '_'))) return v;
    if (targetSet.has(nk.replace(/_/g, ' '))) return v;
  }

  return '';
}

// Parse numeric value from various formats (including Arabic digits)
export function parseNumericValue(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const normalizeDigits = (input: string) => {
    const map: Record<string, string> = {
      '\u0660': '0', '\u0661': '1', '\u0662': '2', '\u0663': '3', '\u0664': '4',
      '\u0665': '5', '\u0666': '6', '\u0667': '7', '\u0668': '8', '\u0669': '9',
      '\u06F0': '0', '\u06F1': '1', '\u06F2': '2', '\u06F3': '3', '\u06F4': '4',
      '\u06F5': '5', '\u06F6': '6', '\u06F7': '7', '\u06F8': '8', '\u06F9': '9',
    };
    return input.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => map[ch] || ch);
  };

  const text = normalizeDigits(String(value));
  const matches = text.match(/-?\d+(?:[.,]\d+)?/g);
  if (!matches?.length) return null;

  const nums = matches
    .map(m => Number(m.replace(/,/g, '')))
    .filter(n => Number.isFinite(n));
  if (!nums.length) return null;
  
  return Math.max(...nums);
}

// Check if an applicant has a CV
export function hasCV(applicant: ExtendedApplicant | null | undefined): boolean {
  if (!applicant) return false;
  
  const hasTop = Boolean(
    applicant?.resume ||
    applicant?.cv ||
    applicant?.attachments ||
    applicant?.resumeUrl ||
    applicant?.cvFilePath ||
    applicant?.cvFile ||
    applicant?.cvUrl ||
    applicant?.resumeFilePath ||
    applicant?.resumeFile ||
    applicant?.cv_file_path ||
    applicant?.cv_file ||
    applicant?.cv_path
  );
  
  if (hasTop) return true;
  
  try {
    const resp = applicant?.customResponses || applicant?.customFieldResponses || {};
    for (const [k, v] of Object.entries(resp || {})) {
      const lk = String(k || '').toLowerCase();
      if ((lk.includes('cv') || lk.includes('resume') || lk.includes('cvfile') || 
           lk.includes('cv_file') || lk.includes('cvfilepath')) && v) {
        return true;
      }
      if (typeof v === 'string' && /https?:\/\/.+\.(pdf|docx?|rtf|txt|zip)$/i.test(v)) {
        return true;
      }
    }
  } catch (e) {
    // ignore
  }
  
  return false;
}

// Check if applicant has work experience
export function hasWorkExperience(applicant: ExtendedApplicant | null | undefined): boolean {
  if (!applicant) return false;
  
  if (Array.isArray(applicant.workExperiences) && applicant.workExperiences.length) return true;
  if (Array.isArray(applicant.experiences) && applicant.experiences.length) return true;
  
  const resp = applicant?.customResponses || applicant?.customFieldResponses || {};
  const keys = ['work_experience', 'workExperience', 'workexperience', 'الخبرة', 'خبرة'];
  
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(resp, k)) {
      const v = resp[k];
      if (v === true) return true;
      if (Array.isArray(v) && v.length) return true;
      if (typeof v === 'string' && v.trim()) return true;
      if (typeof v === 'object' && Object.keys(v).length) return true;
    }
  }
  
  for (const v of Object.values(resp)) {
    if (Array.isArray(v) && v.length) return true;
  }
  
  return false;
}

// Extract year from date string (handles Arabic digits)
export function extractYear(dateValue: any): number | null {
  if (dateValue === null || dateValue === undefined) return null;
  if (typeof dateValue === 'number') {
    const n = Math.floor(dateValue);
    if (n > 1900 && n < 2100) return n;
    return null;
  }
  
  const normalizeDigits = (input: string) => {
    const map: Record<string, string> = {
      '\u0660': '0', '\u0661': '1', '\u0662': '2', '\u0663': '3', '\u0664': '4',
      '\u0665': '5', '\u0666': '6', '\u0667': '7', '\u0668': '8', '\u0669': '9',
      '\u06F0': '0', '\u06F1': '1', '\u06F2': '2', '\u06F3': '3', '\u06F4': '4',
      '\u06F5': '5', '\u06F6': '6', '\u06F7': '7', '\u06F8': '8', '\u06F9': '9',
    };
    return input.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => map[ch] || ch);
  };
  
  let s = String(dateValue).trim();
  if (!s) return null;
  s = normalizeDigits(s);
  
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.getFullYear();
  } catch { /* ignore */ }
  
  const m = s.match(/(19|20)\d{2}/);
  if (m) return Number(m[0]);
  
  return null;
}

// Filter function for range values (salary, etc.)
export function evaluateRangeFilter(value: any, filterValue: { min?: number; max?: number }): boolean {
  if (filterValue === undefined || filterValue === null) return true;
  
  const num = parseNumericValue(value);
  if (num === null) return false;
  
  const minFilter = filterValue.min !== undefined ? filterValue.min : undefined;
  const maxFilter = filterValue.max !== undefined ? filterValue.max : undefined;
  
  if (minFilter !== undefined && num < minFilter) return false;
  if (maxFilter !== undefined && num > maxFilter) return false;
  
  return true;
}

// Filter function for multi-select values
export function evaluateMultiFilter(value: any, selectedValues: any[]): boolean {
  if (!selectedValues || selectedValues.length === 0) return true;
  
  // Properly type and normalize selected values
  const valsNormalized: string[] = selectedValues
    .map((v: any) => {
      // Handle different possible value types
      if (v === null || v === undefined) return '';
      if (typeof v === 'string') return normalizeForCompare(v);
      if (typeof v === 'number') return normalizeForCompare(String(v));
      if (typeof v === 'boolean') return normalizeForCompare(String(v));
      if (typeof v === 'object') {
        // Extract the relevant property from the object
        const obj = v as SelectOption;
        const extracted = obj.id ?? obj._id ?? obj.en ?? obj.ar ?? obj.value ?? obj.label ?? obj.title ?? obj.name ?? '';
        return normalizeForCompare(String(extracted));
      }
      return normalizeForCompare(String(v));
    })
    .filter((x: string): x is string => Boolean(x));
  
  if (!valsNormalized.length) return true;
  
  const valsExpandedSet = new Set<string>();
  valsNormalized.forEach(v => expandForms(v).forEach(x => valsExpandedSet.add(x)));
  
  const rawItems = extractResponseItems(value).map(normalizeForCompare);
  
  // Direct match
  let matched = rawItems.some(item => valsExpandedSet.has(item));
  
  // Check for boolean/object structures
  if (!matched && typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      if (v === true || v === 'true' || v === 1 || v === '1') {
        const nk = normalizeForCompare(k);
        if (nk && valsExpandedSet.has(nk)) {
          matched = true;
          break;
        }
      }
    }
  }
  
  return matched;
}

// Filter function for text contains
export function evaluateTextFilter(value: any, searchText: string): boolean {
  if (!searchText) return true;
  
  const needle = normalizeForCompare(searchText);
  if (!needle) return true;
  
  const rawItems = extractResponseItems(value).map(normalizeForCompare);
  return rawItems.some(item => item.includes(needle));
}

// Filter function for birth year (before/after)
export function evaluateBirthYearFilter(value: any, filterValue: { year: number; mode: 'before' | 'after' }): boolean {
  if (!filterValue?.year) return true;
  
  const year = extractYear(value);
  if (!year) return false;
  
  if (filterValue.mode === 'before') {
    return year < filterValue.year;
  }
  return year > filterValue.year;
}

// Main function to apply all custom filters to applicants
export function applyCustomFilters(
  applicants: Applicant[],
  customFilters: CustomFilter[],
  _context: FilterContext // Prefixed with underscore to indicate it's intentionally unused
): Applicant[] {
  if (!customFilters.length) return applicants;
  
  // Separate duplicates filter from others
  const effectiveCustomFilters = customFilters.filter(
    (f: CustomFilter) => f?.fieldId !== '__duplicates_only'
  );
  
  if (!effectiveCustomFilters.length) return applicants;
  
  return (applicants as ExtendedApplicant[]).filter(applicant => {
    try {
      for (const filter of effectiveCustomFilters) {
        let raw = getCustomResponseValue(applicant, filter);
        
        // Override for hardcoded personal-info filters
        if (filter.fieldId === '__gender') {
          raw = applicant?.gender ||
            applicant?.customResponses?.gender ||
            applicant?.customResponses?.['النوع'] ||
            (applicant as any)['النوع'] ||
            raw || '';
        }
        
        if (filter.fieldId === '__birthdate') {
          raw = (applicant as ExtendedApplicant)?.birthdate ||
            (applicant as ExtendedApplicant)?.dateOfBirth ||
            (applicant as ExtendedApplicant)?.dob ||
            applicant?.customResponses?.birthdate ||
            applicant?.customResponses?.['تarih'] ||
            applicant?.customResponses?.['تاريخ الميلاد'] ||
            raw || '';
        }
        
        if (filter.fieldId === '__has_cv') {
          raw = hasCV(applicant);
        }
        
        // Boolean presence filters
        if (filter.type === 'hasWorkExperience' || filter.type === 'hasField' || 
            filter.type === 'hasCV' || filter.fieldId === '__has_cv') {
          const want = filter.value;
          if (want === 'any' || want === undefined) continue;
          
          const evaluateHas = () => {
            if (filter.type === 'hasWorkExperience') {
              return hasWorkExperience(applicant);
            }
            if (filter.fieldId === '__has_cv' || filter.type === 'hasCV') {
              return hasCV(applicant);
            }
            const rawVal = getCustomResponseValue(applicant, filter);
            if (rawVal === undefined || rawVal === null) return false;
            if (rawVal === '') return false;
            if (Array.isArray(rawVal)) return rawVal.length > 0;
            if (typeof rawVal === 'object') return Object.keys(rawVal).length > 0;
            if (typeof rawVal === 'string') return rawVal.trim().length > 0;
            if (typeof rawVal === 'number') return true;
            if (typeof rawVal === 'boolean') return rawVal === true;
            return false;
          };
          
          const hasIt = evaluateHas();
          if ((want === true && !hasIt) || (want === false && hasIt)) {
            return false;
          }
          continue;
        }
        
        // Range filter
        if (filter.type === 'range') {
          if (!evaluateRangeFilter(raw, filter.value)) return false;
          continue;
        }
        
        // Multi-select filter
        if (filter.type === 'multi') {
          if (!evaluateMultiFilter(raw, filter.value)) return false;
          continue;
        }
        
        // Text filter
        if (filter.type === 'text') {
          if (!evaluateTextFilter(raw, filter.value)) return false;
          continue;
        }
        
        // Birth year filter
        if (filter.type === 'birthYear') {
          if (!evaluateBirthYearFilter(raw, filter.value)) return false;
          continue;
        }
        
        // Date equality filter
        if (filter.type === 'date') {
          const target = filter.value;
          if (target) {
            const rawItems = extractResponseItems(raw);
            const matchFound = rawItems.some(r => {
              try {
                const d = new Date(String(r));
                if (isNaN(d.getTime())) return false;
                const iso = d.toISOString().slice(0, 10);
                return iso === String(target);
              } catch {
                return false;
              }
            });
            if (!matchFound) return false;
          }
          continue;
        }
      }
      return true;
    } catch (e) {
      return false;
    }
  }) as Applicant[];
}

// Filter applicants by status with trashed visibility rules
export function filterByStatus(
  applicants: Applicant[],
  statusFilter: string | string[] | undefined,
  isSuperAdmin: boolean
): Applicant[] {
  if (statusFilter === undefined || statusFilter === null) {
    // No status filter - hide trashed for non-super-admins
    if (!isSuperAdmin) {
      return applicants.filter(a => a.status !== 'trashed');
    }
    return applicants;
  }
  
  const allowed = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
  
  // Super admin can see trashed when explicitly filtered
  if (isSuperAdmin) {
    return applicants.filter(a => allowed.includes(a.status));
  }
  
  // Non-super-admin: never show trashed
  const allowedWithoutTrashed = allowed.filter(s => s !== 'trashed');
  if (allowedWithoutTrashed.length === 0) {
    return applicants.filter(a => a.status !== 'trashed');
  }
  return applicants.filter(a => allowedWithoutTrashed.includes(a.status) && a.status !== 'trashed');
}

// Get company ID from applicant (with fallback to job position)
export function getApplicantCompanyId(applicant: any, jobPositionMap: Record<string, any>): string | undefined {
  const rawCompany = applicant?.companyId || applicant?.company || applicant?.companyObj;
  if (rawCompany) {
    if (typeof rawCompany === 'string' || typeof rawCompany === 'number') {
      return String(rawCompany);
    }
    // Handle case where company might be an object with _id or id
    const companyObj = rawCompany as Record<string, any>;
    const id = companyObj._id ?? companyObj.id;
    return id ? String(id) : undefined;
  }
  
  const rawJob = applicant?.jobPositionId;
  const jobId = typeof rawJob === 'string'
    ? rawJob
    : (rawJob?._id ?? rawJob?.id ?? '');
  const job = jobPositionMap[jobId];
  const jobCompany = job?.companyId || job?.company || job?.companyObj;
  
  if (!jobCompany) return undefined;
  if (typeof jobCompany === 'string' || typeof jobCompany === 'number') {
    return String(jobCompany);
  }
  const companyObj = jobCompany as Record<string, any>;
  const id = companyObj._id ?? companyObj.id;
  return id ? String(id) : undefined;
}

// Check if two applicants are potential duplicates
export function arePotentialDuplicates(
  applicant1: any,
  applicant2: any,
  threshold: number = 0.7
): boolean {
  // Compare by email
  const email1 = applicant1?.email?.trim().toLowerCase();
  const email2 = applicant2?.email?.trim().toLowerCase();
  if (email1 && email2 && email1 === email2) return true;
  
  // Compare by phone
  const phone1 = applicant1?.phone?.trim().replace(/[^0-9+]/g, '');
  const phone2 = applicant2?.phone?.trim().replace(/[^0-9+]/g, '');
  if (phone1 && phone2 && phone1 === phone2) return true;
  
  // Compare by name similarity
  const name1 = applicant1?.fullName?.trim().toLowerCase();
  const name2 = applicant2?.fullName?.trim().toLowerCase();
  if (name1 && name2) {
    // Simple similarity check
    if (name1 === name2) return true;
    
    // Check if one contains the other
    if (name1.includes(name2) || name2.includes(name1)) return true;
    
    // Calculate similarity ratio
    const longer = name1.length > name2.length ? name1 : name2;
    const shorter = name1.length > name2.length ? name2 : name1;
    const distance = levenshteinDistance(longer, shorter);
    const similarity = (longer.length - distance) / longer.length;
    if (similarity >= threshold) return true;
  }
  
  return false;
}

// Levenshtein distance for name similarity
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  return matrix[b.length][a.length];
}

export default {
  normalizeForCompare,
  expandForms,
  normalizeGender,
  extractResponseItems,
  getCustomResponseValue,
  parseNumericValue,
  hasCV,
  hasWorkExperience,
  extractYear,
  evaluateRangeFilter,
  evaluateMultiFilter,
  evaluateTextFilter,
  evaluateBirthYearFilter,
  applyCustomFilters,
  filterByStatus,
  getApplicantCompanyId,
  arePotentialDuplicates,
};