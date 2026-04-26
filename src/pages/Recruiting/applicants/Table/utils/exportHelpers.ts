// utils/exportHelpers.ts
import * as XLSX from 'xlsx';
import Swal from '../../../../../utils/swal';
import type { Applicant } from '../../../../../store/slices/applicantsSlice';

export interface ExportOptions {
  includeCustomFields?: boolean;
  includeJobSpecs?: boolean;
  includeStatusHistory?: boolean;
  dateFormat?: 'locale' | 'iso' | 'custom';
  customDateFormatter?: (date: string) => string;
}

export interface ExportDataItem {
  [key: string]: any;
}

export interface ExportResult {
  success: boolean;
  message: string;
  fileName?: string;
  rowCount?: number;
  error?: string;
}

// Format custom response values for display in Excel
export function formatCustomResponseValue(value: any): string {
  if (value === null || value === undefined) return '';
  
  if (typeof value === 'string') {
    // Clean up HTML tags if present
    return value.replace(/<[^>]*>/g, '').trim();
  }
  
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    
    // Check if it's an array of objects
    if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
      return value.map((item, index) => {
        const formatted = Object.entries(item)
          .map(([key, val]) => {
            const displayKey = key.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            let displayVal = val;
            if (typeof val === 'object' && val !== null) {
              displayVal = JSON.stringify(val);
            } else if (typeof val === 'string') {
              displayVal = val;
            }
            return `${displayKey}: ${displayVal}`;
          })
          .join(', ');
        return `${index + 1}. { ${formatted} }`;
      }).join('; ');
    }
    // Simple array
    return value.join(', ');
  }
  
  if (typeof value === 'object' && value !== null) {
    try {
      const formatted = Object.entries(value)
        .map(([key, val]) => {
          const displayKey = key.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          let displayVal = val;
          if (typeof val === 'object' && val !== null) {
            displayVal = JSON.stringify(val);
          }
          return `${displayKey}: ${displayVal}`;
        })
        .join(', ');
      return `{ ${formatted} }`;
    } catch (e) {
      return JSON.stringify(value);
    }
  }
  
  return String(value);
}

// Normalize gender values for export
export function normalizeGenderForExport(raw: any): string {
  if (raw === null || raw === undefined) return '-';
  const s = String(raw).trim();
  if (!s) return '-';
  const lower = s.toLowerCase();
  const arabicMale = ['ذكر', 'ذكرً', 'ذَكر'];
  const arabicFemale = ['انثى', 'أنثى', 'انثي', 'انسه', 'أنسه', 'انثا'];
  
  if (arabicMale.includes(s) || arabicMale.includes(lower)) return 'Male';
  if (arabicFemale.includes(s) || arabicFemale.includes(lower)) return 'Female';
  if (lower === 'male' || lower === 'm') return 'Male';
  if (lower === 'female' || lower === 'f') return 'Female';
  
  // Return capitalized original
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Format date for export
export function formatDateForExport(
  dateString: string | undefined | null,
  options?: ExportOptions
): string {
  if (!dateString) return '-';
  
  if (options?.customDateFormatter) {
    return options.customDateFormatter(dateString);
  }
  
  if (options?.dateFormat === 'iso') {
    return dateString;
  }
  
  // Parse as local date to avoid UTC offset shifting
  const date = new Date(dateString);
  
  // If it's a date-only string (no time component), parse manually
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Extract rejection reasons from applicant
export function extractRejectionReasons(applicant: any): string[] {
  try {
    // Check status history
    const history = applicant?.statusHistory;
    if (Array.isArray(history)) {
      const rejected = history.filter((h: any) => 
        String(h?.status || '').toLowerCase() === 'rejected'
      );
      if (rejected.length) {
        rejected.sort((x: any, y: any) => {
          const tx = x?.changedAt ? new Date(x.changedAt).getTime() : 0;
          const ty = y?.changedAt ? new Date(y.changedAt).getTime() : 0;
          return ty - tx;
        });
        const latest = rejected[0] || {};
        const reasons = latest.reasons ?? latest.rejectionReasons ?? latest.reasonsSelected ?? [];
        if (Array.isArray(reasons)) {
          return reasons.map((r: any) => String(r ?? '').trim()).filter(Boolean);
        }
        if (typeof reasons === 'string' && reasons) {
          return [reasons];
        }
      }
    }
    
    // Check top-level reasons
    const topReasons = applicant?.reasons ?? 
                       applicant?.rejectionReasons ?? 
                       applicant?.rejectReasons ?? 
                       applicant?.reasonsSelected;
    if (Array.isArray(topReasons)) {
      return topReasons.map((r: any) => String(r ?? '').trim()).filter(Boolean);
    }
    if (typeof topReasons === 'string' && topReasons) {
      return [topReasons];
    }
    
    return [];
  } catch (e) {
    return [];
  }
}

// Collect all unique custom field keys from applicants
export function collectCustomFieldKeys(applicants: any[]): Map<string, string> {
  const customFieldKeyMap = new Map<string, string>();
  
  applicants.forEach((applicant: any) => {
    const customResponses = applicant.customResponses || applicant.customFieldResponses || {};
    Object.keys(customResponses).forEach(key => {
      // Format key for display (convert snake_case/camelCase to readable format)
      const displayKey = key
        .replace(/[_-]/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim();
      // Store original key mapping
      if (!customFieldKeyMap.has(displayKey)) {
        customFieldKeyMap.set(displayKey, key);
      }
    });
  });
  
  return customFieldKeyMap;
}

// Collect all unique job specification keys from applicants
export function collectJobSpecKeys(applicants: any[]): Set<string> {
  const allJobSpecKeys = new Set<string>();
  
  applicants.forEach((applicant: any) => {
    const jobSpecsResponses = applicant.jobSpecsResponses || [];
    jobSpecsResponses.forEach((spec: any) => {
      if (spec.spec) {
        const specText = typeof spec.spec === 'string' ? spec.spec : (spec.spec?.en || '');
        if (specText) allJobSpecKeys.add(specText);
      }
    });
  });
  
  return allJobSpecKeys;
}

// Build export data row for a single applicant
export interface BuildExportRowParams {
  applicant: any;
  customFieldKeyMap: Map<string, string>;
  jobSpecKeys: Set<string>;
  jobPositionMap: Record<string, any>;
  companyMap: Record<string, any>;
  getExpectedSalaryDisplay: (applicant: any) => string;
  getApplicantSScore: (applicant: any) => number | null;
  normalizeGender: (raw: any) => string;
  options?: ExportOptions;
}

export function buildExportRow({
  applicant,
  customFieldKeyMap,
  jobSpecKeys,
  jobPositionMap,
  companyMap,
  getExpectedSalaryDisplay,
  getApplicantSScore,
  normalizeGender,
  options,
}: BuildExportRowParams): ExportDataItem {
  // Helper to get job title
  const getJobTitle = () => {
    const raw = applicant.jobPositionId;
    const getId = (v: any) => {
      if (!v) return '';
      if (typeof v === 'string') return v;
      return v._id ?? v.id ?? '';
    };
    const jobId = getId(raw);
    const job = jobPositionMap[jobId];
    const title = typeof job?.title === 'string' ? job.title : (job?.title?.en || '');
    return title || '-';
  };
  
  // Helper to get company name
  const getCompanyName = () => {
    const raw = applicant.jobPositionId;
    const getId = (v: any) => {
      if (!v) return '';
      if (typeof v === 'string') return v;
      return v._id ?? v.id ?? '';
    };
    const jobId = getId(raw);
    const job = jobPositionMap[jobId];
    const comp = job?.companyId ? getId(job.companyId) : '';
    const company = companyMap[comp];
    return company?.name || company?.title || 'N/A';
  };
  
  // Base applicant information
  const baseData: ExportDataItem = {
    'Applicant No': applicant.applicantNo || applicant.applicantNumber || applicant.applicationNo || '-',
    'Full Name': applicant.fullName || '-',
    'Email': applicant.email || '-',
    'Phone': applicant.phone || '-',
    'Gender': (() => {
      const g = normalizeGender(
        applicant.gender ||
          applicant.customResponses?.gender ||
          applicant.customResponses?.['النوع'] ||
          (applicant as any)['النوع'] ||
          ''
      );
      return g || '-';
    })(),
    'Birth Date': (() => {
      const bd = applicant.birthDate ||
        applicant.birthdate ||
        applicant.customResponses?.birthdate ||
        applicant.customResponses?.birthDate ||
        applicant.customResponses?.['تاريخ_الميلاد'] ||
        applicant.customResponses?.['تاريخ الميلاد'];
      return bd ? formatDateForExport(bd, options) : '-';
    })(),
    'Job Position': getJobTitle(),
    'Company': getCompanyName(),
    'Expected Salary': getExpectedSalaryDisplay(applicant) || '-',
    'Score': (() => {
      const score = getApplicantSScore(applicant);
      return score !== null ? `${score}%` : '-';
    })(),
    'Status': applicant.status ? applicant.status.charAt(0).toUpperCase() + applicant.status.slice(1) : '-',
    'Submitted': applicant.submittedAt ? formatDateForExport(applicant.submittedAt, options) : '-',
    'Address': applicant.address || '-',
  };
  
  // Add custom responses dynamically
  if (options?.includeCustomFields !== false) {
    const customResponses = applicant.customResponses || applicant.customFieldResponses || {};
    Array.from(customFieldKeyMap.keys()).forEach(displayKey => {
      const originalKey = customFieldKeyMap.get(displayKey) || displayKey;
      // Try to find the value using different key variations
      let value = customResponses[originalKey];
      if (value === undefined) {
        // Try alternative key formats
        const altKey1 = originalKey.toLowerCase().replace(/ /g, '_');
        const altKey2 = originalKey.toLowerCase().replace(/ /g, '');
        value = customResponses[altKey1] || customResponses[altKey2];
      }
      baseData[displayKey] = formatCustomResponseValue(value) || '-';
    });
  }
  
  // Add job specifications responses dynamically
  if (options?.includeJobSpecs !== false) {
    const jobSpecsResponses = applicant.jobSpecsResponses || [];
    const jobSpecsMap = new Map();
    jobSpecsResponses.forEach((spec: any) => {
      const specText = typeof spec.spec === 'string' ? spec.spec : (spec.spec?.en || '');
      if (specText) {
        const answer = typeof spec.answer === 'boolean' 
          ? (spec.answer ? 'Met' : 'Not Met') 
          : (spec.answer || 'No');
        jobSpecsMap.set(specText, answer);
      }
    });
    
    Array.from(jobSpecKeys).forEach(specText => {
      baseData[`[Spec] ${specText}`] = jobSpecsMap.get(specText) || 'Not Answered';
    });
  }
  
  // Add status history if requested
  if (options?.includeStatusHistory && applicant.statusHistory) {
    const history = Array.isArray(applicant.statusHistory) ? applicant.statusHistory : [];
    history.forEach((entry: any, index: number) => {
      const prefix = `Status History ${index + 1}`;
      baseData[`${prefix} - Status`] = entry.status || '-';
      baseData[`${prefix} - Date`] = entry.changedAt ? formatDateForExport(entry.changedAt, options) : '-';
      baseData[`${prefix} - Notes`] = entry.notes || '-';
      if (entry.reasons && entry.reasons.length) {
        baseData[`${prefix} - Reasons`] = entry.reasons.join(', ');
      }
    });
  }
  
  return baseData;
}

// Auto-size worksheet columns based on content
export function autoSizeColumns(worksheet: XLSX.WorkSheet, data: ExportDataItem[], maxWidth = 60, minWidth = 12): void {
  if (!data.length) return;
  
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.min(
      maxWidth, 
      Math.max(
        minWidth, 
        key.length + 3, 
        Math.max(...data.map(row => String(row[key] || '').length)) + 2
      )
    )
  }));
  worksheet['!cols'] = colWidths;
}

// Generate filename for export
export function generateExportFilename(
  prefix: string = 'applicants_export',
  count?: number,
  format: 'xlsx' | 'csv' = 'xlsx'
): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
  
  let filename = `${prefix}_${dateStr}_${timeStr}`;
  if (count !== undefined) {
    filename += `_${count}_items`;
  }
  filename += `.${format}`;
  
  return filename;
}

// Main export function
export async function exportToExcel(
  applicants: Applicant[],
  selectedIds: string[],
  {
    jobPositionMap,
    companyMap,
    getExpectedSalaryDisplay,
    getApplicantSScore,
    normalizeGender,
    options = {},
  }: {
    jobPositionMap: Record<string, any>;
    companyMap: Record<string, any>;
    getExpectedSalaryDisplay: (applicant: any) => string;
    getApplicantSScore: (applicant: any) => number | null;
    normalizeGender: (raw: any) => string;
    options?: ExportOptions;
  }
): Promise<ExportResult> {
  try {
    // Get selected applicants data
    const selectedApplicants = applicants.filter((a: any) => {
      const id = typeof a._id === 'string' ? a._id : a._id?._id || a.id || a._id;
      return selectedIds.includes(id);
    });
    
    if (selectedApplicants.length === 0) {
      return {
        success: false,
        message: 'No applicants selected for export',
        rowCount: 0,
      };
    }
    
    // Collect all unique custom field keys
    const customFieldKeyMap = collectCustomFieldKeys(selectedApplicants);
    const jobSpecKeys = options.includeJobSpecs !== false 
      ? collectJobSpecKeys(selectedApplicants)
      : new Set<string>();
    
    // Build export data
    const exportData = selectedApplicants.map(applicant => 
      buildExportRow({
        applicant,
        customFieldKeyMap,
        jobSpecKeys,
        jobPositionMap,
        companyMap,
        getExpectedSalaryDisplay,
        getApplicantSScore,
        normalizeGender,
        options,
      })
    );
    
    if (exportData.length === 0) {
      return {
        success: false,
        message: 'No data to export',
        rowCount: 0,
      };
    }
    
    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Auto-size columns
    autoSizeColumns(worksheet, exportData);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    const sheetName = options.includeStatusHistory ? 'Applicants Full Data' : 'Selected Applicants';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Generate filename
    const filename = generateExportFilename(
      'applicants_export',
      selectedIds.length,
      'xlsx'
    );
    
    // Download file
    XLSX.writeFile(workbook, filename);
    
    return {
      success: true,
      message: `Successfully exported ${selectedIds.length} applicant(s)`,
      fileName: filename,
      rowCount: selectedIds.length,
    };
  } catch (error) {
    console.error('Export error:', error);
    return {
      success: false,
      message: 'Failed to export data',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export to CSV (simpler format)
export async function exportToCSV(
  applicants: Applicant[],
  selectedIds: string[],
  {
    jobPositionMap,
    companyMap,
    getExpectedSalaryDisplay,
    getApplicantSScore,
    normalizeGender,
    options = {},
  }: {
    jobPositionMap: Record<string, any>;
    companyMap: Record<string, any>;
    getExpectedSalaryDisplay: (applicant: any) => string;
    getApplicantSScore: (applicant: any) => number | null;
    normalizeGender: (raw: any) => string;
    options?: ExportOptions;
  }
): Promise<ExportResult> {
  try {
    // Get selected applicants data
    const selectedApplicants = applicants.filter((a: any) => {
      const id = typeof a._id === 'string' ? a._id : a._id?._id || a.id || a._id;
      return selectedIds.includes(id);
    });
    
    if (selectedApplicants.length === 0) {
      return {
        success: false,
        message: 'No applicants selected for export',
        rowCount: 0,
      };
    }
    
    // Collect keys
    const customFieldKeyMap = collectCustomFieldKeys(selectedApplicants);
    const jobSpecKeys = options.includeJobSpecs !== false 
      ? collectJobSpecKeys(selectedApplicants)
      : new Set<string>();
    
    // Build data
    const exportData = selectedApplicants.map(applicant => 
      buildExportRow({
        applicant,
        customFieldKeyMap,
        jobSpecKeys,
        jobPositionMap,
        companyMap,
        getExpectedSalaryDisplay,
        getApplicantSScore,
        normalizeGender,
        options,
      })
    );
    
    if (exportData.length === 0) {
      return {
        success: false,
        message: 'No data to export',
        rowCount: 0,
      };
    }
    
    // Convert to CSV
    const headers = Object.keys(exportData[0]);
    const csvRows = [
      headers.join(','),
      ...exportData.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape quotes and wrap in quotes if contains comma
          const escaped = String(value || '').replace(/"/g, '""');
          return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
        }).join(',')
      ),
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const filename = generateExportFilename('applicants_export', selectedIds.length, 'csv');
    
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return {
      success: true,
      message: `Successfully exported ${selectedIds.length} applicant(s) to CSV`,
      fileName: filename,
      rowCount: selectedIds.length,
    };
  } catch (error) {
    console.error('Export error:', error);
    return {
      success: false,
      message: 'Failed to export data',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Show export success/failure notification
export async function showExportNotification(result: ExportResult): Promise<void> {
  if (result.success) {
    await Swal.fire({
      title: 'Export Successful!',
      text: result.message,
      icon: 'success',
      position: 'center',
      timer: 2000,
      showConfirmButton: false,
    });
  } else {
    await Swal.fire({
      title: 'Export Failed',
      text: result.error || result.message,
      icon: 'error',
    });
  }
}

export default {
  exportToExcel,
  exportToCSV,
  formatCustomResponseValue,
  formatDateForExport,
  normalizeGenderForExport,
  extractRejectionReasons,
  collectCustomFieldKeys,
  collectJobSpecKeys,
  buildExportRow,
  autoSizeColumns,
  generateExportFilename,
  showExportNotification,
};