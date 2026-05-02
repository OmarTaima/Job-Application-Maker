// hooks/useApplicantSelection.ts
import { useMemo } from 'react';
import type { MRT_RowSelectionState } from 'material-react-table';
import type { 
  Applicant, 
  SelectedApplicantRecipient, 
  SelectedApplicantForInterview 
} from '../../../../../types/applicants';

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
  
  const selectedApplicantIds = useMemo(() => {
    return Object.keys(rowSelection);
  }, [rowSelection]);

  const selectedApplicantRecipients = useMemo(() => {
    try {
      const ids = new Set(selectedApplicantIds);
      const filteredApplicants = applicants.filter((a: Applicant) => {
        const applicantId = a._id || a.id;
        return applicantId ? ids.has(String(applicantId)) : false;
      });
      
      return filteredApplicants.map((a: Applicant) => {
        const applicantId = a._id || a.id;
        const email = a.email || '';
        
        let jobPositionId: string | undefined = undefined;
        if (typeof a.jobPositionId === 'string') {
          jobPositionId = a.jobPositionId;
        } else if (a.jobPositionId && typeof a.jobPositionId === 'object') {
          jobPositionId = (a.jobPositionId as any)._id || (a.jobPositionId as any).id;
        }
        
        const fullName = a.fullName || a.name || a.firstName || '';
        
        return { 
          email, 
          applicant: applicantId ? String(applicantId) : undefined, 
          jobPositionId, 
          applicantName: fullName 
        };
      }).filter((item) => Boolean(item.email));
    } catch (e) {
      console.error('Error in selectedApplicantRecipients:', e);
      return [];
    }
  }, [selectedApplicantIds, applicants]);

  const selectedApplicantsForInterview = useMemo(() => {
    try {
      const ids = new Set(selectedApplicantIds);
      const filteredApplicants = applicants.filter((a: Applicant) => {
        const applicantId = a._id || a.id;
        return applicantId ? ids.has(String(applicantId)) : false;
      });
      
      const mapped = filteredApplicants.map((a: Applicant) => {
        const applicantId = a._id || a.id || '';
        
        let jobPositionId: string | undefined = undefined;
        if (typeof a.jobPositionId === 'string') {
          jobPositionId = a.jobPositionId;
        } else if (a.jobPositionId && typeof a.jobPositionId === 'object') {
          jobPositionId = (a.jobPositionId as any)._id || (a.jobPositionId as any).id;
        }

        let companyId = '';
        if (typeof a.companyId === 'string') {
          companyId = a.companyId;
        } else if (a.companyId && typeof a.companyId === 'object') {
          companyId = (a.companyId as any)._id || (a.companyId as any).id || '';
        }

        const applicantNoRaw = a.applicantNo ?? a.applicantNumber ?? a.no ?? a.number;
        const parsedApplicantNo = Number(applicantNoRaw);
        const applicantNo = Number.isFinite(parsedApplicantNo) ? parsedApplicantNo : null;

        return {
          applicantId: String(applicantId),
          applicantName: String(a.fullName || a.name || a.firstName || 'Candidate').trim(),
          email: String(a.email || '').trim(),
          applicantNo,
          jobPositionId,
          companyId: String(companyId || ''),
          status: String(a.status || ''),
        };
      }).filter((item) => Boolean(item.applicantId));

      mapped.sort((a, b) => {
        const noA = typeof a.applicantNo === 'number' ? a.applicantNo : Infinity;
        const noB = typeof b.applicantNo === 'number' ? b.applicantNo : Infinity;
        if (noA !== noB) return noA - noB;
        return String(a.applicantName).localeCompare(String(b.applicantName));
      });

      return mapped;
    } catch (e) {
      console.error('Error in selectedApplicantsForInterview:', e);
      return [];
    }
  }, [selectedApplicantIds, applicants]);

  const selectedApplicantCompanyId = useMemo(() => {
    try {
      const ids = new Set(selectedApplicantIds);
      const filteredApplicants = applicants.filter((a: Applicant) => {
        const applicantId = a._id || a.id;
        return applicantId ? ids.has(String(applicantId)) : false;
      });
      
      const companies: string[] = [];
      for (const a of filteredApplicants) {
        let companyId = '';
        if (typeof a.companyId === 'string') {
          companyId = a.companyId;
        } else if (a.companyId && typeof a.companyId === 'object') {
          companyId = (a.companyId as any)._id || (a.companyId as any).id || '';
        }
        if (companyId) companies.push(companyId);
      }
      
      const unique = Array.from(new Set(companies));
      return unique.length === 1 ? unique[0] : null;
    } catch (e) {
      return null;
    }
  }, [selectedApplicantIds, applicants]);

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