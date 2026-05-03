// hooks/useApplicantFilters.ts
import { useMemo, useCallback } from 'react';
import { sortApplicantsByDuplicatePriority } from '../../../../../utils/applicantDuplicateSort';
import { applyCustomFilters, getApplicantCompanyId } from '../utils/filterHelpers';

interface UseApplicantFiltersProps {
  applicants: any[];
  columnFilters: any[];
  customFilters: any[];
  isSuperAdmin: boolean;
  effectiveOnlyStatus?: string | string[];
  selectedCompanyFilterValue?: string[] | string | null;
  jobPositionMap: Record<string, any>;
  fieldToJobIds: Map<string, Set<string>> | Record<string, Set<string>>;
  currentUserId: string;
  allCompaniesRaw: any[];
}

export function useApplicantFilters({
  applicants,
  columnFilters,
  customFilters,
  isSuperAdmin,
  effectiveOnlyStatus,
  selectedCompanyFilterValue,
  jobPositionMap,
  fieldToJobIds,
  currentUserId,
}: UseApplicantFiltersProps) {
  // Get selected company from column filters
  const selectedCompanyIds = useMemo((): string[] | null => {
    if (selectedCompanyFilterValue) {
      if (Array.isArray(selectedCompanyFilterValue)) {
        return selectedCompanyFilterValue;
      }
      if (typeof selectedCompanyFilterValue === 'string') {
        return [selectedCompanyFilterValue];
      }
      return null;
    }
    const companyFilter = columnFilters.find((f: any) => f.id === 'companyId');
    if (!companyFilter?.value) return null;
    const companyIds = Array.isArray(companyFilter.value) 
      ? companyFilter.value 
      : [companyFilter.value];
    return companyIds;
  }, [selectedCompanyFilterValue, columnFilters]);

  // Determine dataset to pass to MRT
  const displayedApplicants = useMemo(() => {
    let filtered = applicants || [];
    
    // Apply company filter if present
    if (selectedCompanyIds && selectedCompanyIds.length > 0) {
      filtered = filtered.filter((applicant: any) => {
        const applicantCompanyId = getApplicantCompanyId(applicant, jobPositionMap);
        return applicantCompanyId && selectedCompanyIds.includes(applicantCompanyId);
      });
    }
    
    // Apply job position filter
    const jobFilter = columnFilters.find((f: any) => f.id === 'jobPositionId');
    const jobFilterValue = jobFilter?.value;
    
    if (jobFilterValue && (Array.isArray(jobFilterValue) ? jobFilterValue.length > 0 : true)) {
      const selectedJobIds = Array.isArray(jobFilterValue) ? jobFilterValue : [jobFilterValue];
      filtered = filtered.filter((applicant: any) => {
        const jobPositionId = applicant?.jobPositionId;
        let applicantJobId = '';
        if (typeof jobPositionId === 'string') {
          applicantJobId = jobPositionId;
        } else if (jobPositionId && typeof jobPositionId === 'object') {
          applicantJobId = jobPositionId._id || jobPositionId.id || '';
        }
        return selectedJobIds.includes(applicantJobId);
      });
    }
    
    // Apply status filter (from props or URL params)
    if (effectiveOnlyStatus !== undefined && effectiveOnlyStatus !== null) {
      const allowed = Array.isArray(effectiveOnlyStatus) ? effectiveOnlyStatus : [effectiveOnlyStatus];
      filtered = filtered.filter((a: any) => allowed.includes(a.status));
      return filtered;
    }
    
    // Apply status column filter
    const statusFilter = columnFilters.find((f: any) => f.id === 'status');
    const statusVal = statusFilter?.value;

    if (isSuperAdmin) {
      if (statusVal === 'trashed') return filtered;
      if (Array.isArray(statusVal) && statusVal.length > 0) {
        filtered = filtered.filter((a: any) => statusVal.includes(a.status));
        return filtered;
      }
      filtered = filtered.filter((a: any) => a.status !== 'trashed');
      return filtered;
    }

    if (Array.isArray(statusVal) && statusVal.length > 0) {
      const allowed = statusVal.filter((s: any) => s !== 'trashed');
      if (allowed.length === 0) {
        filtered = filtered.filter((a: any) => a.status !== 'trashed');
        return filtered;
      }
      filtered = filtered.filter(
        (a: any) => allowed.includes(a.status) && a.status !== 'trashed'
      );
      return filtered;
    }

    filtered = filtered.filter((a: any) => a.status !== 'trashed');
    return filtered;
  }, [applicants, columnFilters, isSuperAdmin, effectiveOnlyStatus, selectedCompanyIds, jobPositionMap]);

  // Check if duplicates only filter is enabled
  const duplicatesOnlyEnabled = useMemo(
    () =>
      Array.isArray(customFilters) &&
      customFilters.some(
        (f: any) => f?.fieldId === '__duplicates_only' && f?.value === true
      ),
    [customFilters]
  );

  // Apply custom filters and duplicates logic
  const filteredApplicants = useMemo(() => {
    
    // First apply custom filters
    let processed = applyCustomFilters(displayedApplicants, customFilters, {
      jobPositionMap,
      fieldToJobIds: fieldToJobIds instanceof Map ? fieldToJobIds : new Map(),
      currentUserId,
    });


    if (!duplicatesOnlyEnabled) {
      return processed;
    }

    const sortedByDuplicatePriority = sortApplicantsByDuplicatePriority(
      processed as any[],
      currentUserId,
      (a, b) => {
        const nameA = String(a?.fullName || a?.email || '').toLowerCase();
        const nameB = String(b?.fullName || b?.email || '').toLowerCase();
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        const idA = String(a?._id || a?.id || '');
        const idB = String(b?._id || b?.id || '');
        return idA.localeCompare(idB);
      },
      { getCompanyId: (applicant: any) => getApplicantCompanyId(applicant, jobPositionMap) }
    );

    return sortedByDuplicatePriority;
  }, [displayedApplicants, customFilters, duplicatesOnlyEnabled, currentUserId, jobPositionMap, fieldToJobIds]);

  // Get status filter options
  const statusFilterOptions = useMemo(() => {
    const uniqueStatuses = Array.from(new Set(applicants.map((a: any) => a?.status).filter(Boolean)));
    const defaultOrder = ['pending', 'approved', 'interview', 'interviewed', 'rejected', 'trashed'];
    const sorted = [...defaultOrder, ...uniqueStatuses.filter(s => !defaultOrder.includes(s))];
    return sorted.map((status) => ({
      id: status,
      title: status.charAt(0).toUpperCase() + status.slice(1),
    }));
  }, [applicants]);

  // Get status color function
  const getStatusColor = useCallback((status: string) => {
    if (!status) return { bg: '#F3F4F6', color: '#1F2937' };
    
    const defaultColors: Record<string, { bg: string; color: string }> = {
      pending: { bg: '#FEF3C7', color: '#92400E' },
      approved: { bg: '#D1FAE5', color: '#065F46' },
      interview: { bg: '#DBEAFE', color: '#1E40AF' },
      interviewed: { bg: '#E0E7FF', color: '#3730A3' },
      rejected: { bg: '#FEE2E2', color: '#991B1B' },
      trashed: { bg: '#F3F4F6', color: '#6B7280' },
      hired: { bg: '#D1FAE5', color: '#065F46' },
      'on-hold': { bg: '#FEF3C7', color: '#92400E' },
      withdrawn: { bg: '#F3F4F6', color: '#4B5563' },
    };
    
    const normalized = status.toLowerCase();
    return defaultColors[normalized] || { bg: '#F3F4F6', color: '#1F2937' };
  }, []);

  // Get status description
  const getDescription = useCallback((status: string) => {
    const descriptions: Record<string, string> = {
      pending: 'Application is pending review',
      approved: 'Application has been approved',
      interview: 'Candidate invited for interview',
      interviewed: 'Interview has been conducted',
      rejected: 'Application has been rejected',
      trashed: 'Application has been archived',
      hired: 'Candidate has been hired',
      'on-hold': 'Application is on hold',
      withdrawn: 'Application has been withdrawn',
    };
    return descriptions[status?.toLowerCase()] || '';
  }, []);

  return {
    filteredApplicants,
    duplicatesOnlyEnabled,
    displayedApplicants,  // IMPORTANT: Return this!
    statusFilterOptions,
    getStatusColor,
    getDescription,
    selectedCompanyFilter: selectedCompanyIds,
  };
}