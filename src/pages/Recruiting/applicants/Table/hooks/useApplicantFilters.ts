// hooks/useApplicantFilters.ts
import { useMemo, useCallback } from 'react';
import { sortApplicantsByDuplicatePriority, buildApplicantDuplicateLookup } from '../../../../../utils/applicantDuplicateSort';
import { applyCustomFilters, getApplicantCompanyId } from '../utils/filterHelpers';
import { normalizeGender } from '../utils/filterHelpers';
import { extractRejectionReasons } from '../utils/exportHelpers';

interface UseApplicantFiltersProps {
  applicants: any[];
  columnFilters: any[];
  customFilters: any[];
  isSuperAdmin: boolean;
  effectiveOnlyStatus?: string | string[];
  effectiveOnlyJobPositions?: string[];
  selectedCompanyFilterValue?: string[] | string | null;
  excludeColumns?: string[];
  jobPositionMap: Record<string, any>;
  fieldToJobIds: Map<string, Set<string>> | Record<string, Set<string>>;
  currentUserId: string;
  allCompaniesRaw: any[];
  canViewTrashed?: boolean;
  globalFilter?: string;
}

export function useApplicantFilters({
  applicants,
  columnFilters,
  customFilters,
  isSuperAdmin,
  effectiveOnlyStatus,
  effectiveOnlyJobPositions,
  selectedCompanyFilterValue,
  excludeColumns = [],
  jobPositionMap,
  fieldToJobIds,
  currentUserId,
  canViewTrashed = false,
  globalFilter = '',
  allCompaniesRaw = [],
}: UseApplicantFiltersProps) {
  const normalizeStatus = useCallback((value: unknown) => {
    return String(value ?? '').trim().toLowerCase();
  }, []);

  const isTrashed = useCallback((status: string) => {
    return normalizeStatus(status) === 'trashed';
  }, [normalizeStatus]);

  // Helper function to apply column filters
  const applyColumnFilters = useCallback((data: any[]) => {
    let filtered = [...data];

    if (globalFilter.trim()) {
      const q = globalFilter.trim().toLowerCase();
      filtered = filtered.filter((applicant: any) => {
        const fullName = String(applicant?.fullName || '').toLowerCase();
        const email = String(applicant?.email || '').toLowerCase();
        const phone = String(applicant?.phone || '').toLowerCase();
        const applicantNo = String(
          applicant?.applicantNo ||
            applicant?.applicantNumber ||
            applicant?.applicationNo ||
            ''
        ).toLowerCase();
        const status = String(applicant?.status || '').toLowerCase();

        const rawJob = applicant?.jobPositionId;
        const jobId =
          typeof rawJob === 'string' ? rawJob : (rawJob?._id ?? rawJob?.id ?? '');
        const job = jobId ? jobPositionMap[jobId] : undefined;
        const jobTitleParts: string[] = [];
        if (job?.title) {
          if (typeof job.title === 'string') {
            jobTitleParts.push(job.title);
          } else if (typeof job.title === 'object') {
            ['en', 'ar', 'name']
              .map((k) => job.title[k])
              .filter(Boolean)
              .forEach((v) => jobTitleParts.push(String(v)));
          }
        }
        const snapshot = applicant?.jobPositionNameSnapshot;
        if (snapshot && typeof snapshot === 'object') {
          ['en', 'ar']
            .map((k) => snapshot[k])
            .filter(Boolean)
            .forEach((v) => jobTitleParts.push(String(v)));
        }
        const jobTitle = jobTitleParts.join(' ').toLowerCase();

        const companyId = getApplicantCompanyId(applicant, jobPositionMap);
        const company = allCompaniesRaw.find((c: any) => {
          const cId =
            typeof c?._id === 'string' ? c._id : c?._id?._id ?? c?.id;
          return cId === companyId;
        });
        const companyNameParts: string[] = [];
        if (company?.name) {
          if (typeof company.name === 'string') companyNameParts.push(company.name);
          else if (typeof company.name === 'object') {
            ['en', 'ar', 'name']
              .map((k) => company.name[k])
              .filter(Boolean)
              .forEach((v) => companyNameParts.push(String(v)));
          }
        }
        if (company?.title) companyNameParts.push(company.title);
        const companyName = companyNameParts.join(' ').toLowerCase();

        return (
          fullName.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          applicantNo.includes(q) ||
          status.includes(q) ||
          jobTitle.includes(q) ||
          companyName.includes(q)
        );
      });
    }
    
    const companyFilter = columnFilters.find((f: any) => f.id === 'companyId');
    const companyFilterValue = companyFilter?.value;
    const companyExcludeMode = excludeColumns.includes('companyId');

    let companyIds: string[] | null = null;
    if (companyFilterValue) {
      companyIds = Array.isArray(companyFilterValue) ? companyFilterValue : [companyFilterValue];
    } else if (selectedCompanyFilterValue) {
      if (Array.isArray(selectedCompanyFilterValue)) {
        companyIds = selectedCompanyFilterValue;
      } else if (typeof selectedCompanyFilterValue === 'string') {
        companyIds = [selectedCompanyFilterValue];
      }
    }

    if (companyIds && companyIds.length > 0) {
      filtered = filtered.filter((applicant: any) => {
        const applicantCompanyId = getApplicantCompanyId(applicant, jobPositionMap);
        const matches = applicantCompanyId && companyIds?.includes(applicantCompanyId);
        return companyExcludeMode ? !matches : matches;
      });
    }
    
    // Apply job position filter with exclude mode support
    const jobFilter = columnFilters.find((f: any) => f.id === 'jobPositionId');
    const jobFilterValue = jobFilter?.value;
    const jobExcludeMode = excludeColumns.includes('jobPositionId');

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
        const isSelected = selectedJobIds.includes(applicantJobId);
        return jobExcludeMode ? !isSelected : isSelected;
      });
    }
    
    // Apply gender filter with exclude mode support
    const genderFilter = columnFilters.find((f: any) => f.id === 'gender');
    const genderFilterValue = genderFilter?.value;
    const genderExcludeMode = excludeColumns.includes('gender');
    
    if (genderFilterValue && (Array.isArray(genderFilterValue) ? genderFilterValue.length > 0 : true)) {
      const selectedGenders = Array.isArray(genderFilterValue) ? genderFilterValue : [genderFilterValue];
      filtered = filtered.filter((applicant: any) => {
        const rawGender = applicant?.gender || applicant?.customResponses?.gender || applicant?.customResponses?.['النوع'] || (applicant as any)['النوع'] || '';
        const normalizedGenderValue = normalizeGender(rawGender);
        const matches = selectedGenders.includes(normalizedGenderValue);
        return genderExcludeMode ? !matches : matches;
      });
    }
    
    // Apply rejection reasons filter with exclude mode support
    const reasonsFilter = columnFilters.find((f: any) => f.id === 'rejectionReasons');
    const reasonsFilterValue = reasonsFilter?.value;
    const reasonsExcludeMode = excludeColumns.includes('rejectionReasons');

    if (reasonsFilterValue && (Array.isArray(reasonsFilterValue) ? reasonsFilterValue.length > 0 : true)) {
      const selectedReasons = Array.isArray(reasonsFilterValue) ? reasonsFilterValue : [reasonsFilterValue];
      filtered = filtered.filter((applicant: any) => {
        const applicantReasons = extractRejectionReasons(applicant);
        if (!Array.isArray(applicantReasons) || applicantReasons.length === 0) {
          return reasonsExcludeMode;
        }
        const matches = selectedReasons.some((selectedReason: string) =>
          applicantReasons.some(
            (applicantReason: string) =>
              applicantReason.toLowerCase().includes(selectedReason.toLowerCase()) ||
              selectedReason.toLowerCase().includes(applicantReason.toLowerCase())
          )
        );
        return reasonsExcludeMode ? !matches : matches;
      });
    }
    
    // Apply status filter (from props or URL params)
    const hasEffectiveStatus = effectiveOnlyStatus !== undefined && effectiveOnlyStatus !== null && effectiveOnlyStatus !== '';
    if (hasEffectiveStatus) {
      const allowed = (Array.isArray(effectiveOnlyStatus) ? effectiveOnlyStatus : [effectiveOnlyStatus])
        .map(normalizeStatus)
        .filter(Boolean);
      if (allowed.length > 0) {
        filtered = filtered.filter((a: any) => allowed.includes(normalizeStatus(a.status)));
      }
    }

    // Apply job position filter (from props or URL params)
    if (effectiveOnlyJobPositions !== undefined && effectiveOnlyJobPositions !== null && effectiveOnlyJobPositions.length > 0) {
      filtered = filtered.filter((a: any) => {
        const jobPositionId = a?.jobPositionId;
        let applicantJobId = '';
        if (typeof jobPositionId === 'string') {
          applicantJobId = jobPositionId;
        } else if (jobPositionId && typeof jobPositionId === 'object') {
          applicantJobId = jobPositionId._id || jobPositionId.id || '';
        }
        return effectiveOnlyJobPositions.includes(applicantJobId);
      });
    }

    // Skip status column filter when page-level status filter is active
    if (!hasEffectiveStatus) {
      const statusFilter = columnFilters.find((f: any) => f.id === 'status');
      const statusVal = statusFilter?.value;
      const statusExcludeMode = excludeColumns.includes('status');
      const hasGlobalSearch = Boolean(globalFilter.trim());

      if (isSuperAdmin || canViewTrashed) {
        if (normalizeStatus(statusVal) === 'trashed') {
          filtered = filtered.filter((a: any) => isTrashed(a.status));
          return filtered;
        }
        if (Array.isArray(statusVal) && statusVal.length > 0) {
          const allowed = statusVal.map(normalizeStatus).filter(Boolean);
          filtered = filtered.filter((a: any) => {
            const matches = allowed.includes(normalizeStatus(a.status));
            // In revert mode, exclude trashed status
            if (statusExcludeMode && isTrashed(a.status)) {
              return false;
            }
            return statusExcludeMode ? !matches : matches;
          });
          return filtered;
        }
        // When no status selected, exclude trashed (but include when searching)
        if (hasGlobalSearch) {
          return filtered;
        }
        filtered = filtered.filter((a: any) => !isTrashed(a.status));
        return filtered;
      }

      // For non-super admin users
      if (Array.isArray(statusVal) && statusVal.length > 0) {
        const allowed = statusVal.map(normalizeStatus).filter((s: string) => s !== 'trashed');
        if (allowed.length === 0) {
          filtered = filtered.filter((a: any) => !isTrashed(a.status));
          return filtered;
        }
        filtered = filtered.filter((a: any) => {
          const matches = allowed.includes(normalizeStatus(a.status));
          const notTrashed = !isTrashed(a.status);
          // In revert mode, exclude trashed status
          if (statusExcludeMode && isTrashed(a.status)) {
            return false;
          }
          return statusExcludeMode ? (!matches && notTrashed) : (matches && notTrashed);
        });
        return filtered;
      }

      // Default: exclude trashed (but include when searching)
      if (hasGlobalSearch) {
        return filtered;
      }
      filtered = filtered.filter((a: any) => !isTrashed(a.status));
      return filtered;
    }

    return filtered;
  }, [columnFilters, isSuperAdmin, effectiveOnlyStatus, selectedCompanyFilterValue, jobPositionMap, normalizeStatus, isTrashed, globalFilter, allCompaniesRaw, excludeColumns, extractRejectionReasons]);

  // Get filtered data based on column filters
  const columnFilteredApplicants = useMemo(() => {
    return applyColumnFilters(applicants);
  }, [applicants, columnFilters, isSuperAdmin, effectiveOnlyStatus, effectiveOnlyJobPositions, jobPositionMap, normalizeStatus, canViewTrashed, globalFilter, selectedCompanyFilterValue, allCompaniesRaw]);

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
    // First apply custom filters to column-filtered data
    let processed = applyCustomFilters(columnFilteredApplicants, customFilters, {
      jobPositionMap,
      fieldToJobIds: fieldToJobIds instanceof Map ? fieldToJobIds : new Map(),
      currentUserId,
    });

    if (!duplicatesOnlyEnabled) {
      return processed;
    }

    // If duplicates only is enabled, further filter to show only duplicates
    const lookup = buildApplicantDuplicateLookup(
      processed as any[],
      currentUserId,
      { getCompanyId: (applicant: any) => getApplicantCompanyId(applicant, jobPositionMap) }
    );

    const duplicatesOnly = processed.filter((applicant: any) => {
      const id = String(applicant?._id || applicant?.id || '');
      const meta = lookup.get(id);
      return meta?.isDuplicate === true;
    });

    return sortApplicantsByDuplicatePriority(
      duplicatesOnly as any[],
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
  }, [columnFilteredApplicants, customFilters, duplicatesOnlyEnabled, currentUserId, jobPositionMap, fieldToJobIds]);

  // Get the current company IDs from the filter
  const currentCompanyIds = useMemo(() => {
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
    return Array.isArray(companyFilter.value) ? companyFilter.value : [companyFilter.value];
  }, [selectedCompanyFilterValue, columnFilters]);

  // Applicants filtered only by company (for cascading filter options)
  // Get status filter options
  const statusFilterOptions = useMemo(() => {
    const statusesFromSettings = new Map<string, string>();
    allCompaniesRaw.forEach((company: any) => {
      const statuses = company?.settings?.statuses;
      if (Array.isArray(statuses)) {
        statuses.forEach((s: any) => {
          const name = s?.name?.trim();
          if (name) {
            statusesFromSettings.set(name.toLowerCase(), name);
          }
        });
      }
    });

    if (statusesFromSettings.size === 0) {
      const source = Array.isArray(applicants) ? applicants : [];
      source.forEach((a: any) => {
        const s = a?.status?.trim();
        if (s) statusesFromSettings.set(s.toLowerCase(), s);
      });
    }

    const uniqueStatuses = Array.from(statusesFromSettings.values());

    const defaultOrderKeys = ['pending', 'approved', 'interview', 'interviewed', 'rejected', 'trashed'];
    const inDefault = uniqueStatuses.filter(s => defaultOrderKeys.includes(s.toLowerCase()));
    const outDefault = uniqueStatuses.filter(s => !defaultOrderKeys.includes(s.toLowerCase()));

    // Sort default ones by their defined order, then append the rest alphabetically
    const sorted = [
      ...defaultOrderKeys
        .map(key => inDefault.find(s => s.toLowerCase() === key))
        .filter(Boolean) as string[],
      ...outDefault.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    ];

    return sorted.map((status) => ({
      id: status,  // ← original casing, matches applicant.status exactly
      title: status.charAt(0).toUpperCase() + status.slice(1),
    }));
  }, [applicants, allCompaniesRaw]);

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
    statusFilterOptions,
    getStatusColor,
    getDescription,
    selectedCompanyFilter: currentCompanyIds,
  };
}