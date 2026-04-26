// hooks/useApplicantSelection.ts
import { useMemo } from 'react';
import type { MRT_RowSelectionState } from 'material-react-table';

interface Applicant {
  _id: string;
  id?: string;
  email?: string;
  fullName?: string;
  name?: string;
  firstName?: string;
  jobPositionId?: string | { _id?: string; id?: string };
  company?: string | { _id?: string; id?: string };
  companyObj?: string | { _id?: string; id?: string };
  status?: string;
  applicantNo?: number | string;
  applicantNumber?: number | string;
  no?: number | string;
  number?: number | string;
  [key: string]: any;
}

interface SelectedApplicantRecipient {
  email: string;
  applicant: string | undefined;
  jobPositionId: string | undefined;
  applicantName: string;
}

interface SelectedApplicantForInterview {
  applicantId: string;
  applicantName: string;
  applicantNo: number | null;
  email: string;
  companyId: string;
  jobPositionId?: string;
  status: string;
}

interface UseApplicantSelectionProps {
  rowSelection: MRT_RowSelectionState;
  applicants: Applicant[];
  allCompaniesRaw?: any[];
}

interface UseApplicantSelectionReturn {
  selectedApplicantIds: string[];
  selectedApplicantRecipients: SelectedApplicantRecipient[];
  selectedApplicantsForInterview: SelectedApplicantForInterview[];
  selectedApplicantCompanyId: string | null;
  selectedApplicantCompany: any | null;
  selectedApplicantCount: number;
}

const extractId = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = extractId(item);
      if (resolved) return resolved;
    }
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (value && typeof value === 'object') {
    const maybeId = value as { _id?: unknown; id?: unknown };
    if (typeof maybeId._id === 'string' && maybeId._id.trim()) return maybeId._id.trim();
    if (typeof maybeId.id === 'string' && maybeId.id.trim()) return maybeId.id.trim();
  }
  return null;
};

export function useApplicantSelection({
  rowSelection,
  applicants,
  allCompaniesRaw = [],
}: UseApplicantSelectionProps): UseApplicantSelectionReturn {
  
  // Get selected applicant IDs from row selection
  const selectedApplicantIds = useMemo(() => {
    return Object.keys(rowSelection);
  }, [rowSelection]);

  // Get selected applicant recipients for email/messaging
  const selectedApplicantRecipients = useMemo(() => {
    try {
      const ids = new Set(selectedApplicantIds);
      return applicants
        .filter((a: any) => {
          const id = typeof a._id === 'string' ? a._id : a._id?._id || a.id || a._id;
          return ids.has(id);
        })
        .map((a: any) => {
          const applicantId = typeof a._id === 'string' ? a._id : a._id?._id || a.id || undefined;
          const email = typeof a.email === 'string' ? a.email.trim() : '';
          
          let jobPositionId = a.jobPositionId || 
            (a.jobPosition && typeof a.jobPosition === 'object' ? a.jobPosition._id : a.jobPosition);
          
          if (jobPositionId && typeof jobPositionId === 'object') {
            jobPositionId = jobPositionId._id || jobPositionId.id || String(jobPositionId);
          }
          
          const fullName = a.fullName || a.name || a.firstName || '';
          
          return { 
            email, 
            applicant: applicantId, 
            jobPositionId: typeof jobPositionId === 'string' ? jobPositionId : undefined, 
            applicantName: fullName 
          };
        })
        .filter((item: any) => Boolean(item.email));
    } catch (e) {
      return [];
    }
  }, [selectedApplicantIds, applicants]);

  // Get selected applicants for interview scheduling
  const selectedApplicantsForInterview = useMemo(() => {
    try {
      const ids = new Set(selectedApplicantIds);
      const mapped = applicants
        .filter((a: any) => {
          const id = typeof a._id === 'string' ? a._id : a._id?._id || a.id || a._id;
          return ids.has(id);
        })
        .map((a: any) => {
          const applicantId = typeof a._id === 'string' ? a._id : a._id?._id || a.id || '';
          
          let jobPositionId = a.jobPositionId ||
            (a.jobPosition && typeof a.jobPosition === 'object' ? a.jobPosition._id : a.jobPosition);
          
          if (jobPositionId && typeof jobPositionId === 'object') {
            jobPositionId = jobPositionId._id || jobPositionId.id || String(jobPositionId);
          }

          const companyRef = a.company ||
            a.companyObj ||
            (a.jobPositionId &&
              (a.jobPositionId.companyId ||
                a.jobPositionId.company ||
                a.jobPositionId.companyObj));
          
          const companyId = companyRef
            ? typeof companyRef === 'string'
              ? companyRef
              : companyRef._id || companyRef.id || ''
            : '';

          const applicantNoRaw = a.applicantNo ?? a.applicantNumber ?? a.no ?? a.number;
          const parsedApplicantNo = Number(applicantNoRaw);
          const applicantNo = Number.isFinite(parsedApplicantNo) ? parsedApplicantNo : null;

          return {
            applicantId: String(applicantId),
            applicantName: String(a.fullName || a.name || a.firstName || 'Candidate').trim(),
            email: String(a.email || '').trim(),
            applicantNo,
            jobPositionId: typeof jobPositionId === 'string' ? jobPositionId : undefined,
            companyId: String(companyId || ''),
            status: String(a.status || ''),
          };
        })
        .filter((item: any) => item.applicantId);

      // Sort by applicant number then name
      mapped.sort((a: any, b: any) => {
        const noA = typeof a.applicantNo === 'number' ? a.applicantNo : Infinity;
        const noB = typeof b.applicantNo === 'number' ? b.applicantNo : Infinity;
        if (noA !== noB) return noA - noB;
        return String(a.applicantName).localeCompare(String(b.applicantName));
      });

      return mapped;
    } catch (e) {
      return [];
    }
  }, [selectedApplicantIds, applicants]);

  // Get the common company ID for all selected applicants (if they all belong to the same company)
  const selectedApplicantCompanyId = useMemo(() => {
    try {
      const ids = new Set(selectedApplicantIds);
      const companies = applicants
        .filter((a: any) => {
          const id = typeof a._id === 'string' ? a._id : a._id?._id || a.id || a._id;
          return ids.has(id);
        })
        .map((a: any) => {
          const c = a.company ||
            a.companyObj ||
            (a.jobPositionId &&
              (a.jobPositionId.companyId ||
                a.jobPositionId.company ||
                a.jobPositionId.companyObj));
          if (!c) return null;
          return typeof c === 'string' ? c : c._id || c.id || null;
        })
        .filter(Boolean) as string[];
      
      const unique = Array.from(new Set(companies));
      return unique.length === 1 ? unique[0] : null;
    } catch (e) {
      return null;
    }
  }, [selectedApplicantIds, applicants]);

  // Get the full company object for the selected applicants
  const selectedApplicantCompany = useMemo(() => {
    try {
      if (!selectedApplicantCompanyId) return null;
      const found = (allCompaniesRaw || []).find(
        (c: any) =>
          c &&
          (c._id === selectedApplicantCompanyId || c.id === selectedApplicantCompanyId)
      );
      return found || null;
    } catch (e) {
      return null;
    }
  }, [selectedApplicantCompanyId, allCompaniesRaw]);

  const selectedApplicantCount = useMemo(() => {
    return selectedApplicantIds.length;
  }, [selectedApplicantIds]);

  return {
    selectedApplicantIds,
    selectedApplicantRecipients,
    selectedApplicantsForInterview,
    selectedApplicantCompanyId,
    selectedApplicantCompany,
    selectedApplicantCount,
  };
}