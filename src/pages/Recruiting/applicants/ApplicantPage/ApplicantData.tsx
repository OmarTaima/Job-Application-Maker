// Core React imports
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useStatusSettings } from '../../../../hooks/useStatusSettings';
// UI helpers and third-party utilities
import Swal from '../../../../utils/swal';
import { useParams, useNavigate, useLocation } from 'react-router';
import PageBreadcrumb from '../../../../components/common/PageBreadCrumb';
import PageMeta from '../../../../components/common/PageMeta';
import LoadingSpinner from '../../../../components/common/LoadingSpinner';
import Label from '../../../../components/form/Label';
import { Modal } from '../../../../components/ui/modal';
import { PlusIcon } from '../../../../icons';
import {
  useApplicant,
  useUpdateApplicant,
  useUpdateApplicantStatus,
  useScheduleInterview,
  useUpdateInterviewStatus,
  useAddComment,
  useSendEmail,
  useSendMessage,
  useMarkApplicantSeen,
  applicantsKeys,
  useApplicants,
  useCompanies,
} from '../../../../hooks/queries';
import { useAuth } from '../../../../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  applicantsService,
  type Applicant,
  type UpdateStatusRequest,
} from '../../../../services/applicantsService';
import { toPlainString } from '../../../../utils/strings';
import MessageModal from '../../../../components/modals/MessageModal';
import InterviewScheduleModal from '../../../../components/modals/InterviewScheduleModal';
import CommentModal from '../../../../components/modals/commentmodal';
import InterviewSettingsModal from '../../../../components/modals/InterviewSettingsModal';
import StatusChangeModal from '../../../../components/modals/StatusChangeModal';
import StatusHistory from './StatusHistory';
import CustomResponses from './CustomResponses';
import Questions from './Questions';
import { MenuItem } from '@mui/material';
import { Menu } from '@mui/material';
// Simple Quill editor integration (dynamic import to avoid react-quill)
import 'quill/dist/quill.snow.css';

// Main page component
const ApplicantData = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Get company ID from user context for fetching applicants
  const { user, hasPermission } = useAuth();
  const companyId = useMemo(() => {
    if (!user) return undefined;
    const roleName = user?.roleId?.name?.toLowerCase();
    const isSuperAdmin = roleName === 'super admin';
    const usercompanyId = user?.companies?.map((c) =>
      typeof c.companyId === 'string' ? c.companyId : c.companyId._id
    );
    if (isSuperAdmin) return undefined;
    return usercompanyId?.length ? usercompanyId : undefined;
  }, [user]);

  const userCompanies = useMemo(() => {
    if (!user?.companies || !Array.isArray(user.companies)) return [] as any[];
    return user.companies
      .map((entry: any) => {
        if (!entry) return null;
        if (typeof entry.companyId === 'string') return null;
        return entry.companyId || null;
      })
      .filter(Boolean);
  }, [user]);

  const userCompanyIds = useMemo(() => {
    if (!Array.isArray(user?.companies)) return [] as string[];
    return user.companies
      .map((entry: any) => {
        if (!entry) return null;
        const companyId = entry.companyId;
        if (!companyId) return null;
        if (typeof companyId === 'string') return companyId;
        if (typeof companyId === 'object')
          return companyId._id || companyId.id || null;
        return null;
      })
      .filter(Boolean) as string[];
  }, [user]);

  const shouldFetchUserCompanies = useMemo(() => {
    // Only fetch from server if we don't already have company objects on the `user`
    return (
      (!Array.isArray(userCompanies) || userCompanies.length === 0) &&
      userCompanyIds.length > 0
    );
  }, [userCompanies, userCompanyIds]);

  const { data: userCompaniesFromServer = [] } = useCompanies(
    shouldFetchUserCompanies ? userCompanyIds : undefined,
    { enabled: shouldFetchUserCompanies }
  );

  const preferredUserCompanies = useMemo(() => {
    if (Array.isArray(userCompanies) && userCompanies.length > 0)
      return userCompanies;
    if (
      Array.isArray(userCompaniesFromServer) &&
      userCompaniesFromServer.length > 0
    )
      return userCompaniesFromServer;
    return [] as any[];
  }, [userCompanies, userCompaniesFromServer]);

  const hasApplicantsListInState = Array.isArray(
    (location.state as any)?.applicantsList
  );
  const cachedApplicantsLists = queryClient.getQueriesData({
    queryKey: applicantsKeys.lists(),
  });
  const cachedApplicantsListData = (() => {
    for (const [, data] of cachedApplicantsLists) {
      if (Array.isArray(data)) return data;
      if (
        data &&
        typeof data === 'object' &&
        'data' in data &&
        Array.isArray((data as any).data)
      ) {
        return (data as any).data;
      }
    }
    return undefined;
  })();
  const hasApplicantsListInCache = Array.isArray(cachedApplicantsListData);
  const shouldFetchApplicants =
    !hasApplicantsListInState && !hasApplicantsListInCache;

  const canManageApplicant =
    hasPermission('Applicant Management', 'create') &&
    hasPermission('Applicant Management', 'write');
  const canManageInterviews =
    hasPermission('Interview Settings Management', 'create') &&
    hasPermission('Interview Settings Management', 'write');
  const canManageMessages =
    hasPermission('Message Management', 'create') &&
    hasPermission('Message Management', 'write');

  // Fetch all applicants for navigation only when we do not already have a list
  const { data: allApplicantsData = [] } = useApplicants(
    companyId as any,
    undefined,
    undefined,
    {
      enabled: shouldFetchApplicants,
    }
  );

  // Get all applicants from props or cache
  const allApplicants = useMemo(() => {
    // First try from location state (if coming from table with filters)
    if (
      location.state?.applicantsList &&
      Array.isArray(location.state.applicantsList)
    ) {
      return location.state.applicantsList;
    }

    // Then try from any cached list query
    if (cachedApplicantsListData && Array.isArray(cachedApplicantsListData)) {
      return cachedApplicantsListData;
    }

    // Fall back to fetched data - handle both array and object with data property
    if (Array.isArray(allApplicantsData)) {
      return allApplicantsData;
    }
    if (
      allApplicantsData &&
      typeof allApplicantsData === 'object' &&
      'data' in allApplicantsData &&
      Array.isArray((allApplicantsData as any).data)
    ) {
      return (allApplicantsData as any).data;
    }

    return [];
  }, [location.state, cachedApplicantsListData, allApplicantsData]);

  // Find current applicant index
  const currentApplicantIndex = useMemo(() => {
    if (!id || allApplicants.length === 0) return -1;

    return allApplicants.findIndex(
      (a: any) => String(a?._id || a?.id || '') === String(id)
    );
  }, [id, allApplicants]);

  // Navigate to previous applicant
  const goToPreviousApplicant = useCallback(() => {
    if (currentApplicantIndex > 0) {
      const prevApplicant = allApplicants[currentApplicantIndex - 1];
      const prevId = String(prevApplicant?._id || prevApplicant?.id || '');
      if (prevId) {
        navigate(`/applicant-details/${prevId}`, {
          state: { ...location.state, applicant: prevApplicant },
        });
      }
    }
  }, [currentApplicantIndex, allApplicants, navigate, location.state]);

  // Navigate to next applicant
  const goToNextApplicant = useCallback(() => {
    if (
      currentApplicantIndex < allApplicants.length - 1 &&
      currentApplicantIndex !== -1
    ) {
      const nextApplicant = allApplicants[currentApplicantIndex + 1];
      const nextId = String(nextApplicant?._id || nextApplicant?.id || '');
      if (nextId) {
        navigate(`/applicant-details/${nextId}`, {
          state: { ...location.state, applicant: nextApplicant },
        });
      }
    }
  }, [currentApplicantIndex, allApplicants, navigate, location.state]);

  useEffect(() => {
    // Check if this tab was opened in background
    const params = new URLSearchParams(location.search);
    if (params.get('bg') === '1' && window.opener && !window.opener.closed) {
      try {
        window.opener.focus();
      } catch (e) {
        // Ignore cross-origin errors
      }
      try {
        window.blur();
      } catch (e) {}
    }
  }, [location.search]);

  const stateApplicant = location.state?.applicant as Applicant | undefined;
  const wasNavigated = Boolean(location.state?.applicant);

  const shouldSkipApplicantFetch = useMemo(() => {
    if (!id) return false;
    if (!wasNavigated || !stateApplicant) return false;
    const companiesReady =
      (Array.isArray(userCompaniesFromServer) &&
        userCompaniesFromServer.length > 0) ||
      (Array.isArray(userCompanies) && userCompanies.length > 0);
    const hasBasicApplicantData = !!(
      stateApplicant &&
      (stateApplicant._id || stateApplicant.email || stateApplicant.status)
    );
    return Boolean(companiesReady && hasBasicApplicantData);
  }, [
    id,
    wasNavigated,
    stateApplicant,
    userCompaniesFromServer,
    userCompanies,
  ]);

  const {
    data: fetchedApplicant,
    isLoading: isApplicantLoading,
    isFetched: isApplicantFetched,
    error: applicantError,
  } = useApplicant(id || '', {
    initialData: wasNavigated ? stateApplicant : undefined,
    enabled: !!id && !shouldSkipApplicantFetch,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
  });

  const applicant = (fetchedApplicant ?? stateApplicant) as any;
  const loading = isApplicantLoading && !fetchedApplicant && !stateApplicant;
  const error = applicantError as any;

  const applicantJobPosition = useMemo(() => {
    if (!applicant) return null;
    const jp =
      (applicant as any).jobPositionId || (applicant as any).jobPosition;
    if (jp && typeof jp === 'object') return jp;
    return null;
  }, [
    applicant?._id,
    (applicant as any)?.jobPositionId,
    (applicant as any)?.jobPosition,
  ]);

  const resolvedJobPosId = useMemo(() => {
    if (!applicant) return '';
    if (applicantJobPosition)
      return applicantJobPosition._id || applicantJobPosition.id || '';
    if (typeof (applicant as any).jobPositionId === 'string')
      return (applicant as any).jobPositionId;
    if (typeof (applicant as any).jobPosition === 'string')
      return (applicant as any).jobPosition;
    return '';
  }, [
    applicant?._id,
    applicantJobPosition,
    (applicant as any)?.jobPositionId,
    (applicant as any)?.jobPosition,
  ]);

  const jobPositionDetail = applicantJobPosition as any;
  const isJobPositionDetailFetched = Boolean(applicantJobPosition);

  const jobPosCompanyId = useMemo(() => {
    if (!applicantJobPosition) return '';
    const companyId = (applicantJobPosition as any).companyId;
    if (!companyId) return '';
    if (typeof companyId === 'string') return companyId;
    return companyId._id || companyId.id || '';
  }, [applicantJobPosition]);

  const applicantCompanyId = useMemo(() => {
    if (!applicant) return undefined;
    if (typeof applicant.companyId === 'string') return applicant.companyId;
    if (
      typeof applicant.companyId === 'object' &&
      (applicant.companyId as any)?._id
    )
      return (applicant.companyId as any)._id;
    return undefined;
  }, [applicant?._id, (applicant as any)?.companyId]);

  const userCompaniesById = useMemo(() => {
    const map = new Map<string, any>();
    (preferredUserCompanies || []).forEach((company: any) => {
      const id = String(company?._id || company?.id || '');
      if (id) map.set(id, company);
    });
    return map;
  }, [preferredUserCompanies]);

  const companies = useMemo(() => {
    const map = new Map<string, any>();
    const addCompany = (company: any) => {
      if (!company) return;
      const id = String(company?._id || company?.id || '');
      if (!id) return;
      if (!map.has(id)) map.set(id, company);
    };
    preferredUserCompanies.forEach(addCompany);
    if (applicant && typeof applicant.companyId === 'object')
      addCompany(applicant.companyId);
    if (
      applicantJobPosition &&
      typeof (applicantJobPosition as any).companyId === 'object'
    ) {
      addCompany((applicantJobPosition as any).companyId);
    }
    if ((applicant as any)?.company) addCompany((applicant as any).company);
    if ((applicant as any)?.companyObj)
      addCompany((applicant as any).companyObj);
    return Array.from(map.values());
  }, [preferredUserCompanies, applicant?._id, applicantJobPosition]);
  const isCompaniesWithApplicantsFetched = companies.length > 0;

  const jobPosCompanyFromList = useMemo(() => {
    if (!jobPosCompanyId) return null as any;
    return (
      (companies || []).find(
        (c: any) => String(c?._id || c?.id || '') === String(jobPosCompanyId)
      ) || null
    );
  }, [jobPosCompanyId, companies]);

  const jobPosCompany = useMemo(() => {
    if (jobPosCompanyFromList) return jobPosCompanyFromList;
    if (
      applicantJobPosition &&
      typeof (applicantJobPosition as any).companyId === 'object'
    ) {
      return (applicantJobPosition as any).companyId;
    }
    if (jobPosCompanyId && userCompaniesById.has(String(jobPosCompanyId))) {
      return userCompaniesById.get(String(jobPosCompanyId));
    }
    return null as any;
  }, [
    jobPosCompanyFromList,
    applicantJobPosition,
    jobPosCompanyId,
    userCompaniesById,
  ]);

  const isArabic = (s: any) =>
    typeof s === 'string' && /[\u0600-\u06FF]/.test(s);

  const resolvedCompanyId = useMemo(() => {
    if (!applicant) return '';
    if (applicantJobPosition) {
      const companyId = (applicantJobPosition as any).companyId;
      if (typeof companyId === 'string') return companyId;
      if (typeof companyId === 'object' && companyId?._id) return companyId._id;
    }
    if (typeof applicant.companyId === 'string') return applicant.companyId;
    if (
      typeof applicant.companyId === 'object' &&
      (applicant.companyId as any)?._id
    )
      return (applicant.companyId as any)._id;
    return '';
  }, [applicant?._id, applicantJobPosition, (applicant as any)?.companyId]);

  const companyFromMe = useMemo(() => {
    const idsToCheck = [resolvedCompanyId, jobPosCompanyId, applicantCompanyId]
      .map((value) => String(value || ''))
      .filter((value) => value);
    for (const companyId of idsToCheck) {
      if (userCompaniesById.has(companyId))
        return userCompaniesById.get(companyId);
    }
    if (preferredUserCompanies.length === 1) return preferredUserCompanies[0];
    return null as any;
  }, [
    resolvedCompanyId,
    jobPosCompanyId,
    applicantCompanyId,
    userCompaniesById,
    preferredUserCompanies,
  ]);

  const resolvedCompanyFromList = useMemo(() => {
    if (!resolvedCompanyId) return null as any;
    return (
      (companies || []).find(
        (c: any) => String(c?._id || c?.id || '') === String(resolvedCompanyId)
      ) || null
    );
  }, [resolvedCompanyId, companies]);

  const fetchedCompany = useMemo(() => {
    if (resolvedCompanyFromList) return resolvedCompanyFromList;
    if (applicant && typeof applicant.companyId === 'object')
      return applicant.companyId as any;
    if (
      applicantJobPosition &&
      typeof (applicantJobPosition as any).companyId === 'object'
    ) {
      return (applicantJobPosition as any).companyId;
    }
    return null as any;
  }, [resolvedCompanyFromList, applicant?._id, applicantJobPosition]);

  const jobPositions: any[] = [];

  const cvUrl = useMemo(() => {
    if (!applicant?.cvFilePath) return null;
    const path = applicant.cvFilePath;
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    return base ? `${base}/${path.replace(/^\//, '')}` : path;
  }, [applicant?.cvFilePath]);

  const buildCloudinaryDownloadUrl = (u: string) => {
    try {
      if (!u) return null;
      const urlParts = u.split('/upload/');
      if (urlParts.length !== 2) return null;
      const fileName = `CV_${applicant?.applicantNo ?? applicant?._id ?? 'cv'}`;
      const transformations = `f_auto/fl_attachment:${fileName}`;
      return `${urlParts[0]}/upload/${transformations}/${urlParts[1]}`;
    } catch (e) {
      return null;
    }
  };

  const downloadCv = async () => {
    if (!applicant?.cvFilePath) {
      Swal.fire('No CV', 'No CV file available for this applicant', 'info');
      return;
    }
    const url = cvUrl ?? applicant.cvFilePath;

    const downloadViaFetch = async (u: string, filename?: string) => {
      try {
        const res = await fetch(u, { mode: 'cors' });
        if (!res.ok) throw new Error('Network response not ok');
        const blob = await res.blob();
        const a = document.createElement('a');
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.download = filename || u.split('/').pop() || 'download';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        return true;
      } catch (err) {
        return false;
      }
    };

    const cloudUrl = buildCloudinaryDownloadUrl(url);
    if (cloudUrl) {
      window.open(cloudUrl, '_blank');
      return;
    }

    const ok = await downloadViaFetch(url, undefined);
    if (ok) return;
    window.open(url, '_blank');
  };

  const updateApplicantMutation = useUpdateApplicant();
  const updateStatusMutation = useUpdateApplicantStatus();
  const scheduleInterviewMutation = useScheduleInterview();
  const updateInterviewMutation = useUpdateInterviewStatus();
  const addCommentMutation = useAddComment();
  const sendEmailMutation = useSendEmail();
  const sendMessageMutation = useSendMessage();
  const markSeenMutation = useMarkApplicantSeen();
  const hasMarkedSeenRef = useRef(false);

  useEffect(() => {
    hasMarkedSeenRef.current = false;
  }, [id]);

  useEffect(() => {
    if (!applicant?._id || !user?._id || hasMarkedSeenRef.current) return;
    const userId = user._id as string;

    const seenBy = (applicant as any).seenBy ?? [];
    if (Array.isArray(seenBy) && seenBy.includes(userId)) {
      hasMarkedSeenRef.current = true;
      return;
    }

    hasMarkedSeenRef.current = true;
    try {
      queryClient.setQueryData(
        applicantsKeys.detail(applicant._id),
        (old: any) => {
          if (!old) return old;
          const cur = old.seenBy ?? [];
          if (Array.isArray(cur) && cur.includes(userId)) return old;
          return {
            ...old,
            seenBy: Array.isArray(cur) ? [...cur, userId] : [userId],
          };
        }
      );

      try {
        queryClient.setQueriesData(
          { queryKey: applicantsKeys.lists() },
          (old: any) => {
            if (!old) return old;
            const addSeenTo = (arr: any[]) =>
              arr.map((a: any) => {
                if (!a) return a;
                if ((a._id || a.id) !== (applicant._id || applicant.id))
                  return a;
                const cur = a.seenBy ?? [];
                if (Array.isArray(cur) && cur.includes(userId)) return a;
                return {
                  ...a,
                  seenBy: Array.isArray(cur) ? [...cur, userId] : [userId],
                };
              });

            if (Array.isArray(old)) return addSeenTo(old);
            if (old.data && Array.isArray(old.data))
              return { ...old, data: addSeenTo(old.data) };
            return old;
          }
        );
      } catch (e) {}

      markSeenMutation.mutate(applicant._id);
    } catch (e) {}
  }, [applicant?._id, user?._id]);

  const getJobTitle = (): { en: string } => {
    if (!applicant) return { en: '' };
    const jobPos =
      applicantJobPosition ||
      (typeof applicant.jobPositionId === 'object'
        ? applicant.jobPositionId
        : null);
    if (jobPos && (jobPos as any).title) {
      const title = (jobPos as any).title;
      if (typeof title === 'string') return { en: title };
      if (typeof title === 'object' && title?.en) return { en: title.en };
    }
    return { en: '' };
  };

  const getCompanyName = () => {
    if (!applicant) return '';
    if (jobPosCompany && (jobPosCompany as any).name) {
      return toPlainString((jobPosCompany as any).name);
    }
    if (
      applicantJobPosition &&
      typeof (applicantJobPosition as any).companyId === 'object'
    ) {
      const comp = (applicantJobPosition as any).companyId;
      if (comp?.name) return toPlainString(comp.name);
    }
    if (
      typeof applicant.companyId === 'object' &&
      (applicant.companyId as any)?.name
    ) {
      return toPlainString((applicant.companyId as any).name);
    }
    const compId =
      typeof applicant.companyId === 'string'
        ? applicant.companyId
        : (applicant.companyId as any)?._id;
    const foundCompany = companies.find((c) => c._id === compId);
    return foundCompany ? toPlainString((foundCompany as any).name) : '';
  };

  const getDepartmentName = () => {
    if (!applicant) return '';
    if (applicantJobPosition && (applicantJobPosition as any).departmentId) {
      const jp = applicantJobPosition as any;
      if (jobPosCompany && (jobPosCompany as any).departments) {
        const deps = (jobPosCompany as any).departments || [];
        const depId =
          typeof jp.departmentId === 'string'
            ? jp.departmentId
            : jp.departmentId?._id;
        const found = deps.find(
          (d: any) =>
            d._id === depId || d === depId || String(d._id) === String(depId)
        );
        if (found) return toPlainString(found.name || found);
      }
      if (typeof jp.departmentId === 'object' && jp.departmentId?.name)
        return toPlainString(jp.departmentId.name);
      const depId =
        typeof jp.departmentId === 'string'
          ? jp.departmentId
          : jp.departmentId?._id;
      if (depId) {
        for (const c of companies) {
          const deps = (c as any).departments || [];
          const found = deps.find(
            (d: any) =>
              d._id === depId || d === depId || String(d._id) === String(depId)
          );
          if (found) return toPlainString(found.name || found);
        }
      }
    }
    if (
      typeof applicant.departmentId === 'object' &&
      (applicant.departmentId as any)?.name
    ) {
      return toPlainString((applicant.departmentId as any).name);
    }
    return '';
  };

  const getBirthDateValue = () => {
    if (!applicant) return null;
    return (
      applicant.birthDate ||
      (applicant as any).birthdate ||
      applicant.customResponses?.birthdate ||
      applicant.customResponses?.birthDate ||
      applicant.customResponses?.['تاريخ_الميلاد'] ||
      applicant.customResponses?.['تاريخ الميلاد'] ||
      (applicant as any)['تاريخ_الميلاد'] ||
      (applicant as any)['تاريخ الميلاد'] ||
      null
    );
  };

  const getGenderValue = () => {
    if (!applicant) return null;
    return (
      applicant.gender ||
      applicant.customResponses?.gender ||
      applicant.customResponses?.['النوع'] ||
      applicant.customResponses?.['gender'] ||
      (applicant as any)['النوع'] ||
      null
    );
  };

  const normalizeGenderLocal = (raw: any) => {
    if (raw === null || raw === undefined) return '';
    const s = String(raw).trim();
    if (!s) return '';
    const lower = s.toLowerCase();
    const arabicMale = ['ذكر', 'ذَكر', 'ذكرً'];
    const arabicFemale = ['انثى', 'أنثى', 'انثي', 'انسه', 'أنسه', 'انثا'];
    if (arabicMale.includes(s) || arabicMale.includes(lower)) return 'Male';
    if (arabicFemale.includes(s) || arabicFemale.includes(lower))
      return 'Female';
    if (lower === 'male' || lower === 'm') return 'Male';
    if (lower === 'female' || lower === 'f') return 'Female';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const isInvalidAddressString = (value: string) => {
    const s = String(value || '').trim();
    if (!s) return true;
    if (/^[a-f0-9]{24}$/i.test(s)) return true;
    if (
      (s.startsWith('{') && s.endsWith('}')) ||
      (s.startsWith('[') && s.endsWith(']'))
    )
      return true;
    return false;
  };

  const getCompanyAddress = () => {
    if (!applicant) return '';
    const company: any =
      companyObj ||
      fetchedCompany ||
      jobPosCompany ||
      (typeof applicant.companyId === 'object' ? applicant.companyId : null);
    if (!company) return '';
    const addrCandidates: any =
      company.address ??
      company.addresses ??
      company.location ??
      company.locations ??
      company.officeAddress ??
      null;
    let addr: any = null;
    if (addrCandidates) {
      addr = Array.isArray(addrCandidates) ? addrCandidates[0] : addrCandidates;
    }
    if (!addr) {
      for (const key of Object.keys(company)) {
        if (/address|location/i.test(key)) {
          const v = (company as any)[key];
          if (!v) continue;
          addr = Array.isArray(v) ? v[0] : v;
          break;
        }
      }
    }
    const resolved = addr ? toPlainString(addr) : '';
    if (resolved && resolved.trim() && !isInvalidAddressString(resolved)) {
      return resolved.trim();
    }
    return '';
  };

  useEffect(() => {
    return () => {
      setTimeout(() => {
        try {
          const p = window.location.pathname || '';
          const inApplicantsPages =
            p.startsWith('/applicant-details') || p.startsWith('/applicants');
          if (!inApplicantsPages) {
            try {
              localStorage.removeItem('applicants_table_state');
            } catch (e) {
              /* ignore */
            }
            try {
              sessionStorage.removeItem('applicants_table_state');
            } catch (e) {
              /* ignore */
            }
          }
        } catch (e) {}
      }, 0);
    };
  }, []);

  const fillCompanyAddress = (): boolean => {
    try {
      const comp = companyObj || fetchedCompany || jobPosCompany;
      if (!comp) {
        return false;
      }
      const addrCandidates: any =
        comp.address ??
        comp.addresses ??
        comp.location ??
        comp.locations ??
        comp.officeAddress ??
        null;
      let addr: any = null;
      if (addrCandidates) {
        addr = Array.isArray(addrCandidates)
          ? addrCandidates[0]
          : addrCandidates;
      }
      if (!addr) {
        for (const key of Object.keys(comp)) {
          if (/address|location/i.test(key)) {
            const v = (comp as any)[key];
            if (!v) continue;
            addr = Array.isArray(v) ? v[0] : v;
            break;
          }
        }
      }
      const resolved = addr ? toPlainString(addr) : '';
      if (resolved && resolved.trim() && !isInvalidAddressString(resolved)) {
        setInterviewForm((prev) => ({ ...prev, location: resolved.trim() }));
        return true;
      }
      return false;
    } catch (e) {
      console.error('fillCompanyAddress error', e);
      return false;
    }
  };

  const companyObj = useMemo(() => {
    if (!applicant) return null as any;
    if (jobPosCompany) return jobPosCompany as any;
    if ((fetchedCompany as any) && (fetchedCompany as any)?._id)
      return fetchedCompany as any;
    if (resolvedCompanyFromList) return resolvedCompanyFromList as any;
    if (
      applicantJobPosition &&
      typeof (applicantJobPosition as any).companyId === 'object'
    ) {
      const company = (applicantJobPosition as any).companyId;
      if (company?._id) return company;
    }
    if (
      typeof applicant.companyId === 'object' &&
      (applicant.companyId as any)?._id
    )
      return applicant.companyId as any;
    const compId = resolvedCompanyId || applicantCompanyId;
    if (compId && userCompaniesById.has(String(compId))) {
      return userCompaniesById.get(String(compId)) as any;
    }
    return null as any;
  }, [
    applicant?._id,
    jobPosCompany,
    fetchedCompany,
    resolvedCompanyFromList,
    applicantJobPosition,
    resolvedCompanyId,
    applicantCompanyId,
    userCompaniesById,
  ]);

  const {
    getColor,
    getTextColor,
    defaultStatus: hookDefaultStatus,
  } = useStatusSettings(companyObj || jobPosCompany || fetchedCompany);

  const getStatusColor = (status: string) => {
    const bgColor = getColor(status);
    const textColor = getTextColor(status);
    return { backgroundColor: bgColor, color: textColor };
  };

  const jobTitle = useMemo(
    () => getJobTitle(),
    [applicant?._id, applicantJobPosition]
  );
  const companyName = useMemo(
    () => getCompanyName(),
    [applicant?._id, applicantJobPosition, companies, jobPosCompany]
  );
  const departmentName = useMemo(
    () => getDepartmentName(),
    [applicant?._id, applicantJobPosition, companies, jobPosCompany]
  );

  const [phoneMenuAnchor, setPhoneMenuAnchor] = useState<null | HTMLElement>(
    null
  );
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>('');
  const [lastRefetch, setLastRefetch] = useState<Date | null>(null);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showInterviewSettingsModal, setShowInterviewSettingsModal] =
    useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<any>(null);
  const [formResetKey, setFormResetKey] = useState(0);

  const [interviewForm, setInterviewForm] = useState<{
    date: string;
    time: string;
    description: string;
    comment: string;
    location: string;
    link: string;
    type: 'phone' | 'video' | 'in-person';
    conductedBy?: string;
  }>({
    date: '',
    time: '',
    description: '',
    comment: '',
    location: '',
    link: '',
    type: 'phone' as 'phone' | 'video' | 'in-person',
  });

  useEffect(() => {
    if (!showInterviewModal) return;
    if (interviewForm.location && interviewForm.location.trim() !== '') return;
    try {
      const addr = getCompanyAddress();
      if (addr) setInterviewForm((prev) => ({ ...prev, location: addr }));
    } catch (e) {}
  }, [fetchedCompany, showInterviewModal]);

  useEffect(() => {
    if (
      !lastRefetch &&
      (isApplicantFetched ||
        isCompaniesWithApplicantsFetched ||
        isJobPositionDetailFetched)
    ) {
      setLastRefetch(new Date());
    }
  }, [
    isApplicantFetched,
    isCompaniesWithApplicantsFetched,
    isJobPositionDetailFetched,
  ]);

  const [notificationChannels, setNotificationChannels] = useState({
    email: true,
    sms: false,
    whatsapp: false,
  });
  const [emailOption, setEmailOption] = useState<'company' | 'user' | 'custom'>(
    'company'
  );
  const [customEmail, setCustomEmail] = useState('');
  const [phoneOption, setPhoneOption] = useState<
    'company' | 'user' | 'whatsapp' | 'custom'
  >('company');
  const [customPhone, setCustomPhone] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [interviewEmailSubject, setInterviewEmailSubject] = useState(
    'Interview Invitation'
  );
  const [isSubmittingInterview, setIsSubmittingInterview] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [commentForm, setCommentForm] = useState({
    text: '',
  });
  const [statusForm, setStatusForm] = useState({
    status: '' as Applicant['status'] | '',
    notes: '',
    reasons: [] as string[],
  });

  const [interviewError, setInterviewError] = useState('');
  const [commentError, setCommentError] = useState('');
  const [statusError, setStatusError] = useState('');

  type InterviewEditFormState = {
    fullName: string;
    email: string;
    phone: string;
    gender: string;
    birthDate: string;
    address: string;
    expectedSalary: string;
    customResponses: Record<string, any>;
    jobSpecsResponses: Array<{ jobSpecId: string; answer: boolean }>;
  };

  type InterviewQuestionDraft = {
    localId: string;
    question: string;
    score: number;
    achievedScore: number;
    notes: string;
    source: 'group' | 'existing';
    answerType: string;
    includeInTotal: boolean;
    groupId?: string;
    groupName?: string;
    choices?: string[];
  };

  type CompanyInterviewGroup = {
    id: string;
    name: string;
    questions: Array<{
      question: string;
      score: number;
      answerType: string;
      choices?: string[];
    }>;
  };

  type InterviewTargetMode = 'existing' | 'new';

  const toInputDate = (value: any): string => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  };

  const normalizeSpecId = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return value._id || value.id || '';
    return '';
  };

  const normalizeLookupToken = (value: any): string => {
    return String(value || '')
      .toLowerCase()
      .replace(/\u200e|\u200f/g, '')
      .replace(/[^\w\u0600-\u06FF\s]/g, ' ')
      .replace(/[\s_-]+/g, '')
      .trim();
  };

  // State for edit-only mode
  const [isEditOnlyMode, setIsEditOnlyMode] = useState(false);

  const openEditOnlyMode = () => {
    if (!canManageApplicant) return;
    if (!applicant) return;

    const availableCustomFields = getAvailableCustomFieldsForInterview();

    const rawCustomResponses =
      applicant?.customResponses &&
      typeof applicant.customResponses === 'object'
        ? applicant.customResponses
        : applicant?.customFieldResponses &&
            typeof applicant.customFieldResponses === 'object'
          ? applicant.customFieldResponses
          : {};

    const mappedResponseKeys = new Set<string>();
    const nextCustomResponses: Record<string, any> = {};

    availableCustomFields.forEach((field: any, fieldIndex: number) => {
      const fieldId = getCustomFieldId(field, fieldIndex);
      const matchedKey = findMatchingResponseKeyForField(
        field,
        rawCustomResponses
      );
      if (matchedKey) mappedResponseKeys.add(matchedKey);
      const rawValue =
        matchedKey &&
        Object.prototype.hasOwnProperty.call(rawCustomResponses, matchedKey)
          ? rawCustomResponses[matchedKey]
          : rawCustomResponses[fieldId];

      nextCustomResponses[fieldId] = coerceCustomFieldValueForForm(
        field,
        rawValue
      );
    });

    const unmappedCustomResponses = Object.fromEntries(
      Object.entries(rawCustomResponses).filter(
        ([key]) => !mappedResponseKeys.has(key)
      )
    );

    const inferredCustomFields = buildInferredCustomFieldsFromResponses(
      unmappedCustomResponses
    );

    inferredCustomFields.forEach((field: any, inferredIndex: number) => {
      const fieldId = getCustomFieldId(
        field,
        availableCustomFields.length + inferredIndex
      );
      const rawValue = rawCustomResponses[fieldId];
      nextCustomResponses[fieldId] = coerceCustomFieldValueForForm(
        field,
        rawValue
      );
    });

    setInterviewUnmappedCustomResponses(unmappedCustomResponses);
    setInterviewEditableCustomFields([
      ...availableCustomFields,
      ...inferredCustomFields,
    ]);

    setInterviewEditForm({
      fullName: applicant?.fullName ? String(applicant.fullName) : '',
      email: applicant?.email ? String(applicant.email) : '',
      phone: applicant?.phone ? String(applicant.phone) : '',
      gender: applicant?.gender ? normalizeGenderLocal(applicant.gender) : '',
      birthDate: toInputDate(getBirthDateValue()),
      address: applicant?.address ? String(applicant.address) : '',
      expectedSalary:
        applicant?.expectedSalary !== undefined &&
        applicant?.expectedSalary !== null
          ? String(applicant.expectedSalary)
          : '',
      customResponses: nextCustomResponses,
      jobSpecsResponses: buildInitialJobSpecsResponses(applicant, []),
    });

    setIsEditOnlyMode(true);
    setIsInterviewEditMode(false);
  };

  const handleEditSave = async () => {
    if (!id || !applicant) return;

    const expectedSalaryValue =
      interviewEditForm.expectedSalary.trim() === ''
        ? undefined
        : Number(interviewEditForm.expectedSalary);

    if (
      expectedSalaryValue !== undefined &&
      (!Number.isFinite(expectedSalaryValue) ||
        Number.isNaN(expectedSalaryValue))
    ) {
      Swal.fire(
        'Invalid Salary',
        'Expected salary must be a valid number.',
        'error'
      );
      return;
    }

    const availableCustomFields =
      interviewEditableCustomFields.length > 0
        ? interviewEditableCustomFields
        : getAvailableCustomFieldsForInterview();

    const customResponsesPayload: Record<string, any> = {
      ...(interviewUnmappedCustomResponses || {}),
    };

    availableCustomFields.forEach((field: any, fieldIndex: number) => {
      const fieldId = getCustomFieldId(field, fieldIndex);
      customResponsesPayload[fieldId] = coerceCustomFieldValueForPayload(
        field,
        interviewEditForm.customResponses[fieldId]
      );
    });

    const availableSpecs = getAvailableJobSpecsForInterview();
    const jobSpecsResponseMap = new Map<string, boolean>();

    interviewEditForm.jobSpecsResponses
      .filter((r) => Boolean(r?.jobSpecId))
      .forEach((r) => {
        jobSpecsResponseMap.set(String(r.jobSpecId), Boolean(r.answer));
      });

    (availableSpecs || []).forEach((s: any) => {
      const specId = normalizeSpecId(s?.jobSpecId ?? s?._id ?? s?.id);
      if (!specId) return;
      if (!jobSpecsResponseMap.has(String(specId))) {
        jobSpecsResponseMap.set(String(specId), false);
      }
    });

    const payload: any = {
      fullName: interviewEditForm.fullName.trim(),
      email: interviewEditForm.email.trim(),
      phone: interviewEditForm.phone.trim(),
      gender: interviewEditForm.gender.trim(),
      address: interviewEditForm.address.trim(),
      customResponses: customResponsesPayload,
      jobSpecsResponses: Array.from(jobSpecsResponseMap.entries()).map(
        ([jobSpecId, answer]) => ({
          jobSpecId: String(jobSpecId),
          answer: Boolean(answer),
        })
      ),
    };

    if (interviewEditForm.birthDate)
      payload.birthDate = interviewEditForm.birthDate;
    if (expectedSalaryValue !== undefined)
      payload.expectedSalary = expectedSalaryValue;

    try {
      setIsSavingInterviewEdit(true);
      await updateApplicantMutation.mutateAsync({ id, data: payload });

      setIsInterviewEditMode(false);
      setIsEditOnlyMode(false);
      setInterviewTargetMode('existing');
      setInterviewTargetId('');
      setSelectedQuestionGroupIds([]);
      setInterviewQuestionDrafts([]);
      setInterviewEditableCustomFields([]);

      Swal.fire('Saved', 'Applicant data was updated successfully.', 'success');
    } catch (err: any) {
      Swal.fire('Update Failed', getErrorMessage(err), 'error');
    } finally {
      setIsSavingInterviewEdit(false);
    }
  };

  const handleEditCancel = () => {
    setIsInterviewEditMode(false);
    setIsEditOnlyMode(false);
    setInterviewTargetMode('existing');
    setInterviewTargetId('');
    setSelectedQuestionGroupIds([]);
    setInterviewQuestionDrafts([]);
    setInterviewEditableCustomFields([]);
  };

  const inferGroupIdsFromInterview = (interview: any): string[] => {
    try {
      if (
        !interview ||
        !Array.isArray(interview.questions) ||
        companyInterviewGroups.length === 0
      )
        return [];
      const qSet = new Set<string>();
      for (const q of interview.questions) {
        const t = normalizeLookupToken(
          q?.question ?? q?.notes ?? q?.answer ?? ''
        );
        if (t) qSet.add(t);
      }
      const matched: string[] = [];
      for (const g of companyInterviewGroups) {
        if (!g || !Array.isArray(g.questions) || g.questions.length === 0)
          continue;
        const groupTokens = g.questions
          .map((qq: any) => normalizeLookupToken(qq?.question || ''))
          .filter(Boolean);
        if (groupTokens.length === 0) continue;
        let common = 0;
        for (const gt of groupTokens) if (qSet.has(gt)) common++;
        const threshold = Math.max(1, Math.ceil(groupTokens.length / 2));
        if (common >= threshold) matched.push(String(g.id || g.name || ''));
      }
      return Array.from(new Set(matched)).filter(Boolean);
    } catch (e) {
      return [];
    }
  };

  const isPlainObject = (value: any): value is Record<string, any> => {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  };

  const formatCustomResponseKeyLabel = (key: string): string => {
    if (!key) return 'Custom Field';
    if (/[\u0600-\u06FF]/.test(key)) {
      return key.replace(/[_-]+/g, ' ');
    }
    return key
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  };

  const looksLikeDateValue = (value: string): boolean => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return false;
    if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(trimmed)) {
      return !Number.isNaN(Date.parse(trimmed));
    }
    if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(trimmed)) {
      return !Number.isNaN(Date.parse(trimmed));
    }
    return false;
  };

  const inferCustomResponseInputType = (rawValue: any): string => {
    if (Array.isArray(rawValue)) {
      if (rawValue.length === 0) return 'tags';
      if (rawValue.every((item) => isPlainObject(item)))
        return 'repeatable_group';
      if (rawValue.every((item) => typeof item === 'boolean'))
        return 'checkbox';
      return 'tags';
    }
    if (typeof rawValue === 'boolean') return 'checkbox';
    if (typeof rawValue === 'number') return 'number';
    if (isPlainObject(rawValue)) return 'json';
    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (!trimmed) return 'text';
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'email';
      if (/^https?:\/\/\S+$/i.test(trimmed)) return 'url';
      if (looksLikeDateValue(trimmed)) return 'date';
      if (/^\+?[0-9()\-\s]{7,}$/.test(trimmed)) return 'phone';
      if (trimmed.includes('\n') || trimmed.length > 180) return 'textarea';
      if (
        trimmed.toLowerCase() === 'true' ||
        trimmed.toLowerCase() === 'false'
      ) {
        return 'checkbox';
      }
    }
    return 'text';
  };

  const getCustomFieldId = (field: any, index: number): string => {
    return String(field?.fieldId || `field_${index}`);
  };

  const getCustomFieldLabelText = (field: any): string => {
    return toPlainString(field?.label) || field?.fieldId || 'Custom Field';
  };

  const getCustomFieldChoices = (field: any): string[] => {
    if (!Array.isArray(field?.choices)) return [];
    return field.choices
      .map((choice: any) => toPlainString(choice))
      .filter(Boolean);
  };

  const getCustomFieldGroupFields = (field: any): any[] => {
    if (Array.isArray(field?.groupFields)) return field.groupFields;
    if (Array.isArray(field?.subFields)) return field.subFields;
    return [];
  };

  const inferRepeatableGroupFields = (rows: any[]): any[] => {
    const keys = new Set<string>();
    (rows || []).forEach((row: any) => {
      if (!isPlainObject(row)) return;
      Object.keys(row).forEach((key) => {
        if (key) keys.add(String(key));
      });
    });
    return Array.from(keys).map((key, index) => {
      const sampleValue = (rows || []).find(
        (row: any) => isPlainObject(row) && row[key] !== undefined
      )?.[key];
      const inferredTypeRaw = inferCustomResponseInputType(sampleValue);
      const inferredType =
        inferredTypeRaw === 'repeatable_group' ? 'json' : inferredTypeRaw;
      return {
        fieldId: key,
        label: formatCustomResponseKeyLabel(key),
        inputType: inferredType,
        displayOrder: index,
        __inferredFromResponse: true,
      };
    });
  };

  const formatWhatsAppNumber = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith('2')) {
      cleaned = '2' + cleaned;
    }
    if (cleaned.startsWith('200')) {
      return cleaned;
    }
    if (cleaned.startsWith('20') && !cleaned.startsWith('200')) {
      cleaned = '20' + cleaned.substring(2);
    }
    return cleaned;
  };

  const copyPhoneNumber = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      Swal.fire({
        title: 'Copied!',
        text: 'Phone number copied to clipboard.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        position: 'center',
      });
    } catch (err) {
      console.error('Failed to copy:', err);
      Swal.fire({
        title: 'Error',
        text: 'Failed to copy phone number.',
        icon: 'error',
        timer: 1500,
        showConfirmButton: false,
      });
    }
  };

  const makePhoneCall = (phone: string) => {
    const cleaned = phone.replace(/[^\d+]/g, '');
    window.location.href = `tel:${cleaned}`;
  };

  const openWhatsApp = (phone: string) => {
    const formattedNumber = formatWhatsAppNumber(phone);
    const url = `https://wa.me/${formattedNumber}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handlePhoneClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    phone: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedPhoneNumber(phone);
    setPhoneMenuAnchor(event.currentTarget);
  };

  const handlePhoneMenuClose = () => {
    setPhoneMenuAnchor(null);
    setSelectedPhoneNumber('');
  };

  const buildInferredCustomFieldsFromResponses = (
    responses: Record<string, any>
  ): any[] => {
    return Object.entries(responses || {}).map(([key, value], index) => {
      const inferredType = inferCustomResponseInputType(value);
      return {
        fieldId: String(key),
        label: formatCustomResponseKeyLabel(String(key)),
        inputType: inferredType,
        groupFields:
          inferredType === 'repeatable_group'
            ? inferRepeatableGroupFields(Array.isArray(value) ? value : [])
            : undefined,
        displayOrder: 10000 + index,
        __inferredFromResponse: true,
      };
    });
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
    const directCandidates = [
      field?.label?.en,
      field?.label?.ar,
      toPlainString(field?.label),
    ]
      .filter(Boolean)
      .map((v) => String(v));
    for (const candidate of directCandidates) {
      if (Object.prototype.hasOwnProperty.call(responses, candidate)) {
        return candidate;
      }
    }
    const normalizedTargets = new Set<string>();
    [fieldId, ...directCandidates].filter(Boolean).forEach((token) => {
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

  const coerceCustomFieldValueForForm = (field: any, rawValue: any): any => {
    const inputType = String(
      field?.inputType || inferCustomResponseInputType(rawValue) || 'text'
    ).toLowerCase();
    if (inputType === 'repeatable_group') {
      if (!Array.isArray(rawValue)) return [];
      return rawValue.map((row: any) =>
        row && typeof row === 'object' && !Array.isArray(row) ? { ...row } : {}
      );
    }
    if (inputType === 'json') {
      if (rawValue === undefined || rawValue === null || rawValue === '')
        return '';
      if (typeof rawValue === 'string') {
        const trimmed = rawValue.trim();
        if (!trimmed) return '';
        try {
          return JSON.stringify(JSON.parse(trimmed), null, 2);
        } catch {
          return rawValue;
        }
      }
      try {
        return JSON.stringify(rawValue, null, 2);
      } catch {
        return String(rawValue);
      }
    }
    if (inputType === 'checkbox') {
      const choices = getCustomFieldChoices(field);
      if (choices.length === 0) {
        if (typeof rawValue === 'boolean') return rawValue;
        if (typeof rawValue === 'string') {
          const lowered = rawValue.trim().toLowerCase();
          if (lowered === 'true') return true;
          if (lowered === 'false') return false;
        }
        if (rawValue === undefined || rawValue === null || rawValue === '')
          return false;
        return Boolean(rawValue);
      }
      if (Array.isArray(rawValue)) return rawValue.map((v: any) => String(v));
      if (typeof rawValue === 'string') {
        return rawValue
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
      }
      if (rawValue === undefined || rawValue === null || rawValue === '')
        return [];
      return [String(rawValue)];
    }
    if (inputType === 'tags') {
      if (Array.isArray(rawValue)) return rawValue.map((v: any) => String(v));
      if (typeof rawValue === 'string') {
        return rawValue
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
      }
      if (rawValue === undefined || rawValue === null || rawValue === '')
        return [];
      return [String(rawValue)];
    }
    if (inputType === 'number') {
      if (rawValue === undefined || rawValue === null || rawValue === '')
        return '';
      return String(rawValue);
    }
    if (inputType === 'date') {
      return rawValue ? toInputDate(rawValue) : '';
    }
    if (rawValue === undefined || rawValue === null) return '';
    return String(rawValue);
  };

  const coerceCustomFieldValueForPayload = (field: any, rawValue: any): any => {
    const inputType = String(
      field?.inputType || inferCustomResponseInputType(rawValue) || 'text'
    ).toLowerCase();
    if (inputType === 'repeatable_group') {
      const rows = Array.isArray(rawValue) ? rawValue : [];
      const groupFields = getCustomFieldGroupFields(field);
      return rows.map((row: any) => {
        const normalizedRow =
          row && typeof row === 'object' && !Array.isArray(row)
            ? { ...row }
            : {};
        groupFields.forEach((subField: any, subIndex: number) => {
          const subFieldId = getCustomFieldId(subField, subIndex);
          normalizedRow[subFieldId] = coerceCustomFieldValueForPayload(
            subField,
            normalizedRow[subFieldId]
          );
        });
        return normalizedRow;
      });
    }
    if (inputType === 'json') {
      if (rawValue === undefined || rawValue === null || rawValue === '')
        return '';
      if (typeof rawValue === 'string') {
        const trimmed = rawValue.trim();
        if (!trimmed) return '';
        try {
          return JSON.parse(trimmed);
        } catch {
          return rawValue;
        }
      }
      return rawValue;
    }
    if (inputType === 'checkbox') {
      const choices = getCustomFieldChoices(field);
      if (choices.length === 0) {
        if (typeof rawValue === 'boolean') return rawValue;
        if (typeof rawValue === 'string') {
          const lowered = rawValue.trim().toLowerCase();
          if (lowered === 'true') return true;
          if (lowered === 'false') return false;
        }
        return Boolean(rawValue);
      }
      if (Array.isArray(rawValue)) return rawValue.map((v: any) => String(v));
      if (typeof rawValue === 'string') {
        return rawValue
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
      }
      if (rawValue === undefined || rawValue === null || rawValue === '')
        return [];
      return [String(rawValue)];
    }
    if (inputType === 'tags') {
      if (Array.isArray(rawValue)) return rawValue.map((v: any) => String(v));
      if (typeof rawValue === 'string') {
        return rawValue
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
      }
      if (rawValue === undefined || rawValue === null || rawValue === '')
        return [];
      return [String(rawValue)];
    }
    if (inputType === 'number') {
      if (rawValue === undefined || rawValue === null || rawValue === '')
        return '';
      const parsed = Number(rawValue);
      return Number.isFinite(parsed) ? parsed : rawValue;
    }
    if (inputType === 'date') {
      return rawValue ? toInputDate(rawValue) : '';
    }
    if (rawValue === undefined || rawValue === null) return '';
    return rawValue;
  };

  const extractArrayField = (source: any, key: string): any[] => {
    if (!source || typeof source !== 'object') return [];
    if (Array.isArray((source as any)?.[key])) return (source as any)[key];
    if (Array.isArray((source as any)?.data?.[key]))
      return (source as any).data[key];
    if (Array.isArray((source as any)?.data?.data?.[key]))
      return (source as any).data.data[key];
    return [];
  };

  const getAvailableCustomFieldsForInterview = () => {
    const fromDetail = extractArrayField(jobPositionDetail, 'customFields');
    if (fromDetail.length > 0) {
      return fromDetail;
    }
    const applicantCandidates = [
      applicant,
      fetchedApplicant,
      stateApplicant,
    ].filter(Boolean) as any[];
    for (const candidate of applicantCandidates) {
      const jobPosCandidates: any[] = [];
      if (
        candidate?.jobPositionId &&
        typeof candidate.jobPositionId === 'object'
      ) {
        jobPosCandidates.push(candidate.jobPositionId);
      }
      if (candidate?.jobPosition && typeof candidate.jobPosition === 'object') {
        jobPosCandidates.push(candidate.jobPosition);
      }
      for (const jobPos of jobPosCandidates) {
        const fields = extractArrayField(jobPos, 'customFields');
        if (fields.length > 0) {
          return fields;
        }
      }
    }
    if (resolvedJobPosId && Array.isArray(jobPositions)) {
      const found = jobPositions.find(
        (j: any) => String(j?._id ?? j?.id ?? '') === String(resolvedJobPosId)
      );
      const fromList = extractArrayField(found, 'customFields');
      if (fromList.length > 0) {
        return fromList;
      }
    }
    return [] as any[];
  };

  const getAvailableJobSpecsForInterview = () => {
    if (jobPositionDetail) {
      if (
        Array.isArray((jobPositionDetail as any).jobSpecsWithDetails) &&
        (jobPositionDetail as any).jobSpecsWithDetails.length
      ) {
        return (jobPositionDetail as any).jobSpecsWithDetails;
      }
      if (
        Array.isArray((jobPositionDetail as any).jobSpecs) &&
        (jobPositionDetail as any).jobSpecs.length
      ) {
        return (jobPositionDetail as any).jobSpecs;
      }
    }
    const populatedApplicant = (fetchedApplicant ??
      stateApplicant ??
      applicant) as any;
    const populatedJobPos =
      typeof populatedApplicant?.jobPositionId === 'object'
        ? populatedApplicant.jobPositionId
        : populatedApplicant?.jobPosition;
    if (populatedJobPos) {
      if (
        Array.isArray(populatedJobPos.jobSpecsWithDetails) &&
        populatedJobPos.jobSpecsWithDetails.length
      ) {
        return populatedJobPos.jobSpecsWithDetails;
      }
      if (
        Array.isArray(populatedJobPos.jobSpecs) &&
        populatedJobPos.jobSpecs.length
      ) {
        return populatedJobPos.jobSpecs;
      }
    }
    if (resolvedJobPosId && Array.isArray(jobPositions)) {
      const found = jobPositions.find(
        (j: any) => String(j?._id) === String(resolvedJobPosId)
      );
      if (found) {
        if (
          Array.isArray((found as any).jobSpecsWithDetails) &&
          (found as any).jobSpecsWithDetails.length
        ) {
          return (found as any).jobSpecsWithDetails;
        }
        if (
          Array.isArray((found as any).jobSpecs) &&
          (found as any).jobSpecs.length
        ) {
          return (found as any).jobSpecs;
        }
      }
    }
    return [] as any[];
  };

  const buildInitialJobSpecsResponses = (
    src: any,
    availableSpecs: any[] = []
  ) => {
    const answerMap = new Map<string, boolean>();
    const direct = Array.isArray(src?.jobSpecsResponses)
      ? src.jobSpecsResponses
      : [];
    const fromDirect = direct
      .map((r: any) => ({
        jobSpecId: normalizeSpecId(r?.jobSpecId ?? r?._id ?? r?.id),
        answer: typeof r?.answer === 'boolean' ? r.answer : Boolean(r?.answer),
      }))
      .filter((r: any) => Boolean(r.jobSpecId));
    fromDirect.forEach((r: any) =>
      answerMap.set(String(r.jobSpecId), Boolean(r.answer))
    );
    const fallbackSpecs = Array.isArray(src?.jobSpecsWithDetails)
      ? src.jobSpecsWithDetails
      : Array.isArray(src?.jobSpecs)
        ? src.jobSpecs
        : [];
    const fromFallback = fallbackSpecs
      .map((s: any) => ({
        jobSpecId: normalizeSpecId(s?.jobSpecId ?? s?._id ?? s?.id),
        answer: typeof s?.answer === 'boolean' ? s.answer : Boolean(s?.answer),
      }))
      .filter((r: any) => Boolean(r.jobSpecId));
    fromFallback.forEach((r: any) => {
      if (!answerMap.has(String(r.jobSpecId))) {
        answerMap.set(String(r.jobSpecId), Boolean(r.answer));
      }
    });
    (availableSpecs || []).forEach((s: any) => {
      const specId = normalizeSpecId(s?.jobSpecId ?? s?._id ?? s?.id);
      if (!specId) return;
      if (!answerMap.has(String(specId))) {
        answerMap.set(String(specId), false);
      }
    });
    return Array.from(answerMap.entries()).map(([jobSpecId, answer]) => ({
      jobSpecId,
      answer,
    }));
  };

  const companyInterviewGroups = useMemo<CompanyInterviewGroup[]>(() => {
    const sources: any[] = [companyObj, fetchedCompany, jobPosCompany];
    if (resolvedCompanyId) {
      const fromList = (companies || []).find(
        (c: any) => String(c?._id || c?.id || '') === String(resolvedCompanyId)
      );
      if (fromList) sources.push(fromList);
    }
    const normalizeGroups = (rawGroups: any[]): CompanyInterviewGroup[] => {
      return (rawGroups || [])
        .map((g: any, groupIndex: number) => {
          const groupId = String(g?._id || g?.id || `group_${groupIndex}`);
          const groupName = String(g?.name || `Group ${groupIndex + 1}`);
          const questions = Array.isArray(g?.questions)
            ? g.questions
                .map((q: any) => ({
                  question: String(q?.question || '').trim(),
                  score: Number(q?.score ?? 0),
                  answerType: String(q?.answerType || 'text').trim() || 'text',
                  choices: Array.isArray(q?.choices)
                    ? (q.choices as any[])
                        .map((c) => String(c ?? '').trim())
                        .filter(Boolean)
                    : [],
                }))
                .filter((q: any) => q.question)
            : [];
          return {
            id: groupId,
            name: groupName,
            questions,
          };
        })
        .filter((g: CompanyInterviewGroup) => g.questions.length > 0);
    };
    for (const source of sources) {
      if (!source || typeof source !== 'object') continue;
      const rawGroups =
        source?.settings?.interviewSettings?.groups ||
        source?.interviewSettings?.groups ||
        source?.settings?.groups ||
        source?.groups;
      if (Array.isArray(rawGroups) && rawGroups.length > 0) {
        return normalizeGroups(rawGroups);
      }
    }
    return [];
  }, [companyObj, fetchedCompany, jobPosCompany, companies, resolvedCompanyId]);

  const sortInterviewsByPriority = useCallback(
    (sourceInterviews: any[] = []) => {
      const rank: Record<string, number> = {
        in_progress: 4,
        scheduled: 3,
        completed: 2,
        cancelled: 1,
      };
      return [...(sourceInterviews || [])].sort((a: any, b: any) => {
        const ra = rank[String(a?.status || 'scheduled')] || 0;
        const rb = rank[String(b?.status || 'scheduled')] || 0;
        if (rb !== ra) return rb - ra;
        const ta = new Date(
          a?.startedAt || a?.scheduledAt || a?.issuedAt || 0
        ).getTime();
        const tb = new Date(
          b?.startedAt || b?.scheduledAt || b?.issuedAt || 0
        ).getTime();
        return tb - ta;
      });
    },
    []
  );

  const applicantInterviews = useMemo(() => {
    const interviews = Array.isArray((applicant as any)?.interviews)
      ? [...((applicant as any).interviews || [])]
      : [];
    return sortInterviewsByPriority(interviews);
  }, [
    applicant?._id,
    (applicant as any)?.interviews?.length,
    sortInterviewsByPriority,
  ]);

  const getPreferredInterviewToUpdate = useCallback(() => {
    return applicantInterviews[0] || null;
  }, [applicantInterviews]);

  const [isInterviewEditMode, setIsInterviewEditMode] = useState(false);
  const [isSavingInterviewEdit, setIsSavingInterviewEdit] = useState(false);
  const [
    interviewUnmappedCustomResponses,
    setInterviewUnmappedCustomResponses,
  ] = useState<Record<string, any>>({});
  const [interviewEditableCustomFields, setInterviewEditableCustomFields] =
    useState<any[]>([]);
  const [tagInputBuffers, setTagInputBuffers] = useState<
    Record<string, string>
  >({});

  const mergeTags = (current: any[], next: any[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    (Array.isArray(current) ? current : [])
      .concat(Array.isArray(next) ? next : [])
      .forEach((v: any) => {
        const s = String(v ?? '').trim();
        if (!s) return;
        const key = s.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(s);
        }
      });
    return out;
  };

  const [interviewEditForm, setInterviewEditForm] =
    useState<InterviewEditFormState>({
      fullName: '',
      email: '',
      phone: '',
      gender: '',
      birthDate: '',
      address: '',
      expectedSalary: '',
      customResponses: {},
      jobSpecsResponses: [],
    });

  const [interviewTargetMode, setInterviewTargetMode] =
    useState<InterviewTargetMode>('existing');
  const [interviewTargetId, setInterviewTargetId] = useState('');
  const [selectedQuestionGroupIds, setSelectedQuestionGroupIds] = useState<
    string[]
  >([]);
  const [interviewQuestionDrafts, setInterviewQuestionDrafts] = useState<
    InterviewQuestionDraft[]
  >([]);
  const lastResolvedInterviewIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isInterviewEditMode) return;

    const selectedGroups = companyInterviewGroups.filter((g) =>
      selectedQuestionGroupIds.includes(g.id)
    );

    const importedFromGroups: InterviewQuestionDraft[] = selectedGroups.flatMap(
      (group) =>
        group.questions.map((q, idx) => ({
          localId: `group_${group.id}_${idx}_${q.question}`,
          question: q.question,
          score: Number.isFinite(Number(q.score)) ? Number(q.score) : 0,
          achievedScore: Number.isFinite(Number(q.score)) ? Number(q.score) : 0,
          notes: '',
          source: 'group',
          answerType: String(q.answerType || 'text'),
          choices: Array.isArray((q as any).choices)
            ? (q as any).choices
                .map((c: any) => String(c ?? '').trim())
                .filter(Boolean)
            : [],
          includeInTotal: true,
          groupId: group.id,
          groupName: group.name,
        }))
    );

    const fallbackInterviewId = String(
      getPreferredInterviewToUpdate()?._id || ''
    );
    const resolvedInterviewId =
      interviewTargetMode === 'existing'
        ? String(interviewTargetId || fallbackInterviewId || '')
        : '';

    const selectedInterview = resolvedInterviewId
      ? applicantInterviews.find(
          (iv: any) => String(iv?._id || '') === resolvedInterviewId
        )
      : null;

    if (
      importedFromGroups.length === 0 &&
      selectedInterview &&
      Array.isArray(selectedInterview.questions) &&
      selectedInterview.questions.length > 0
    ) {
      const drafts: InterviewQuestionDraft[] = selectedInterview.questions.map(
        (q: any, idx: number) => ({
          localId: `iv_${String(selectedInterview._id || '')}_${idx}`,
          question: String(q?.question || '').trim(),
          score: Number.isFinite(Number(q?.score)) ? Number(q.score) : 0,
          achievedScore: Number.isFinite(Number(q?.achievedScore))
            ? Number(q.achievedScore)
            : Number.isFinite(Number(q?.score))
              ? Number(q.score)
              : 0,
          notes: String(q?.notes ?? q?.answer ?? ''),
          source: 'existing',
          answerType: String(q?.answerType || 'text'),
          choices: Array.isArray(q?.choices)
            ? (q.choices as any[])
                .map((c) => String(c ?? '').trim())
                .filter(Boolean)
            : [],
          includeInTotal: !(
            Number.isFinite(Number(q?.score)) && Number(q?.score) === 0
          ),
        })
      );
      setInterviewQuestionDrafts((prev) => {
        try {
          if (
            Array.isArray(prev) &&
            Array.isArray(drafts) &&
            prev.length === drafts.length
          ) {
            const same = prev.every(
              (p, i) => JSON.stringify(p) === JSON.stringify(drafts[i])
            );
            if (same) return prev;
          }
        } catch (e) {}
        return drafts;
      });
      return;
    }

    const selectedInterviewAnswerSeed = new Map<
      string,
      { achievedScore: number; notes: string; score: number }
    >();

    (Array.isArray(selectedInterview?.questions)
      ? selectedInterview.questions
      : []
    ).forEach((q: any) => {
      const key = String(q?.question || '')
        .trim()
        .toLowerCase();
      selectedInterviewAnswerSeed.set(key, {
        achievedScore: Number.isFinite(Number(q?.achievedScore))
          ? Number(q.achievedScore)
          : Number.isFinite(Number(q?.score))
            ? Number(q.score)
            : 0,
        notes: String(q?.notes || ''),
        score: Number.isFinite(Number(q?.score)) ? Number(q.score) : 0,
      });
    });

    const prevResolvedId = lastResolvedInterviewIdRef.current;
    const isSwitchingInterview =
      prevResolvedId !== null &&
      String(prevResolvedId) !== String(resolvedInterviewId);

    setInterviewQuestionDrafts((prev) => {
      const previousAnswers = new Map<string, InterviewQuestionDraft>();
      if (!isSwitchingInterview) {
        (prev || []).forEach((q) => {
          const key = `${q.groupId || ''}::${q.question}::${q.score}`;
          previousAnswers.set(key, q);
        });
      }
      const mergedGroupQuestions = importedFromGroups.map((q) => {
        const key = `${q.groupId || ''}::${q.question}::${q.score}`;
        const previous = previousAnswers.get(key);
        const interviewSeed = selectedInterviewAnswerSeed.get(
          String(q.question || '')
            .trim()
            .toLowerCase()
        );
        const includeFromSeed =
          interviewSeed && Number(q.score) > 0
            ? Number(interviewSeed.score) > 0
            : true;
        return {
          ...q,
          achievedScore: previous
            ? Number(
                previous.achievedScore ??
                  (Number.isFinite(Number(q.score)) ? Number(q.score) : 0)
              )
            : Number(
                interviewSeed?.achievedScore ??
                  (Number.isFinite(Number(q.score)) ? Number(q.score) : 0)
              ),
          notes: previous?.notes || interviewSeed?.notes || '',
          includeInTotal: previous
            ? Boolean(previous.includeInTotal)
            : includeFromSeed,
          answerType: previous?.answerType || q.answerType || 'text',
          choices:
            previous?.choices ||
            (Array.isArray((q as any).choices)
              ? (q as any).choices
                  .map((c: any) => String(c ?? '').trim())
                  .filter(Boolean)
              : []),
        };
      });
      try {
        if (
          Array.isArray(prev) &&
          prev.length === mergedGroupQuestions.length
        ) {
          const same = prev.every(
            (p, i) =>
              JSON.stringify(p) === JSON.stringify(mergedGroupQuestions[i])
          );
          if (same) return prev;
        }
      } catch (e) {}
      lastResolvedInterviewIdRef.current = resolvedInterviewId || null;
      return mergedGroupQuestions;
    });
  }, [
    isInterviewEditMode,
    selectedQuestionGroupIds,
    companyInterviewGroups,
    interviewTargetMode,
    interviewTargetId,
    applicantInterviews,
    getPreferredInterviewToUpdate,
  ]);

  const openInterviewEditMode = () => {
    if (!canManageInterviews) return;
    if (!applicant) return;

    const availableCustomFields = getAvailableCustomFieldsForInterview();
    const availableSpecs = getAvailableJobSpecsForInterview();

    const rawCustomResponses =
      applicant?.customResponses &&
      typeof applicant.customResponses === 'object'
        ? applicant.customResponses
        : applicant?.customFieldResponses &&
            typeof applicant.customFieldResponses === 'object'
          ? applicant.customFieldResponses
          : {};

    const mappedResponseKeys = new Set<string>();
    const nextCustomResponses: Record<string, any> = {};

    availableCustomFields.forEach((field: any, fieldIndex: number) => {
      const fieldId = getCustomFieldId(field, fieldIndex);
      const matchedKey = findMatchingResponseKeyForField(
        field,
        rawCustomResponses
      );
      if (matchedKey) mappedResponseKeys.add(matchedKey);
      const rawValue =
        matchedKey &&
        Object.prototype.hasOwnProperty.call(rawCustomResponses, matchedKey)
          ? rawCustomResponses[matchedKey]
          : rawCustomResponses[fieldId];

      nextCustomResponses[fieldId] = coerceCustomFieldValueForForm(
        field,
        rawValue
      );
    });

    const unmappedCustomResponses = Object.fromEntries(
      Object.entries(rawCustomResponses).filter(
        ([key]) => !mappedResponseKeys.has(key)
      )
    );

    const inferredCustomFields = buildInferredCustomFieldsFromResponses(
      unmappedCustomResponses
    );

    inferredCustomFields.forEach((field: any, inferredIndex: number) => {
      const fieldId = getCustomFieldId(
        field,
        availableCustomFields.length + inferredIndex
      );
      const rawValue = rawCustomResponses[fieldId];
      nextCustomResponses[fieldId] = coerceCustomFieldValueForForm(
        field,
        rawValue
      );
    });

    setInterviewUnmappedCustomResponses(unmappedCustomResponses);
    setInterviewEditableCustomFields([
      ...availableCustomFields,
      ...inferredCustomFields,
    ]);

    setInterviewEditForm({
      fullName: applicant?.fullName ? String(applicant.fullName) : '',
      email: applicant?.email ? String(applicant.email) : '',
      phone: applicant?.phone ? String(applicant.phone) : '',
      gender: applicant?.gender ? normalizeGenderLocal(applicant.gender) : '',
      birthDate: toInputDate(getBirthDateValue()),
      address: applicant?.address ? String(applicant.address) : '',
      expectedSalary:
        applicant?.expectedSalary !== undefined &&
        applicant?.expectedSalary !== null
          ? String(applicant.expectedSalary)
          : '',
      customResponses: nextCustomResponses,
      jobSpecsResponses: buildInitialJobSpecsResponses(
        applicant,
        availableSpecs
      ),
    });

    const targetInterview = getPreferredInterviewToUpdate();
    const hasExistingInterview = Boolean(targetInterview?._id);

    setInterviewTargetMode(hasExistingInterview ? 'existing' : 'new');
    setInterviewTargetId(String(targetInterview?._id || ''));
    try {
      const inferred = targetInterview
        ? inferGroupIdsFromInterview(targetInterview)
        : [];
      setSelectedQuestionGroupIds(inferred);
    } catch (e) {
      setSelectedQuestionGroupIds([]);
    }
    setInterviewQuestionDrafts([]);

    setIsInterviewEditMode(true);
    setIsEditOnlyMode(false);
  };

  const handleInterviewTargetModeChange = (mode: InterviewTargetMode) => {
    setInterviewTargetMode(mode);
    if (mode === 'new') {
      setInterviewTargetId('');
      return;
    }
    const fallbackInterviewId = String(
      getPreferredInterviewToUpdate()?._id || ''
    );
    const resolvedInterviewId = String(
      interviewTargetId || fallbackInterviewId || ''
    );
    setInterviewTargetId(resolvedInterviewId);
    try {
      const iv = applicantInterviews.find(
        (x: any) => String(x?._id || '') === String(resolvedInterviewId)
      );
      const inferred = iv ? inferGroupIdsFromInterview(iv) : [];
      setSelectedQuestionGroupIds(inferred);
    } catch (e) {
      setSelectedQuestionGroupIds([]);
    }
  };

  const handleExistingInterviewSelection = (nextInterviewId: string) => {
    setInterviewTargetMode('existing');
    setInterviewTargetId(nextInterviewId);
    try {
      const iv = applicantInterviews.find(
        (x: any) => String(x?._id || '') === String(nextInterviewId)
      );
      const inferred = iv ? inferGroupIdsFromInterview(iv) : [];
      setSelectedQuestionGroupIds(inferred);
      setInterviewQuestionDrafts([]);
    } catch (e) {
      setSelectedQuestionGroupIds([]);
      setInterviewQuestionDrafts([]);
    }
  };

  const updateInterviewQuestionDraft = (
    localId: string,
    field: 'achievedScore' | 'notes',
    value: any
  ) => {
    setInterviewQuestionDrafts((prev) =>
      prev.map((q) => {
        if (q.localId !== localId) return q;
        if (field === 'achievedScore') {
          const parsed = Number(value);
          const maxScore = Number.isFinite(Number(q.score))
            ? Number(q.score)
            : 0;
          const clamped = Number.isFinite(parsed)
            ? Math.max(0, Math.min(parsed, maxScore))
            : 0;
          return { ...q, achievedScore: clamped };
        }
        return { ...q, notes: String(value ?? '') };
      })
    );
  };

  const updateInterviewQuestionIncluded = (
    localId: string,
    includeInTotal: boolean
  ) => {
    setInterviewQuestionDrafts((prev) =>
      prev.map((q) => (q.localId === localId ? { ...q, includeInTotal } : q))
    );
  };

  const getEffectiveQuestionScore = useCallback((q: InterviewQuestionDraft) => {
    const baseScore = Number.isFinite(Number(q.score)) ? Number(q.score) : 0;
    return q.includeInTotal ? Math.max(0, baseScore) : 0;
  }, []);

  const getComputedQuestionAchievedScore = useCallback(
    (q: InterviewQuestionDraft) => {
      const effectiveScore = getEffectiveQuestionScore(q);
      if (effectiveScore <= 0) return 0;

      // If an achievedScore was provided use it (clamped), otherwise default to full question score
      const raw = (q as any).achievedScore;
      let achievedValue: number;
      if (raw === undefined || raw === null) {
        achievedValue = effectiveScore;
      } else {
        const parsed = Number(raw);
        achievedValue = Number.isFinite(parsed) ? parsed : 0;
      }
      const clamped = Math.max(0, Math.min(achievedValue, effectiveScore));
      return clamped;
    },
    [getEffectiveQuestionScore]
  );

  const interviewScoreSummary = useMemo(() => {
    const totalScore = (interviewQuestionDrafts || []).reduce(
      (sum, q) => sum + getEffectiveQuestionScore(q),
      0
    );
    const achievedScore = (interviewQuestionDrafts || []).reduce(
      (sum, q) => sum + getComputedQuestionAchievedScore(q),
      0
    );
    return {
      totalScore,
      achievedScore,
    };
  }, [
    interviewQuestionDrafts,
    getEffectiveQuestionScore,
    getComputedQuestionAchievedScore,
  ]);

  const setInterviewCustomFieldValue = (fieldId: string, value: any) => {
    setInterviewEditForm((prev) => ({
      ...prev,
      customResponses: {
        ...prev.customResponses,
        [fieldId]: value,
      },
    }));
  };

  const addInterviewRepeatableRow = (field: any, fieldId: string) => {
    setInterviewEditForm((prev) => {
      const currentRows = Array.isArray(prev.customResponses[fieldId])
        ? [...prev.customResponses[fieldId]]
        : [];
      const groupFields = getCustomFieldGroupFields(field);
      const newRow: Record<string, any> = {};
      groupFields.forEach((subField: any, subIndex: number) => {
        const subFieldId = getCustomFieldId(subField, subIndex);
        newRow[subFieldId] = coerceCustomFieldValueForForm(subField, undefined);
      });
      currentRows.push(newRow);
      return {
        ...prev,
        customResponses: {
          ...prev.customResponses,
          [fieldId]: currentRows,
        },
      };
    });
  };

  const removeInterviewRepeatableRow = (fieldId: string, rowIndex: number) => {
    setInterviewEditForm((prev) => {
      const currentRows = Array.isArray(prev.customResponses[fieldId])
        ? [...prev.customResponses[fieldId]]
        : [];
      const nextRows = currentRows.filter((_, idx) => idx !== rowIndex);
      return {
        ...prev,
        customResponses: {
          ...prev.customResponses,
          [fieldId]: nextRows,
        },
      };
    });
  };

  const updateInterviewRepeatableCell = (
    fieldId: string,
    rowIndex: number,
    subFieldId: string,
    value: any
  ) => {
    setInterviewEditForm((prev) => {
      const currentRows = Array.isArray(prev.customResponses[fieldId])
        ? [...prev.customResponses[fieldId]]
        : [];
      const row =
        currentRows[rowIndex] && typeof currentRows[rowIndex] === 'object'
          ? { ...currentRows[rowIndex] }
          : {};
      row[subFieldId] = value;
      currentRows[rowIndex] = row;
      return {
        ...prev,
        customResponses: {
          ...prev.customResponses,
          [fieldId]: currentRows,
        },
      };
    });
  };

  const updateInterviewJobSpecAnswer = (jobSpecId: string, answer: boolean) => {
    if (!jobSpecId) return;
    setInterviewEditForm((prev) => {
      const nextResponses = [...prev.jobSpecsResponses];
      const idx = nextResponses.findIndex(
        (r) => String(r.jobSpecId) === String(jobSpecId)
      );
      if (idx >= 0) {
        nextResponses[idx] = { ...nextResponses[idx], answer };
      } else {
        nextResponses.push({ jobSpecId, answer });
      }
      return { ...prev, jobSpecsResponses: nextResponses };
    });
  };

  const createInterviewForQuestionSave = async (
    questionsToSave: Array<{
      question: string;
      score: number;
      achievedScore: number;
      notes: string;
    }>
  ): Promise<string> => {
    if (!id) return '';

    const scheduledAt = new Date().toISOString();
    const creationNotes = `Created from interview edit on ${new Date().toLocaleDateString()}`;
    const knownInterviewIds = new Set(
      (applicantInterviews || [])
        .map((iv: any) => String(iv?._id || ''))
        .filter(Boolean)
    );

    const resolveInterviewId = (sourceInterviews: any[] = []): string => {
      const interviews = Array.isArray(sourceInterviews)
        ? sourceInterviews
        : [];
      const exactMatch = interviews.find(
        (iv: any) =>
          String(iv?.scheduledAt || '') === String(scheduledAt) &&
          String(iv?.notes || '') === creationNotes
      );
      if (exactMatch?._id) {
        return String(exactMatch._id);
      }
      const noteMatch = interviews.find(
        (iv: any) => String(iv?.notes || '') === creationNotes
      );
      if (noteMatch?._id) {
        return String(noteMatch._id);
      }
      const firstNewInterview = sortInterviewsByPriority(interviews).find(
        (iv: any) => {
          const candidateId = String(iv?._id || '');
          return Boolean(candidateId) && !knownInterviewIds.has(candidateId);
        }
      );
      if (firstNewInterview?._id) {
        return String(firstNewInterview._id);
      }
      const newestInterview = sortInterviewsByPriority(interviews)[0];
      if (newestInterview?._id) {
        return String(newestInterview._id);
      }
      return '';
    };

    const updatedApplicant = await scheduleInterviewMutation.mutateAsync({
      id,
      data: {
        scheduledAt,
        type: 'phone',
        status: 'scheduled',
        notes: creationNotes,
        questions: questionsToSave,
      },
    });

    const directInterviewId = String(
      (updatedApplicant as any)?._id || (updatedApplicant as any)?.id || ''
    );
    if (
      directInterviewId &&
      directInterviewId !== String(id) &&
      !knownInterviewIds.has(directInterviewId)
    ) {
      return directInterviewId;
    }

    const interviewsFromResponse = Array.isArray(
      (updatedApplicant as any)?.interviews
    )
      ? [...((updatedApplicant as any).interviews || [])]
      : [];
    const interviewIdFromResponse = resolveInterviewId(interviewsFromResponse);
    if (interviewIdFromResponse) {
      return interviewIdFromResponse;
    }

    try {
      const refreshedApplicant = await applicantsService.getApplicantById(id);
      if (refreshedApplicant && typeof refreshedApplicant === 'object') {
        queryClient.setQueryData(applicantsKeys.detail(id), refreshedApplicant);
      }
      const interviewsFromRefetch = Array.isArray(
        (refreshedApplicant as any)?.interviews
      )
        ? [...((refreshedApplicant as any).interviews || [])]
        : [];
      const interviewIdFromRefetch = resolveInterviewId(interviewsFromRefetch);
      if (interviewIdFromRefetch) {
        return interviewIdFromRefetch;
      }
    } catch {}

    return '';
  };

  const handleInterviewEditSave = async () => {
    if (!id || !applicant) return;

    const expectedSalaryValue =
      interviewEditForm.expectedSalary.trim() === ''
        ? undefined
        : Number(interviewEditForm.expectedSalary);

    if (
      expectedSalaryValue !== undefined &&
      (!Number.isFinite(expectedSalaryValue) ||
        Number.isNaN(expectedSalaryValue))
    ) {
      Swal.fire(
        'Invalid Salary',
        'Expected salary must be a valid number.',
        'error'
      );
      return;
    }

    const invalidQuestionRows = (interviewQuestionDrafts || []).filter(
      (q) =>
        !String(q.question || '').trim() || !Number.isFinite(Number(q.score))
    );

    if (invalidQuestionRows.length > 0) {
      Swal.fire(
        'Invalid Interview Question',
        'Each interview question must include a question text and numeric score.',
        'error'
      );
      return;
    }

    const interviewQuestionsPayload = (interviewQuestionDrafts || [])
      .filter(
        (q) =>
          String(q.question || '').trim() && Number.isFinite(Number(q.score))
      )
      .map((q) => ({
        question: String(q.question || '').trim(),
        score: getEffectiveQuestionScore(q),
        achievedScore: getComputedQuestionAchievedScore(q),
        notes: String(q.notes || '').trim(),
      }));

    let interviewIdToUpdate = '';
    if (interviewTargetMode === 'existing') {
      interviewIdToUpdate = String(
        interviewTargetId || getPreferredInterviewToUpdate()?._id || ''
      );
    }

    if (
      interviewTargetMode === 'existing' &&
      interviewQuestionsPayload.length > 0 &&
      !interviewIdToUpdate
    ) {
      Swal.fire(
        'No Interview Record',
        'Schedule an interview first, then add/update interview questions.',
        'warning'
      );
      return;
    }

    const availableCustomFields =
      interviewEditableCustomFields.length > 0
        ? interviewEditableCustomFields
        : getAvailableCustomFieldsForInterview();
    const customResponsesPayload: Record<string, any> = {
      ...(interviewUnmappedCustomResponses || {}),
    };

    availableCustomFields.forEach((field: any, fieldIndex: number) => {
      const fieldId = getCustomFieldId(field, fieldIndex);
      customResponsesPayload[fieldId] = coerceCustomFieldValueForPayload(
        field,
        interviewEditForm.customResponses[fieldId]
      );
    });

    const availableSpecs = getAvailableJobSpecsForInterview();
    const jobSpecsResponseMap = new Map<string, boolean>();

    interviewEditForm.jobSpecsResponses
      .filter((r) => Boolean(r?.jobSpecId))
      .forEach((r) => {
        jobSpecsResponseMap.set(String(r.jobSpecId), Boolean(r.answer));
      });

    (availableSpecs || []).forEach((s: any) => {
      const specId = normalizeSpecId(s?.jobSpecId ?? s?._id ?? s?.id);
      if (!specId) return;
      if (!jobSpecsResponseMap.has(String(specId))) {
        jobSpecsResponseMap.set(String(specId), false);
      }
    });

    const payload: any = {
      fullName: interviewEditForm.fullName.trim(),
      email: interviewEditForm.email.trim(),
      phone: interviewEditForm.phone.trim(),
      gender: interviewEditForm.gender.trim(),
      address: interviewEditForm.address.trim(),
      customResponses: customResponsesPayload,
      jobSpecsResponses: Array.from(jobSpecsResponseMap.entries()).map(
        ([jobSpecId, answer]) => ({
          jobSpecId: String(jobSpecId),
          answer: Boolean(answer),
        })
      ),
    };

    if (interviewEditForm.birthDate)
      payload.birthDate = interviewEditForm.birthDate;
    if (expectedSalaryValue !== undefined)
      payload.expectedSalary = expectedSalaryValue;

    let applicantUpdated = false;

    try {
      setIsSavingInterviewEdit(true);
      await updateApplicantMutation.mutateAsync({ id, data: payload });
      applicantUpdated = true;

      if (interviewQuestionsPayload.length > 0) {
        if (interviewTargetMode === 'new') {
          interviewIdToUpdate = await createInterviewForQuestionSave(
            interviewQuestionsPayload
          );
          if (!interviewIdToUpdate) {
            throw new Error(
              'Interview was created, but no interview id was returned. Please try again.'
            );
          }
        }

        if (!interviewIdToUpdate) {
          throw new Error(
            'Please select an interview target before saving questions.'
          );
        }

        await updateInterviewMutation.mutateAsync({
          applicantId: id,
          interviewId: interviewIdToUpdate,
          data: {
            questions: interviewQuestionsPayload,
          } as any,
        });
      }

      setIsInterviewEditMode(false);
      setIsEditOnlyMode(false);
      setInterviewTargetMode('existing');
      setInterviewTargetId('');
      setSelectedQuestionGroupIds([]);
      setInterviewQuestionDrafts([]);
      setInterviewEditableCustomFields([]);

      Swal.fire(
        'Saved',
        interviewQuestionsPayload.length > 0
          ? 'Applicant data and interview questions were updated successfully.'
          : 'Applicant interview data was updated successfully.',
        'success'
      );
    } catch (err: any) {
      if (applicantUpdated) {
        Swal.fire(
          'Partial Update',
          `Applicant data was saved, but interview update failed: ${getErrorMessage(err)}`,
          'warning'
        );
      } else {
        Swal.fire('Update Failed', getErrorMessage(err), 'error');
      }
    } finally {
      setIsSavingInterviewEdit(false);
    }
  };

  const handleInterviewEditCancel = () => {
    setIsInterviewEditMode(false);
    setInterviewTargetMode('existing');
    setInterviewTargetId('');
    setSelectedQuestionGroupIds([]);
    setInterviewQuestionDrafts([]);
    setInterviewEditableCustomFields([]);
  };

  const inlineStyleHtml = (html: string) => {
    if (!html) return '';
    let out = String(html);
    out = out.replace(/<p\b([^>]*)>/g, (match, attrs) =>
      attrs.includes('style=')
        ? match
        : `<p style="margin:0 0 12px;color:#444;"${attrs}>`
    );
    out = out.replace(/<ul\b([^>]*)>/g, (match, attrs) =>
      attrs.includes('style=')
        ? match
        : `<ul style="margin:0 0 12px 18px;padding-left:18px;"${attrs}>`
    );
    out = out.replace(/<ol\b([^>]*)>/g, (match, attrs) =>
      attrs.includes('style=')
        ? match
        : `<ol style="margin:0 0 12px 18px;padding-left:18px;"${attrs}>`
    );
    out = out.replace(/<li\b([^>]*)>/g, (match, attrs) =>
      attrs.includes('style=')
        ? match
        : `<li style="margin-bottom:6px;"${attrs}>`
    );
    return out;
  };

  const escapeHtml = (s: string) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const sanitizeMessageTemplate = (htmlOrText: string) => {
    if (!htmlOrText) return '';
    let out = String(htmlOrText);
    out = out.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '');
    if (out.indexOf('<') !== -1) {
      out = out.replace(
        /<p[^>]*>\s*Interview Details\s*<\/p>\s*(?:<ul[\s\S]*?<\/ul>|<ol[\s\S]*?<\/ol>)/i,
        ''
      );
      out = out.replace(
        /<li[^>]*>\s*(?:Date|Time|Type|Location|Link):[\s\S]*?<\/li>/gi,
        ''
      );
      out = out.replace(
        /<p[^>]*>\s*(?:Interview Details|•|\-|\*)[\s\S]*?<\/p>/gi,
        ''
      );
      out = out.replace(/(<(p|div|li|span)[^>]*>)\s*(?:&gt;|>)+\s*/gi, '$1');
    } else {
      out = out.replace(/Interview Details[\s\S]*?(?=\n\s*\n|$)/i, '');
      out = out.replace(
        /(^|\n)\s*[•\-*]\s*(Date|Time|Type|Location|Link):.*(?=\n|$)/gi,
        ''
      );
    }
    out = out.replace(/(^|\n)\s*>.*(?=\n|$)/g, '');
    out = out.replace(/(^|\n)\s*&gt;+\s*/gi, '$1');
    out = out.replace(/<p([^>]*)>\s*(?:&gt;|>)+\s*/gi, '<p$1>');
    out = out.replace(
      /^\s*(?:<p[^>]*>\s*)?(Dear\s+[A-Za-z0-9\-\s,.]{1,80}[,:]?)(?:<\/p>\s*)?/i,
      ''
    );
    out = out.replace(/(\r?\n){2,}/g, '\n\n').trim();
    return out;
  };

  const buildInterviewEmailHtml = (opts: {
    subject: string;
    jobTitle: string;
    interview: any;
    rawMessage: string;
    applicantName?: string;
    replacements?: Record<string, string>;
  }) => {
    const {
      subject,
      rawMessage,
      applicantName,
      jobTitle,
      replacements: externalReplacements,
    } = opts;

    const replacements: Record<string, string> = externalReplacements || {};

    if (!replacements['{{candidateName}}'] && applicantName) {
      replacements['{{candidateName}}'] = applicantName;
    }
    if (!replacements['{{jobTitle}}'] && jobTitle) {
      replacements['{{jobTitle}}'] = jobTitle;
    }

    const allReplacements: Record<string, string> = {};

    Object.entries(replacements).forEach(([token, value]) => {
      allReplacements[token] = value;
      allReplacements[token.toLowerCase()] = value;
      const lowerToken = token.toLowerCase();
      const capitalToken =
        lowerToken.charAt(0).toUpperCase() + lowerToken.slice(1);
      allReplacements[capitalToken] = value;
      allReplacements[lowerToken.replace(/\s/g, '')] = value;
    });

    let processedSubject = subject;
    Object.entries(allReplacements).forEach(([token, value]) => {
      const regex = new RegExp(token.replace(/[{}]/g, '\\$&'), 'gi');
      processedSubject = processedSubject.replace(regex, value);
    });

    let processedBody = rawMessage || '';
    Object.entries(allReplacements).forEach(([token, value]) => {
      const regex = new RegExp(token.replace(/[{}]/g, '\\$&'), 'gi');
      processedBody = processedBody.replace(regex, value);
    });

    const convertUrlsToLinks = (text: string): string => {
      if (text.indexOf('<') !== -1) {
        const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)(?![^<]*<\/a>)/gi;
        return text.replace(urlRegex, (url) => {
          let href = url;
          if (!href.startsWith('http://') && !href.startsWith('https://')) {
            href = 'https://' + href;
          }
          return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline; transition: color 0.2s;">${escapeHtml(url)}</a>`;
        });
      }

      const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
      return text.replace(urlRegex, (url) => {
        let href = url;
        if (!href.startsWith('http://') && !href.startsWith('https://')) {
          href = 'https://' + href;
        }
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">${escapeHtml(url)}</a>`;
      });
    };

    const formatLocationLinks = (text: string): string => {
      const locationPattern =
        /(Location:\s*)(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
      return text.replace(locationPattern, (_, locationLabel, url) => {
        let href = url;
        if (!href.startsWith('http://') && !href.startsWith('https://')) {
          href = 'https://' + href;
        }
        return `${locationLabel}<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">${escapeHtml(url)}</a>`;
      });
    };

    let processedBodyWithLinks = formatLocationLinks(processedBody);
    processedBodyWithLinks = convertUrlsToLinks(processedBodyWithLinks);

    const sanitizedBody = sanitizeMessageTemplate(processedBodyWithLinks);
    let bodyHtml = '';
    if (sanitizedBody.indexOf('<') !== -1) {
      bodyHtml = inlineStyleHtml(sanitizedBody);
    } else {
      const parts = sanitizedBody
        .split(/\r?\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      bodyHtml = parts
        .map((p) => `<p style="margin:0 0 12px;color:#444;">${p}</p>`)
        .join('');
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(processedSubject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; background-color: #f5f5f5; margin:0; padding:0; }
    .container { max-width:600px; margin:24px auto; background:#fff; border-radius:8px; overflow:hidden; }
    .header { padding:24px 30px; background:#fff; border-bottom:1px solid #e5e7eb; text-align:center; }
    .header h1 { color:#111827; margin:0; font-size:20px; font-weight:700; }
    .content { padding:28px 30px; color:#222; }
    .footer { padding:18px 30px; color:#999; font-size:12px; text-align:center; }
    a { color: #3b82f6 !important; text-decoration: underline !important; }
    a:hover { color: #2563eb !important; text-decoration: underline !important; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>${escapeHtml(processedSubject)}</h1></div>
      <div class="content">
      <div style="margin-top:12px;margin-bottom:18px;">${bodyHtml}</div>
    </div>
  </div>
</body>
</html>`;
  };

  const getErrorMessage = (err: any): string => {
    if (
      err.response?.data?.details &&
      Array.isArray(err.response.data.details)
    ) {
      return err.response.data.details
        .map((detail: any) => {
          const field = detail.path?.[0] || '';
          const message = detail.message || '';
          return field ? `${field}: ${message}` : message;
        })
        .join(', ');
    }
    if (err.response?.data?.errors) {
      const { errors } = err.response.data;
      if (Array.isArray(errors)) {
        return errors.map((e: any) => e.msg || e.message).join(', ');
      }
      if (typeof errors === 'object') {
        return Object.entries(errors)
          .map(([field, msg]) => `${field}: ${msg}`)
          .join(', ');
      }
    }
    if (err.response?.data?.message) return err.response.data.message;
    if (err.message) return err.message;
    return 'An unexpected error occurred';
  };

  const handleInterviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageInterviews) return;
    if (!id || !applicant) return;

    if (emailOption === 'custom' && !customEmail.trim()) {
      setInterviewError('Please provide a custom email address');
      return;
    }
    if (
      (notificationChannels.sms || notificationChannels.whatsapp) &&
      phoneOption === 'custom' &&
      !customPhone.trim()
    ) {
      setInterviewError('Please provide a custom phone number');
      return;
    }

    setIsSubmittingInterview(true);
    const interviewSnapshot = { ...interviewForm };
    const notifEmailOption =
      emailOption || (customEmail ? 'custom' : undefined);
    const notifCustomEmail = customEmail || undefined;
    const notifPhoneOption = phoneOption || undefined;
    const notifCustomPhone =
      phoneOption === 'custom' ? customPhone || undefined : undefined;
    const notifChannels = { ...notificationChannels };
    setInterviewForm({
      date: '',
      time: '',
      description: '',
      comment: '',
      location: '',
      link: '',
      type: 'phone',
      conductedBy: '',
    });
    setNotificationChannels({ email: true, sms: false, whatsapp: false });
    setEmailOption('company');
    setCustomEmail('');
    setPhoneOption('company');
    setCustomPhone('');
    setShowInterviewModal(false);

    try {
      let scheduledAt: string | undefined;
      if (interviewSnapshot.date && interviewSnapshot.time) {
        const [year, month, day] = interviewSnapshot.date
          .split('-')
          .map(Number);
        const [hours, minutes] = interviewSnapshot.time.split(':').map(Number);
        const pad = (n: number) => String(n).padStart(2, '0');
        scheduledAt = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`;
      } else if (interviewSnapshot.date) {
        scheduledAt = `${interviewSnapshot.date}T00:00:00`;
      }

      const interviewData: any = {
        scheduledAt,
        description: interviewSnapshot.description || undefined,
        type: interviewSnapshot.type || undefined,
        location: interviewSnapshot.location || undefined,
        videoLink: interviewSnapshot.link || undefined,
        notes: interviewSnapshot.comment || undefined,
        conductedBy: interviewSnapshot.conductedBy || undefined,
        companyId: companyObj?._id,
        notifications: {
          channels: {
            email: notifChannels.email,
            sms: notifChannels.sms,
            whatsapp: notifChannels.whatsapp,
          },
          emailOption: notifEmailOption,
          customEmail: notifCustomEmail,
          phoneOption: notifPhoneOption,
          customPhone: notifCustomPhone,
        },
      };

      if (applicant && applicant.status !== 'interview') {
        updateStatusMutation.mutate({
          id: id!,
          data: {
            status: 'interview',
            notes: `Status automatically updated to interview upon scheduling an interview on ${new Date().toLocaleDateString()}`,
          } as UpdateStatusRequest,
        });
      }

      const tempInterviewId = `temp-${Date.now()}`;
      interviewData._id = tempInterviewId;

      const updatedApplicant = await scheduleInterviewMutation.mutateAsync({
        id: id!,
        data: interviewData,
      });

      let createdInterviewId: string | undefined;
      try {
        const interviews = (updatedApplicant as any)?.interviews || [];
        createdInterviewId = interviews.find((iv: any) => {
          if (!iv) return false;
          return (
            iv.scheduledAt === interviewData.scheduledAt &&
            iv.type === interviewData.type &&
            (iv.notes || '') === (interviewData.notes || '')
          );
        })?._id;
      } catch (e) {}

      if (createdInterviewId) {
        await updateInterviewMutation.mutateAsync({
          applicantId: id!,
          interviewId: createdInterviewId,
          data: { status: 'scheduled' },
        });
      }

      if (notificationChannels.email) {
        try {
          const toEmail = applicant.email;
          const mailDefault =
            companyObj?.settings?.mailSettings?.defaultMail ||
            companyObj?.mailSettings?.defaultMail ||
            companyObj?.contactEmail ||
            companyObj?.email ||
            '';
          let fromEmail = notifCustomEmail || mailDefault;

          const jobTitleObj = getJobTitle();
          const jobTitleText = jobTitleObj.en || '';
          const applicantName = applicant.fullName || 'Candidate';

          const replacements: Record<string, string> = {
            '{{candidateName}}': applicantName,
            '{{jobTitle}}': jobTitleText,
          };

          let processedSubject =
            interviewEmailSubject || 'Interview Invitation';
          Object.entries(replacements).forEach(([token, value]) => {
            processedSubject = processedSubject.split(token).join(value);
          });

          let processedMessage = messageTemplate || '';
          Object.entries(replacements).forEach(([token, value]) => {
            processedMessage = processedMessage.split(token).join(value);
          });

          const sanitizedBody = sanitizeMessageTemplate(processedMessage);
          const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(processedSubject)}</title>
</head>
<body style="font-family: Arial, sans-serif; padding: 20px; margin: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
    <div style="background-color: #ffffff; border-bottom: 1px solid #e5e7eb; padding: 24px 30px; text-align: center;">
      <h1 style="color: #111827; margin: 0; font-size: 22px; font-weight: 700;">${escapeHtml(processedSubject)}</h1>
    </div>
    <div style="padding: 30px;">
      <div style="font-size: 16px; line-height: 1.6; color: #444;">
        ${inlineStyleHtml(sanitizedBody || '')}
      </div>
    </div>
  </div>
</body>
</html>
`;

          const resolveJobPositionId = (value: any): string | undefined => {
            if (!value) return undefined;
            if (Array.isArray(value)) {
              for (const item of value) {
                const id = resolveJobPositionId(item);
                if (id) return id;
              }
              return undefined;
            }
            if (typeof value === 'string') return value;
            if (typeof value === 'object') {
              if (typeof value._id === 'string') return value._id;
              if (typeof value.id === 'string') return value.id;
            }
            return undefined;
          };

          const jobPositionId =
            resolveJobPositionId(applicant?.jobPositionId) ||
            resolveJobPositionId(applicant?.jobPosition);

          await sendEmailMutation.mutateAsync({
            company: companyObj?._id,
            jobPosition: jobPositionId,
            applicant: applicant?._id,
            to: toEmail,
            from: fromEmail,
            subject: processedSubject,
            html: emailHtml,
          });

          try {
            await sendMessageMutation.mutateAsync({
              id: id!,
              data: {
                type: 'email',
                content: sanitizedBody,
              },
            });
          } catch (e) {
            console.warn(
              'ApplicantData: failed to save interview message to history',
              e
            );
          }
        } catch (err: any) {
          const errMsg = getErrorMessage(err);
          console.error('Error sending interview notification:', err);
          setInterviewError(errMsg);
          await Swal.fire({
            title: 'Notification Error',
            text: String(errMsg),
            icon: 'error',
          });
        }
      }

      await Swal.fire({
        title: 'Success!',
        text: 'Interview scheduled successfully.',
        icon: 'success',
        position: 'center',
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: '!mt-16',
        },
      });
    } catch (err: any) {
      const errorMsg = getErrorMessage(err);
      setInterviewError(errorMsg);
      console.error('Error scheduling interview:', err);
      await Swal.fire({
        title: 'Error',
        text: String(errorMsg),
        icon: 'error',
      });
    } finally {
      setIsSubmittingInterview(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageMessages) return;
    if (!id || !applicant) return;

    setIsSubmittingComment(true);
    try {
      const commentData = {
        comment: commentForm.text,
        isInternal: true,
      };
      setCommentForm({ text: '' });
      setShowCommentModal(false);
      addCommentMutation.mutate({ id: id!, data: commentData });
      await Swal.fire({
        title: 'Success!',
        text: 'Comment added successfully.',
        icon: 'success',
        position: 'center',
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: '!mt-16',
        },
      });
    } catch (err: any) {
      const errorMsg = getErrorMessage(err);
      setCommentError(errorMsg);
      console.error('Error adding comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !applicant || !statusForm.status) return;

    setIsSubmittingStatus(true);
    try {
      const selectedReasons = Array.isArray((statusForm as any).reasons)
        ? (statusForm as any).reasons
            .map((r: any) => String(r ?? '').trim())
            .filter(Boolean)
        : [];
      const mergedRejectedReasons = Array.from(new Set(selectedReasons));
      const statusData: UpdateStatusRequest = {
        status: statusForm.status as UpdateStatusRequest['status'],
        notes: statusForm.notes || undefined,
        ...(statusForm.status === 'rejected' && mergedRejectedReasons.length
          ? { reasons: mergedRejectedReasons }
          : {}),
      } as UpdateStatusRequest;
      setStatusForm({ status: '', notes: '', reasons: [] });
      setShowStatusModal(false);
      updateStatusMutation.mutate({ id: id!, data: statusData });
      await Swal.fire({
        title: 'Success!',
        text: 'Status updated successfully.',
        icon: 'success',
        position: 'center',
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: '!mt-16',
        },
      });
    } catch (err: any) {
      const errorMsg = getErrorMessage(err);
      setStatusError(errorMsg);
      console.error('Error updating status:', err);
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const handleDeleteApplicant = async () => {
    if (!canManageApplicant) return;
    if (!id || !applicant) return;

    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Move "${applicant.fullName}" to trash? You can restore it from the trash section later.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, move to trash',
      cancelButtonText: 'Cancel',
    });

    if (!result.isConfirmed) return;

    setIsSubmittingStatus(true);
    try {
      const statusData: UpdateStatusRequest = {
        status: 'trashed' as UpdateStatusRequest['status'],
        notes: `Applicant moved to trash on ${new Date().toLocaleString()}`,
      };

      await updateStatusMutation.mutateAsync({ id: id!, data: statusData });

      await Swal.fire({
        title: 'Moved to Trash!',
        text: 'Applicant has been moved to trash successfully.',
        icon: 'success',
        position: 'center',
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          container: '!mt-16',
        },
      });

      navigate('/applicants');
    } catch (err: any) {
      const errorMsg = getErrorMessage(err);
      console.error('Error moving applicant to trash:', err);
      await Swal.fire({
        title: 'Error',
        text: errorMsg,
        icon: 'error',
      });
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const customFieldsForInterview = getAvailableCustomFieldsForInterview();
  const editableCustomFieldsForInterview =
    (isInterviewEditMode || isEditOnlyMode) &&
    interviewEditableCustomFields.length > 0
      ? interviewEditableCustomFields
      : customFieldsForInterview;

  if (loading) {
    return (
      <div className="space-y-6">
        <PageMeta
          title="Applicant Details - Loading"
          description="Loading applicant data"
        />
        <PageBreadcrumb pageTitle="Applicant Details" />
        <LoadingSpinner fullPage message="Loading applicant data..." />
      </div>
    );
  }

  if (error || !applicant) {
    return (
      <>
        <PageMeta
          title="Applicant Details - Error"
          description="Error loading applicant"
        />
        <div className="p-12 text-center">
          <div className="mb-4 text-red-600 dark:text-red-400">
            {error instanceof Error ? error.message : 'Applicant not found'}
          </div>
          <button
            onClick={() => navigate('/applicants')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Applicants
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title={`Applicant - ${applicant.fullName}`}
        description={`${jobTitle.en} - ${companyName}`}
      />
      <PageBreadcrumb pageTitle={applicant.fullName} />

      <div className="grid gap-6">
        {/* Top actions: back button and status/change actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/applicants')}
              className="text-sm font-medium text-primary hover:text-primary/80"
            >
              ← Back to Applicants
            </button>

            {/* Previous/Next Pagination */}
            {allApplicants.length > 0 && (
              <div className="flex items-center gap-2 border-l border-gray-300 dark:border-gray-700 pl-4">
                <button
                  onClick={goToPreviousApplicant}
                  disabled={currentApplicantIndex <= 0}
                  className={`inline-flex items-center justify-center rounded-lg px-2 py-1 text-sm font-medium transition-colors ${
                    currentApplicantIndex > 0
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                      : 'bg-gray-50 text-gray-400 cursor-not-allowed dark:bg-gray-900 dark:text-gray-600'
                  }`}
                  title="Previous Applicant"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {currentApplicantIndex >= 0
                    ? `${currentApplicantIndex + 1} / ${allApplicants.length}`
                    : '-'}
                </span>

                <button
                  onClick={goToNextApplicant}
                  disabled={
                    currentApplicantIndex >= allApplicants.length - 1 ||
                    currentApplicantIndex === -1
                  }
                  className={`inline-flex items-center justify-center rounded-lg px-2 py-1 text-sm font-medium transition-colors ${
                    currentApplicantIndex < allApplicants.length - 1 &&
                    currentApplicantIndex !== -1
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                      : 'bg-gray-50 text-gray-400 cursor-not-allowed dark:bg-gray-900 dark:text-gray-600'
                  }`}
                  title="Next Applicant"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={() => {
                setStatusForm((prev) => ({
                  ...prev,
                  status: applicant?.status || hookDefaultStatus || '',
                }));
                setShowStatusModal(true);
              }}
              className="inline-flex items-center gap-1 sm:gap-2 rounded-lg bg-green-600 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-green-700"
            >
              {applicant.status
                ? applicant.status.charAt(0).toUpperCase() +
                  applicant.status.slice(1)
                : 'Status'}
            </button>

            {canManageApplicant && (
              <button
                onClick={openEditOnlyMode}
                disabled={isInterviewEditMode || isEditOnlyMode}
                className="inline-flex items-center gap-1 sm:gap-2 rounded-lg bg-brand-600 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg
                  className="h-3 w-3 sm:h-4 sm:w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit
              </button>
            )}

            {canManageInterviews && (
              <button
                onClick={openInterviewEditMode}
                disabled={isInterviewEditMode || isEditOnlyMode}
                className="inline-flex items-center gap-1 sm:gap-2 rounded-lg bg-amber-600 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg
                  className="h-3 w-3 sm:h-4 sm:w-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                Interview
              </button>
            )}

            {(isInterviewEditMode ? canManageInterviews : canManageApplicant) &&
              (isInterviewEditMode || isEditOnlyMode) && (
                <>
                  <button
                    onClick={
                      isInterviewEditMode
                        ? handleInterviewEditSave
                        : handleEditSave
                    }
                    disabled={isSavingInterviewEdit}
                    className="inline-flex items-center gap-1 sm:gap-2 rounded-lg bg-emerald-600 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSavingInterviewEdit ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={
                      isInterviewEditMode
                        ? handleInterviewEditCancel
                        : handleEditCancel
                    }
                    disabled={isSavingInterviewEdit}
                    className="inline-flex items-center gap-1 sm:gap-2 rounded-lg bg-slate-600 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </>
              )}

            {canManageInterviews && (
              <button
                onClick={() => {
                  setFormResetKey((prev) => prev + 1);
                  fillCompanyAddress();
                  setShowInterviewModal(true);
                }}
                className="inline-flex items-center gap-1 sm:gap-2 rounded-lg bg-blue-600 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700"
              >
                <PlusIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Schedule</span> Interview
              </button>
            )}

            {canManageInterviews && (
              <button
                onClick={() => {
                  setSelectedInterview(applicant.interviews?.[0] || null);
                  setShowInterviewSettingsModal(true);
                }}
                className="inline-flex items-center gap-1 sm:gap-2 rounded-lg bg-indigo-600 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <svg
                  className="h-3 w-3 sm:h-4 sm:w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Interview Settings
              </button>
            )}

            {canManageMessages && (
              <button
                onClick={() => setShowMessageModal(true)}
                className="inline-flex items-center gap-1 sm:gap-2 rounded-lg bg-purple-600 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-purple-700"
              >
                <PlusIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Send</span> Message
              </button>
            )}

            {canManageMessages && (
              <button
                onClick={() => setShowCommentModal(true)}
                className="inline-flex items-center gap-1 sm:gap-2 rounded-lg bg-gray-600 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-gray-700"
              >
                <PlusIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Add</span> Comment
              </button>
            )}

            {canManageApplicant && (
              <button
                onClick={handleDeleteApplicant}
                disabled={isSubmittingStatus}
                className="inline-flex items-center gap-1 sm:gap-2 rounded-lg bg-red-600 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg
                  className="h-3 w-3 sm:h-4 sm:w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Status History moved to top and collapsed by default */}
        <details className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 sm:px-6 sm:py-5">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Status History
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Timeline, comments, interviews, and channel activity
              </p>
            </div>
            <svg
              className="h-5 w-5 text-gray-500 transition-transform group-open:rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </summary>
          <div className="border-t border-gray-100 px-3 py-4 dark:border-gray-800 sm:px-5 sm:py-5">
            <StatusHistory applicant={applicant} loading={loading} />
          </div>
        </details>

        {/* Personal Information Card with Pagination in Header */}
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-purple-500/5 to-blue-500/5 dark:from-brand-500/10 dark:via-purple-500/10 dark:to-blue-500/10"></div>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-500/10 dark:bg-brand-500/5 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-3xl"></div>

          <div className="relative p-8">
            <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 justify-between">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 p-3 bg-gradient-to-br from-brand-500 to-brand-600 dark:from-brand-600 dark:to-brand-700 rounded-2xl shadow-lg">
                  <svg
                    className="w-7 h-7 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-extrabold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                    Personal Information
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Applicant profile and contact details
                  </p>
                </div>
              </div>

              {/* Profile Photo */}
              <div className="flex-shrink-0">
                {applicant.profilePhoto ? (
                  <button
                    type="button"
                    onClick={() => setShowPhotoModal(true)}
                    className="relative block rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow focus:outline-none focus:ring-2 focus:ring-brand-500"
                    aria-label="View profile photo"
                  >
                    <img
                      src={applicant.profilePhoto}
                      alt={applicant.fullName}
                      className="h-24 w-24 sm:h-28 sm:w-28 object-cover"
                    />
                  </button>
                ) : (
                  <div className="flex items-center justify-center h-24 w-24 sm:h-28 sm:w-28 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 shadow-lg text-2xl font-bold text-gray-800 dark:text-white">
                    {applicant.fullName
                      ? applicant.fullName
                          .split(' ')
                          .map((n: string) => n.charAt(0))
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()
                      : 'NA'}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Full Name */}
              <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-brand-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
                <div className="flex items-baseline gap-4">
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-brand-100 dark:bg-brand-900/30 rounded-lg group-hover:scale-110 transition-transform">
                    <svg
                      className="w-6 h-6 text-brand-600 dark:text-brand-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">
                    Full Name
                  </Label>
                  {isInterviewEditMode || isEditOnlyMode ? (
                    <input
                      type="text"
                      value={interviewEditForm.fullName}
                      onChange={(e) =>
                        setInterviewEditForm((prev) => ({
                          ...prev,
                          fullName: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      placeholder="Full name"
                    />
                  ) : (
                    <div
                      dir={isArabic(applicant.fullName) ? 'rtl' : undefined}
                      className={`text-base font-bold text-gray-900 dark:text-white ${isArabic(applicant.fullName) ? 'text-right' : ''}`}
                    >
                      {applicant.fullName}
                    </div>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-blue-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
                <div className="flex items-baseline gap-4">
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:scale-110 transition-transform">
                    <svg
                      className="w-6 h-6 text-blue-600 dark:text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">
                    Email
                  </Label>
                  {isInterviewEditMode || isEditOnlyMode ? (
                    <input
                      type="email"
                      value={interviewEditForm.email}
                      onChange={(e) =>
                        setInterviewEditForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      placeholder="Email"
                    />
                  ) : applicant.email ? (
                    <a
                      href={`mailto:${applicant.email}?subject=${encodeURIComponent('Regarding your application')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Send email to ${applicant.email}`}
                      className="text-sm text-gray-900 dark:text-white break-words"
                    >
                      {applicant.email}
                    </a>
                  ) : (
                    <p className="text-sm text-gray-900 dark:text-white">-</p>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-green-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
                <div className="flex items-baseline gap-4">
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-green-100 dark:bg-green-900/30 rounded-lg group-hover:scale-110 transition-transform">
                    <svg
                      className="w-6 h-6 text-green-600 dark:text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">
                    Phone
                  </Label>
                  {isInterviewEditMode || isEditOnlyMode ? (
                    <input
                      type="tel"
                      value={interviewEditForm.phone}
                      onChange={(e) =>
                        setInterviewEditForm((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      placeholder="Phone"
                    />
                  ) : applicant.phone ? (
                    <>
                      <a
                        href="#"
                        onClick={(e) => handlePhoneClick(e, applicant.phone)}
                        className="text-sm text-gray-900 dark:text-white cursor-pointer hover:text-green-600 dark:hover:text-green-400 transition-colors"
                        aria-label={`Phone options for ${applicant.phone}`}
                      >
                        {applicant.phone}
                      </a>

                      <Menu
                        anchorEl={phoneMenuAnchor}
                        open={Boolean(phoneMenuAnchor)}
                        onClose={handlePhoneMenuClose}
                        onClick={(e) => e.stopPropagation()}
                        PaperProps={{
                          style: {
                            width: '200px',
                            marginTop: '8px',
                          },
                          className: 'rounded-lg shadow-lg',
                        }}
                      >
                        <MenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            copyPhoneNumber(selectedPhoneNumber);
                            handlePhoneMenuClose();
                          }}
                          className="flex items-center gap-3 py-2"
                        >
                          <svg
                            className="w-4 h-4 text-gray-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                            />
                          </svg>
                          <span>Copy Number</span>
                        </MenuItem>

                        <MenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openWhatsApp(selectedPhoneNumber);
                            handlePhoneMenuClose();
                          }}
                          className="flex items-center gap-3 py-2"
                        >
                          <svg
                            className="w-4 h-4 text-green-600"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.164-.573c.918.496 1.956.759 3.166.759 3.181 0 5.768-2.586 5.769-5.766.001-3.181-2.587-5.767-5.768-5.768zm3.392 8.244c-.144.405-.837.826-1.15.89-.312.064-.586.096-.946-.086-.36-.181-1.347-.655-1.693-1.164-.346-.509-.361-.764-.252-1.069.108-.305.264-.477.504-.765.24-.288.288-.432.432-.72.144-.288.072-.504-.036-.702-.108-.198-.612-1.274-.828-1.746-.216-.468-.432-.486-.612-.486s-.324-.018-.504-.018c-.252 0-.576.072-.864.36-.288.288-1.098 1.07-1.098 2.619 0 1.548 1.098 2.762 1.266 2.97.168.207 1.85 2.973 4.046 3.831.576.225.936.36 1.26.45.504.162.954.126 1.314.072.36-.054 1.026-.414 1.17-.81.144-.396.252-.81.144-.882-.108-.072-.504-.252-1.098-.702-.414-.306-.918-.666-1.134-.882-.216-.216-.36-.576-.108-.9.252-.324 1.008-1.26 1.134-1.512.126-.252.126-.432-.036-.666-.18-.234-.54-.468-.9-.648-.324-.162-.594-.288-.792-.234-.18.054-.324.234-.432.378-.108.144-.864 1.098-1.134 1.26s-.468.216-.72.036c-.288-.18-1.152-.558-1.368-.756-.216-.198-.36-.738-.144-1.08.216-.342.36-.486.54-.666.18-.18.24-.324.36-.522.12-.198.072-.414-.036-.648-.108-.234-.468-1.188-.612-1.584-.126-.36-.252-.36-.594-.36h-.648z" />
                          </svg>
                          <span>WhatsApp</span>
                        </MenuItem>

                        <MenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            makePhoneCall(selectedPhoneNumber);
                            handlePhoneMenuClose();
                          }}
                          className="flex items-center gap-3 py-2"
                        >
                          <svg
                            className="w-4 h-4 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                            />
                          </svg>
                          <span>Call</span>
                        </MenuItem>
                      </Menu>
                    </>
                  ) : (
                    <p className="text-sm text-gray-900 dark:text-white">-</p>
                  )}
                </div>
              </div>

              {/* Birth Date */}
              <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-teal-400 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
                <div className="flex items-baseline gap-4">
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-teal-100 dark:bg-teal-900/30 rounded-lg group-hover:scale-110 transition-transform">
                    <svg
                      className="w-6 h-6 text-teal-600 dark:text-teal-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">
                    Birth Date
                  </Label>
                  {isInterviewEditMode || isEditOnlyMode ? (
                    <input
                      type="date"
                      value={interviewEditForm.birthDate}
                      onChange={(e) =>
                        setInterviewEditForm((prev) => ({
                          ...prev,
                          birthDate: e.target.value,
                        }))
                      }
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-teal-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  ) : (
                    <p className="text-sm text-gray-900 dark:text-white">
                      {(() => {
                        const bd = getBirthDateValue();
                        return bd
                          ? new Date(bd).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '-';
                      })()}
                    </p>
                  )}
                </div>
              </div>

              {/* Gender */}
              <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-pink-400 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
                <div className="flex items-baseline gap-4">
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-pink-100 dark:bg-pink-900/30 rounded-lg group-hover:scale-110 transition-transform">
                    <svg
                      className="w-6 h-6 text-pink-600 dark:text-pink-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"
                      />
                    </svg>
                  </div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">
                    Gender
                  </Label>
                  {isInterviewEditMode || isEditOnlyMode ? (
                    <select
                      value={interviewEditForm.gender}
                      onChange={(e) =>
                        setInterviewEditForm((prev) => ({
                          ...prev,
                          gender: e.target.value,
                        }))
                      }
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-pink-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  ) : (
                    <p className="text-sm text-gray-900 dark:text-white">
                      {(() => {
                        const g = getGenderValue();
                        return g ? normalizeGenderLocal(g) : '-';
                      })()}
                    </p>
                  )}
                </div>
              </div>

              {/* Expected Salary */}
              <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-gray-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
                <div className="flex items-baseline gap-4">
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-900/30 rounded-lg group-hover:scale-110 transition-transform">
                    <svg
                      className="w-6 h-6 text-gray-600 dark:text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3 1.343 3 3-1.343 3-3 3"
                      />
                    </svg>
                  </div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">
                    Expected Salary
                  </Label>
                  {isInterviewEditMode || isEditOnlyMode ? (
                    <input
                      type="number"
                      min="0"
                      value={interviewEditForm.expectedSalary}
                      onChange={(e) =>
                        setInterviewEditForm((prev) => ({
                          ...prev,
                          expectedSalary: e.target.value,
                        }))
                      }
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      placeholder="Expected salary"
                    />
                  ) : (
                    <p
                      dir={
                        isArabic(String(applicant?.expectedSalary ?? ''))
                          ? 'rtl'
                          : undefined
                      }
                      className={`text-sm text-gray-900 dark:text-white break-words ${isArabic(String(applicant?.expectedSalary ?? '')) ? 'text-right' : ''}`}
                    >
                      {(() => {
                        const val = applicant?.expectedSalary;
                        return val !== undefined && val !== null
                          ? toPlainString(val)
                          : '-';
                      })()}
                    </p>
                  )}
                </div>
              </div>

              {/* Job Position */}
              <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-purple-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
                <div className="flex items-baseline gap-4">
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:scale-110 transition-transform">
                    <svg
                      className="w-6 h-6 text-purple-600 dark:text-purple-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">
                    Job Position
                  </Label>
                  <p
                    dir={isArabic(jobTitle.en) ? 'rtl' : undefined}
                    className={`text-sm font-semibold text-gray-900 dark:text-white break-words ${isArabic(jobTitle.en) ? 'text-right' : ''}`}
                  >
                    {jobTitle.en}
                  </p>
                </div>
              </div>

              {/* Company */}
              <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-orange-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
                <div className="flex items-baseline gap-4">
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-orange-100 dark:bg-orange-900/30 rounded-lg group-hover:scale-110 transition-transform">
                    <svg
                      className="w-6 h-6 text-orange-600 dark:text-orange-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">
                    Company
                  </Label>
                  <p
                    dir={isArabic(companyName) ? 'rtl' : undefined}
                    className={`text-sm text-gray-900 dark:text-white break-words ${isArabic(companyName) ? 'text-right' : ''}`}
                  >
                    {companyName}
                  </p>
                </div>
              </div>

              {/* Department */}
              <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-pink-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
                <div className="flex items-baseline gap-4">
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-pink-100 dark:bg-pink-900/30 rounded-lg group-hover:scale-110 transition-transform">
                    <svg
                      className="w-6 h-6 text-pink-600 dark:text-pink-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">
                    Department
                  </Label>
                  <p
                    dir={isArabic(departmentName) ? 'rtl' : undefined}
                    className={`text-sm text-gray-900 dark:text-white break-words ${isArabic(departmentName) ? 'text-right' : ''}`}
                  >
                    {departmentName}
                  </p>
                </div>
              </div>

              {/* Address */}
              <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-teal-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-teal-100 dark:bg-teal-900/30 rounded-lg group-hover:scale-110 transition-transform">
                      <svg
                        className="w-6 h-6 text-teal-600 dark:text-teal-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">
                      Address
                    </Label>
                  </div>
                  {isInterviewEditMode || isEditOnlyMode ? (
                    <input
                      type="text"
                      value={interviewEditForm.address}
                      onChange={(e) =>
                        setInterviewEditForm((prev) => ({
                          ...prev,
                          address: e.target.value,
                        }))
                      }
                      className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-teal-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      placeholder="Address"
                    />
                  ) : (
                    <p
                      dir={isArabic(applicant.address) ? 'rtl' : undefined}
                      className={`text-sm text-gray-900 dark:text-white break-words ${isArabic(applicant.address) ? 'text-right' : ''}`}
                    >
                      {applicant.address}
                    </p>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-yellow-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
                <div className="flex items-baseline gap-4">
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-yellow-100 dark:bg-yellow-900/30 rounded-lg group-hover:scale-110 transition-transform">
                    <svg
                      className="w-6 h-6 text-yellow-600 dark:text-yellow-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">
                    Status
                  </Label>
                  <span
                    className="inline-block rounded-full px-4 py-2 text-xs font-bold"
                    style={getStatusColor(String(applicant.status || ''))}
                  >
                    {String(applicant.status || '')
                      .charAt(0)
                      .toUpperCase() + String(applicant.status || '').slice(1)}
                  </span>
                </div>
              </div>

              {/* Submitted */}
              <div className="group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-indigo-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg">
                <div className="flex items-baseline gap-4">
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30 rounded-lg group-hover:scale-110 transition-transform">
                    <svg
                      className="w-6 h-6 text-indigo-600 dark:text-indigo-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">
                    Submitted
                  </Label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {formatDate(applicant.submittedAt)}
                  </p>
                </div>
              </div>

              {/* Resume */}
              {applicant.cvFilePath && (
                <div className="group relative pl-5 pr-5 py-5 bg-gradient-to-br from-brand-500 to-brand-600 dark:from-brand-600 dark:to-brand-700 backdrop-blur-sm rounded-xl border-l-4 border-brand-700 hover:shadow-2xl transition-all duration-200">
                  <div className="flex items-baseline gap-4">
                    <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <Label className="text-xs text-white/80 font-bold uppercase">
                      Resume
                    </Label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={downloadCv}
                        className="inline-flex items-center gap-2 text-sm font-bold text-white hover:text-white/90 transition-colors"
                      >
                        Download CV
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14 5l7 7m0 0l-7 7m7-7H3"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Job Specs With Details */}
        {(() => {
          const specs: any[] = (() => {
            if (jobPositionDetail) {
              if (
                Array.isArray((jobPositionDetail as any).jobSpecsWithDetails) &&
                (jobPositionDetail as any).jobSpecsWithDetails.length
              ) {
                return (jobPositionDetail as any).jobSpecsWithDetails;
              }
              if (
                Array.isArray((jobPositionDetail as any).jobSpecs) &&
                (jobPositionDetail as any).jobSpecs.length
              ) {
                return (jobPositionDetail as any).jobSpecs;
              }
            }
            const getSpecsFromPopulatedJobPos = (src: any) => {
              if (!src) return [];
              const jp =
                typeof src.jobPositionId === 'object'
                  ? src.jobPositionId
                  : src.jobPosition;
              if (!jp) return [];
              if (
                Array.isArray(jp.jobSpecsWithDetails) &&
                jp.jobSpecsWithDetails.length
              )
                return jp.jobSpecsWithDetails;
              if (Array.isArray(jp.jobSpecs) && jp.jobSpecs.length)
                return jp.jobSpecs;
              return [];
            };
            const popFromFetched = getSpecsFromPopulatedJobPos(
              fetchedApplicant as any
            );
            if (popFromFetched.length) return popFromFetched;
            const popFromState = getSpecsFromPopulatedJobPos(
              stateApplicant as any
            );
            if (popFromState.length) return popFromState;
            try {
              const _appSrc = (fetchedApplicant ?? stateApplicant) as any;
              let resolvedId: string | undefined;
              if (_appSrc) {
                if (typeof _appSrc.jobPositionId === 'string')
                  resolvedId = _appSrc.jobPositionId;
                else if (
                  typeof _appSrc.jobPositionId === 'object' &&
                  _appSrc.jobPositionId?._id
                )
                  resolvedId = _appSrc.jobPositionId._id;
              }
              if (resolvedId && Array.isArray(jobPositions)) {
                const found = jobPositions.find(
                  (j: any) => String(j._id) === String(resolvedId)
                );
                if (found) {
                  if (
                    Array.isArray((found as any).jobSpecsWithDetails) &&
                    (found as any).jobSpecsWithDetails.length
                  )
                    return (found as any).jobSpecsWithDetails;
                  if (
                    Array.isArray((found as any).jobSpecs) &&
                    (found as any).jobSpecs.length
                  )
                    return (found as any).jobSpecs;
                }
              }
            } catch (e) {}
            return [];
          })();

          const appSrc = (fetchedApplicant ??
            stateApplicant ??
            applicant) as any;
          const appSpecs: any[] = (() => {
            if (
              Array.isArray(appSrc?.jobSpecsWithDetails) &&
              appSrc.jobSpecsWithDetails.length
            )
              return appSrc.jobSpecsWithDetails;
            if (Array.isArray(appSrc?.jobSpecs) && appSrc.jobSpecs.length)
              return appSrc.jobSpecs;
            if (typeof appSrc?.jobPositionId === 'object') {
              const jp = appSrc.jobPositionId;
              if (
                Array.isArray(jp?.jobSpecsWithDetails) &&
                jp.jobSpecsWithDetails.length
              )
                return jp.jobSpecsWithDetails;
              if (Array.isArray(jp?.jobSpecs) && jp.jobSpecs.length)
                return jp.jobSpecs;
            }
            return [];
          })();

          const applicantAnswerMap: Record<string, boolean> = {};
          for (const s of appSpecs) {
            if (!s) continue;
            const ids = [s._id, s.id, s.jobSpecId]
              .filter(Boolean)
              .map((x: any) =>
                typeof x === 'object' ? (x._id ?? x.id ?? String(x)) : String(x)
              );
            for (const id of ids) {
              applicantAnswerMap[id] =
                typeof s.answer === 'boolean' ? s.answer : Boolean(s.answer);
            }
          }

          const getAnswer = (specEntry: any, idx: number): boolean => {
            if (!specEntry) return false;
            const specId = String(specEntry._id ?? specEntry.id ?? '');
            if (specId && applicantAnswerMap[specId] !== undefined) {
              return applicantAnswerMap[specId];
            }
            if (appSpecs[idx] !== undefined) {
              const a = appSpecs[idx].answer;
              return typeof a === 'boolean' ? a : Boolean(a);
            }
            return false;
          };

          const getSpecResponseId = (specEntry: any): string => {
            const direct = normalizeSpecId(
              specEntry?.jobSpecId ?? specEntry?._id ?? specEntry?.id
            );
            if (direct) return direct;
            if (
              specEntry?.jobSpecId &&
              typeof specEntry.jobSpecId === 'object'
            ) {
              return normalizeSpecId(specEntry.jobSpecId);
            }
            return '';
          };

          const interviewResponseMap = new Map<string, boolean>();
          if (isInterviewEditMode) {
            (interviewEditForm.jobSpecsResponses || []).forEach((r) => {
              if (!r?.jobSpecId) return;
              interviewResponseMap.set(String(r.jobSpecId), Boolean(r.answer));
            });
          }

          const getEffectiveAnswer = (specEntry: any, idx: number): boolean => {
            if (isInterviewEditMode) {
              const specId = getSpecResponseId(specEntry);
              if (specId && interviewResponseMap.has(specId)) {
                return Boolean(interviewResponseMap.get(specId));
              }
            }
            return getAnswer(specEntry, idx);
          };

          if (!specs || specs.length === 0) return null;

          return (
            <div className="mt-8 mb-8 relative overflow-hidden rounded-2xl bg-white shadow-xl">
              <div className="absolute inset-0 bg-linear-to-br from-indigo-500/5 via-purple-500/5 to-blue-500/5" />
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
              <div className="relative p-8">
                <div className="mb-6 flex items-start gap-4">
                  <div className="shrink-0 p-3 bg-linear-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-lg">
                    <svg
                      className="w-7 h-7 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-extrabold bg-linear-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                      Job Specifications
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Required skills and qualifications assessment
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {specs.map((s: any, idx: number) => {
                    const specText: string = (() => {
                      const appSpec = appSpecs[idx];
                      if (appSpec?.spec) {
                        if (typeof appSpec.spec === 'string')
                          return appSpec.spec;
                        if (typeof appSpec.spec === 'object') {
                          return (
                            appSpec.spec.en ??
                            appSpec.spec.ar ??
                            appSpec.spec.value ??
                            ''
                          );
                        }
                      }
                      if (typeof s.spec === 'string') return s.spec;
                      if (s.spec && typeof s.spec === 'object') {
                        return s.spec.en ?? s.spec.ar ?? s.spec.value ?? '';
                      }
                      return '';
                    })();
                    const weight: number =
                      typeof s.weight === 'number'
                        ? s.weight
                        : Number(s.weight ?? 0);
                    const specResponseId = getSpecResponseId(s);
                    const answered: boolean = getEffectiveAnswer(s, idx);

                    return (
                      <div
                        key={s.jobSpecId || s._id || idx}
                        className="group relative pl-5 pr-5 py-5 bg-white/60 backdrop-blur-sm rounded-xl border-l-4 border-indigo-500 hover:bg-white transition-all duration-200 hover:shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-base font-bold text-gray-900 ${isArabic(specText) ? 'text-right' : 'text-left'}`}
                          >
                            {specText || '(no spec)'}
                          </p>
                          {s.description && (
                            <p
                              className={`mt-1 text-sm text-gray-500 ${isArabic(s.description) ? 'text-right' : 'text-left'}`}
                            >
                              {String(s.description)}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-xs font-bold text-indigo-700 border border-indigo-100">
                            <svg
                              className="w-3.5 h-3.5 mr-1.5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <circle cx="12" cy="12" r="9" />
                              <line x1="12" y1="8" x2="12" y2="16" />
                              <line x1="8" y1="12" x2="16" y2="12" />
                            </svg>
                            Weight: {weight}
                          </div>

                          {isInterviewEditMode ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (!specResponseId) return;
                                updateInterviewJobSpecAnswer(
                                  specResponseId,
                                  !answered
                                );
                              }}
                              disabled={!specResponseId}
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                                answered
                                  ? 'bg-green-50 text-green-700 border-green-100'
                                  : 'bg-gray-50 text-gray-500 border-gray-200'
                              } ${specResponseId ? 'hover:opacity-90' : 'opacity-50 cursor-not-allowed'}`}
                            >
                              {answered ? (
                                <>
                                  <svg
                                    className="w-3.5 h-3.5 mr-1.5 text-green-600"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={3}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                  <span>Met</span>
                                </>
                              ) : (
                                <>
                                  <svg
                                    className="w-3.5 h-3.5 mr-1.5 text-gray-400"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={3}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                  <span>Not met</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <div
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                                answered
                                  ? 'bg-green-50 text-green-700 border-green-100'
                                  : 'bg-gray-50 text-gray-500 border-gray-200'
                              }`}
                            >
                              {answered ? (
                                <>
                                  <svg
                                    className="w-3.5 h-3.5 mr-1.5 text-green-600"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={3}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                  <span>Met</span>
                                </>
                              ) : (
                                <>
                                  <svg
                                    className="w-3.5 h-3.5 mr-1.5 text-gray-400"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={3}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                  <span>Not met</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Custom Responses Section */}
        {isInterviewEditMode || isEditOnlyMode ? (
          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 border-2 border-blue-200 dark:border-blue-900/50 shadow-lg">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 px-8 py-6">
              <h3 className="text-2xl font-extrabold text-white">
                Custom Responses (Editable)
              </h3>
              <p className="text-sm text-blue-100 mt-0.5">
                Edit applicant responses using this job&apos;s custom fields
              </p>
            </div>
            <div className="p-8 space-y-5">
              {editableCustomFieldsForInterview.length === 0 ? (
                <div className="rounded-xl border border-dashed border-blue-200 bg-white/70 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                  No custom fields found for this job position.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[...editableCustomFieldsForInterview]
                    .sort((a: any, b: any) => {
                      const ao = Number(a?.displayOrder ?? a?.order ?? 0);
                      const bo = Number(b?.displayOrder ?? b?.order ?? 0);
                      return ao - bo;
                    })
                    .map((field: any, fieldIndex: number) => {
                      const fieldId = getCustomFieldId(field, fieldIndex);
                      const fieldLabel = getCustomFieldLabelText(field);
                      const rawValue =
                        interviewEditForm.customResponses?.[fieldId];
                      const inputType = String(
                        field?.inputType ||
                          inferCustomResponseInputType(rawValue) ||
                          'text'
                      ).toLowerCase();
                      const choices = getCustomFieldChoices(field);
                      const groupFields = getCustomFieldGroupFields(field);
                      const isInferredField = Boolean(
                        field?.__inferredFromResponse
                      );

                      return (
                        <div
                          key={`custom_field_${fieldId}_${fieldIndex}`}
                          className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                        >
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <Label className="text-xs text-blue-700 dark:text-blue-300 font-bold uppercase">
                              {fieldLabel}
                            </Label>
                            <div className="flex items-center gap-1.5">
                              {isInferredField && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                                  from request
                                </span>
                              )}
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                                {inputType.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>

                          {inputType === 'repeatable_group' ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Add multiple entries for this grouped field.
                                </p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    addInterviewRepeatableRow(field, fieldId)
                                  }
                                  className="inline-flex items-center rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                >
                                  <PlusIcon className="h-3 w-3 mr-1" />
                                  Add Entry
                                </button>
                              </div>

                              {Array.isArray(rawValue) &&
                              rawValue.length > 0 ? (
                                <div className="space-y-3">
                                  {rawValue.map(
                                    (row: any, rowIndex: number) => (
                                      <div
                                        key={`${fieldId}_row_${rowIndex}`}
                                        className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                                      >
                                        <div className="mb-3 flex items-center justify-between">
                                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                            Entry #{rowIndex + 1}
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              removeInterviewRepeatableRow(
                                                fieldId,
                                                rowIndex
                                              )
                                            }
                                            className="text-xs font-semibold text-red-600 hover:text-red-700"
                                          >
                                            Remove
                                          </button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3">
                                          {groupFields.map(
                                            (
                                              subField: any,
                                              subFieldIndex: number
                                            ) => {
                                              const subFieldId =
                                                getCustomFieldId(
                                                  subField,
                                                  subFieldIndex
                                                );
                                              const subLabel =
                                                getCustomFieldLabelText(
                                                  subField
                                                );
                                              const subValue =
                                                row?.[subFieldId];
                                              const subInputType = String(
                                                subField?.inputType ||
                                                  inferCustomResponseInputType(
                                                    subValue
                                                  ) ||
                                                  'text'
                                              ).toLowerCase();
                                              const subChoices =
                                                getCustomFieldChoices(subField);

                                              return (
                                                <div
                                                  key={`${fieldId}_${subFieldId}_${subFieldIndex}`}
                                                >
                                                  <Label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400">
                                                    {subLabel}
                                                  </Label>

                                                  {subInputType ===
                                                  'textarea' ? (
                                                    <textarea
                                                      value={subValue ?? ''}
                                                      onChange={(e) =>
                                                        updateInterviewRepeatableCell(
                                                          fieldId,
                                                          rowIndex,
                                                          subFieldId,
                                                          e.target.value
                                                        )
                                                      }
                                                      rows={3}
                                                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                                    />
                                                  ) : subInputType ===
                                                    'json' ? (
                                                    <textarea
                                                      value={subValue ?? ''}
                                                      onChange={(e) =>
                                                        updateInterviewRepeatableCell(
                                                          fieldId,
                                                          rowIndex,
                                                          subFieldId,
                                                          e.target.value
                                                        )
                                                      }
                                                      rows={5}
                                                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-mono text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                                      placeholder='{"key": "value"}'
                                                    />
                                                  ) : subInputType ===
                                                    'dropdown' ? (
                                                    <select
                                                      value={subValue ?? ''}
                                                      onChange={(e) =>
                                                        updateInterviewRepeatableCell(
                                                          fieldId,
                                                          rowIndex,
                                                          subFieldId,
                                                          e.target.value
                                                        )
                                                      }
                                                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                                    >
                                                      <option value="">
                                                        Select
                                                      </option>
                                                      {subChoices.map(
                                                        (choice: string) => (
                                                          <option
                                                            key={`${subFieldId}_${choice}`}
                                                            value={choice}
                                                          >
                                                            {choice}
                                                          </option>
                                                        )
                                                      )}
                                                    </select>
                                                  ) : subInputType ===
                                                    'radio' ? (
                                                    <div className="space-y-1">
                                                      {subChoices.map(
                                                        (choice: string) => (
                                                          <label
                                                            key={`${subFieldId}_${choice}`}
                                                            className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                                                          >
                                                            <input
                                                              type="radio"
                                                              name={`${fieldId}_${rowIndex}_${subFieldId}`}
                                                              checked={
                                                                String(
                                                                  subValue ?? ''
                                                                ) === choice
                                                              }
                                                              onChange={() =>
                                                                updateInterviewRepeatableCell(
                                                                  fieldId,
                                                                  rowIndex,
                                                                  subFieldId,
                                                                  choice
                                                                )
                                                              }
                                                            />
                                                            <span>
                                                              {choice}
                                                            </span>
                                                          </label>
                                                        )
                                                      )}
                                                    </div>
                                                  ) : subInputType ===
                                                    'checkbox' ? (
                                                    subChoices.length > 0 ? (
                                                      <div className="space-y-1">
                                                        {subChoices.map(
                                                          (choice: string) => {
                                                            const selected =
                                                              Array.isArray(
                                                                subValue
                                                              )
                                                                ? subValue.map(
                                                                    (v: any) =>
                                                                      String(v)
                                                                  )
                                                                : [];
                                                            const checked =
                                                              selected.includes(
                                                                choice
                                                              );
                                                            return (
                                                              <label
                                                                key={`${subFieldId}_${choice}`}
                                                                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                                                              >
                                                                <input
                                                                  type="checkbox"
                                                                  checked={
                                                                    checked
                                                                  }
                                                                  onChange={(
                                                                    e
                                                                  ) => {
                                                                    const next =
                                                                      e.target
                                                                        .checked
                                                                        ? [
                                                                            ...new Set(
                                                                              [
                                                                                ...selected,
                                                                                choice,
                                                                              ]
                                                                            ),
                                                                          ]
                                                                        : selected.filter(
                                                                            (
                                                                              v: string
                                                                            ) =>
                                                                              v !==
                                                                              choice
                                                                          );
                                                                    updateInterviewRepeatableCell(
                                                                      fieldId,
                                                                      rowIndex,
                                                                      subFieldId,
                                                                      next
                                                                    );
                                                                  }}
                                                                />
                                                                <span>
                                                                  {choice}
                                                                </span>
                                                              </label>
                                                            );
                                                          }
                                                        )}
                                                      </div>
                                                    ) : (
                                                      <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                        <input
                                                          type="checkbox"
                                                          checked={Boolean(
                                                            subValue
                                                          )}
                                                          onChange={(e) =>
                                                            updateInterviewRepeatableCell(
                                                              fieldId,
                                                              rowIndex,
                                                              subFieldId,
                                                              e.target.checked
                                                            )
                                                          }
                                                        />
                                                        <span>Checked</span>
                                                      </label>
                                                    )
                                                  ) : subInputType ===
                                                    'tags' ? (
                                                    <div className="mb-2 flex min-h-11 rounded-lg border border-gray-300 py-1.5 pl-3 pr-3 shadow-theme-xs outline-hidden transition focus-within:border-blue-500 dark:border-gray-700 dark:bg-gray-900">
                                                      <div className="flex flex-wrap flex-auto gap-2 items-center">
                                                        {Array.isArray(
                                                          subValue
                                                        ) && subValue.length > 0
                                                          ? subValue.map(
                                                              (tagVal: any) => {
                                                                const text =
                                                                  String(
                                                                    tagVal
                                                                  );
                                                                return (
                                                                  <div
                                                                    key={`${fieldId}_${rowIndex}_${subFieldId}_${text}`}
                                                                    className="group flex items-center justify-center rounded-full border-[0.7px] border-transparent bg-gray-100 py-1 pl-2.5 pr-2 text-sm text-gray-800 hover:border-gray-200 dark:bg-gray-800 dark:text-white/90 dark:hover:border-gray-800"
                                                                  >
                                                                    <span className="flex-initial max-w-full">
                                                                      {text}
                                                                    </span>
                                                                    <button
                                                                      type="button"
                                                                      onClick={(
                                                                        e
                                                                      ) => {
                                                                        e.stopPropagation();
                                                                        const curr =
                                                                          Array.isArray(
                                                                            subValue
                                                                          )
                                                                            ? subValue
                                                                            : [];
                                                                        const next =
                                                                          curr.filter(
                                                                            (
                                                                              t: any
                                                                            ) =>
                                                                              String(
                                                                                t
                                                                              ) !==
                                                                              String(
                                                                                tagVal
                                                                              )
                                                                          );
                                                                        updateInterviewRepeatableCell(
                                                                          fieldId,
                                                                          rowIndex,
                                                                          subFieldId,
                                                                          next
                                                                        );
                                                                      }}
                                                                      className="pl-2 text-gray-500 cursor-pointer group-hover:text-gray-400 dark:text-gray-400"
                                                                      aria-label={`Remove ${text}`}
                                                                    >
                                                                      <svg
                                                                        className="fill-current"
                                                                        width="14"
                                                                        height="14"
                                                                        viewBox="0 0 14 14"
                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                      >
                                                                        <path
                                                                          fillRule="evenodd"
                                                                          clipRule="evenodd"
                                                                          d="M3.40717 4.46881C3.11428 4.17591 3.11428 3.70104 3.40717 3.40815C3.70006 3.11525 4.17494 3.11525 4.46783 3.40815L6.99943 5.93975L9.53095 3.40822C9.82385 3.11533 10.2987 3.11533 10.5916 3.40822C10.8845 3.70112 10.8845 4.17599 10.5916 4.46888L8.06009 7.00041L10.5916 9.53193C10.8845 9.82482 10.8845 10.2997 10.5916 10.5926C10.2987 10.8855 9.82385 10.8855 9.53095 10.5926L6.99943 8.06107L4.46783 10.5927C4.17494 10.8856 3.70006 10.8856 3.40717 10.5927C3.11428 10.2998 3.11428 9.8249 3.40717 9.53201L5.93877 7.00041L3.40717 4.46881Z"
                                                                        />
                                                                      </svg>
                                                                    </button>
                                                                  </div>
                                                                );
                                                              }
                                                            )
                                                          : null}

                                                        <input
                                                          type="text"
                                                          value={
                                                            tagInputBuffers[
                                                              `${fieldId}__${rowIndex}__${subFieldId}`
                                                            ] ?? ''
                                                          }
                                                          onChange={(e) => {
                                                            const key = `${fieldId}__${rowIndex}__${subFieldId}`;
                                                            const v =
                                                              e.target.value;
                                                            setTagInputBuffers(
                                                              (prev) => ({
                                                                ...prev,
                                                                [key]: v,
                                                              })
                                                            );
                                                            if (
                                                              v.includes(',')
                                                            ) {
                                                              const next = v
                                                                .split(',')
                                                                .map((vv) =>
                                                                  vv.trim()
                                                                )
                                                                .filter(
                                                                  Boolean
                                                                );
                                                              const currentArr =
                                                                Array.isArray(
                                                                  subValue
                                                                )
                                                                  ? subValue
                                                                  : [];
                                                              const merged =
                                                                mergeTags(
                                                                  currentArr,
                                                                  next
                                                                );
                                                              updateInterviewRepeatableCell(
                                                                fieldId,
                                                                rowIndex,
                                                                subFieldId,
                                                                merged
                                                              );
                                                              setTagInputBuffers(
                                                                (prev) => ({
                                                                  ...prev,
                                                                  [key]: '',
                                                                })
                                                              );
                                                            }
                                                          }}
                                                          onKeyDown={(e) => {
                                                            if (
                                                              e.key === 'Enter'
                                                            ) {
                                                              e.preventDefault();
                                                              const key = `${fieldId}__${rowIndex}__${subFieldId}`;
                                                              const buf = (
                                                                tagInputBuffers[
                                                                  key
                                                                ] ?? ''
                                                              ).toString();
                                                              if (
                                                                !buf ||
                                                                !buf.trim()
                                                              ) {
                                                                setTagInputBuffers(
                                                                  (prev) => ({
                                                                    ...prev,
                                                                    [key]: '',
                                                                  })
                                                                );
                                                                return;
                                                              }
                                                              const next = buf
                                                                .split(',')
                                                                .map((vv) =>
                                                                  vv.trim()
                                                                )
                                                                .filter(
                                                                  Boolean
                                                                );
                                                              if (next.length) {
                                                                const currentArr =
                                                                  Array.isArray(
                                                                    subValue
                                                                  )
                                                                    ? subValue
                                                                    : [];
                                                                const merged =
                                                                  mergeTags(
                                                                    currentArr,
                                                                    next
                                                                  );
                                                                updateInterviewRepeatableCell(
                                                                  fieldId,
                                                                  rowIndex,
                                                                  subFieldId,
                                                                  merged
                                                                );
                                                              }
                                                              setTagInputBuffers(
                                                                (prev) => ({
                                                                  ...prev,
                                                                  [key]: '',
                                                                })
                                                              );
                                                            }
                                                          }}
                                                          onBlur={() => {
                                                            const key = `${fieldId}__${rowIndex}__${subFieldId}`;
                                                            const buf = (
                                                              tagInputBuffers[
                                                                key
                                                              ] ?? ''
                                                            ).toString();
                                                            if (
                                                              buf &&
                                                              buf.trim()
                                                            ) {
                                                              const next = buf
                                                                .split(',')
                                                                .map((vv) =>
                                                                  vv.trim()
                                                                )
                                                                .filter(
                                                                  Boolean
                                                                );
                                                              const currentArr =
                                                                Array.isArray(
                                                                  subValue
                                                                )
                                                                  ? subValue
                                                                  : [];
                                                              const merged =
                                                                mergeTags(
                                                                  currentArr,
                                                                  next
                                                                );
                                                              updateInterviewRepeatableCell(
                                                                fieldId,
                                                                rowIndex,
                                                                subFieldId,
                                                                merged
                                                              );
                                                              setTagInputBuffers(
                                                                (prev) => ({
                                                                  ...prev,
                                                                  [key]: '',
                                                                })
                                                              );
                                                            }
                                                          }}
                                                          className="flex-1 bg-transparent p-1 text-sm text-gray-800 outline-none dark:text-white/90"
                                                          placeholder="tag1, tag2, tag3"
                                                        />
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <input
                                                      type={
                                                        subInputType ===
                                                        'number'
                                                          ? 'number'
                                                          : subInputType ===
                                                              'date'
                                                            ? 'date'
                                                            : subInputType ===
                                                                'email'
                                                              ? 'email'
                                                              : subInputType ===
                                                                  'url'
                                                                ? 'url'
                                                                : subInputType ===
                                                                    'phone'
                                                                  ? 'tel'
                                                                  : 'text'
                                                      }
                                                      value={subValue ?? ''}
                                                      onChange={(e) =>
                                                        updateInterviewRepeatableCell(
                                                          fieldId,
                                                          rowIndex,
                                                          subFieldId,
                                                          e.target.value
                                                        )
                                                      }
                                                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                                    />
                                                  )}
                                                </div>
                                              );
                                            }
                                          )}
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              ) : (
                                <p className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                  No entries yet.
                                </p>
                              )}
                            </div>
                          ) : inputType === 'textarea' ? (
                            <textarea
                              value={rawValue ?? ''}
                              onChange={(e) =>
                                setInterviewCustomFieldValue(
                                  fieldId,
                                  e.target.value
                                )
                              }
                              rows={4}
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            />
                          ) : inputType === 'json' ? (
                            <textarea
                              value={rawValue ?? ''}
                              onChange={(e) =>
                                setInterviewCustomFieldValue(
                                  fieldId,
                                  e.target.value
                                )
                              }
                              rows={6}
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-mono text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                              placeholder='{"key": "value"}'
                            />
                          ) : inputType === 'dropdown' ? (
                            <select
                              value={rawValue ?? ''}
                              onChange={(e) =>
                                setInterviewCustomFieldValue(
                                  fieldId,
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            >
                              <option value="">Select</option>
                              {choices.map((choice: string) => (
                                <option
                                  key={`${fieldId}_${choice}`}
                                  value={choice}
                                >
                                  {choice}
                                </option>
                              ))}
                            </select>
                          ) : inputType === 'radio' ? (
                            <div className="space-y-1">
                              {choices.map((choice: string) => (
                                <label
                                  key={`${fieldId}_${choice}`}
                                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                                >
                                  <input
                                    type="radio"
                                    name={`field_${fieldId}`}
                                    checked={String(rawValue ?? '') === choice}
                                    onChange={() =>
                                      setInterviewCustomFieldValue(
                                        fieldId,
                                        choice
                                      )
                                    }
                                  />
                                  <span>{choice}</span>
                                </label>
                              ))}
                            </div>
                          ) : inputType === 'checkbox' ? (
                            choices.length > 0 ? (
                              <div className="space-y-1">
                                {choices.map((choice: string) => {
                                  const selected = Array.isArray(rawValue)
                                    ? rawValue.map((v: any) => String(v))
                                    : [];
                                  const checked = selected.includes(choice);
                                  return (
                                    <label
                                      key={`${fieldId}_${choice}`}
                                      className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                          const next = e.target.checked
                                            ? [
                                                ...new Set([
                                                  ...selected,
                                                  choice,
                                                ]),
                                              ]
                                            : selected.filter(
                                                (v: string) => v !== choice
                                              );
                                          setInterviewCustomFieldValue(
                                            fieldId,
                                            next
                                          );
                                        }}
                                      />
                                      <span>{choice}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input
                                  type="checkbox"
                                  checked={Boolean(rawValue)}
                                  onChange={(e) =>
                                    setInterviewCustomFieldValue(
                                      fieldId,
                                      e.target.checked
                                    )
                                  }
                                />
                                <span>Checked</span>
                              </label>
                            )
                          ) : inputType === 'tags' ? (
                            <div className="mb-2 flex min-h-11 rounded-lg border border-gray-300 py-1.5 pl-3 pr-3 shadow-theme-xs outline-hidden transition focus-within:border-blue-500 dark:border-gray-700 dark:bg-gray-900">
                              <div className="flex flex-wrap flex-auto gap-2 items-center">
                                {Array.isArray(rawValue) && rawValue.length > 0
                                  ? rawValue.map((tagVal: any) => {
                                      const text = String(tagVal);
                                      return (
                                        <div
                                          key={`${fieldId}_tag_${text}`}
                                          className="group flex items-center justify-center rounded-full border-[0.7px] border-transparent bg-gray-100 py-1 pl-2.5 pr-2 text-sm text-gray-800 hover:border-gray-200 dark:bg-gray-800 dark:text-white/90 dark:hover:border-gray-800"
                                        >
                                          <span className="flex-initial max-w-full">
                                            {text}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const curr = Array.isArray(
                                                rawValue
                                              )
                                                ? rawValue
                                                : [];
                                              const next = curr.filter(
                                                (t: any) =>
                                                  String(t) !== String(tagVal)
                                              );
                                              setInterviewCustomFieldValue(
                                                fieldId,
                                                next
                                              );
                                            }}
                                            className="pl-2 text-gray-500 cursor-pointer group-hover:text-gray-400 dark:text-gray-400"
                                            aria-label={`Remove ${text}`}
                                          >
                                            <svg
                                              className="fill-current"
                                              width="14"
                                              height="14"
                                              viewBox="0 0 14 14"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <path
                                                fillRule="evenodd"
                                                clipRule="evenodd"
                                                d="M3.40717 4.46881C3.11428 4.17591 3.11428 3.70104 3.40717 3.40815C3.70006 3.11525 4.17494 3.11525 4.46783 3.40815L6.99943 5.93975L9.53095 3.40822C9.82385 3.11533 10.2987 3.11533 10.5916 3.40822C10.8845 3.70112 10.8845 4.17599 10.5916 4.46888L8.06009 7.00041L10.5916 9.53193C10.8845 9.82482 10.8845 10.2997 10.5916 10.5926C10.2987 10.8855 9.82385 10.8855 9.53095 10.5926L6.99943 8.06107L4.46783 10.5927C4.17494 10.8856 3.70006 10.8856 3.40717 10.5927C3.11428 10.2998 3.11428 9.8249 3.40717 9.53201L5.93877 7.00041L3.40717 4.46881Z"
                                              />
                                            </svg>
                                          </button>
                                        </div>
                                      );
                                    })
                                  : null}

                                <input
                                  type="text"
                                  value={tagInputBuffers[fieldId] ?? ''}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setTagInputBuffers((prev) => ({
                                      ...prev,
                                      [fieldId]: v,
                                    }));
                                    if (v.includes(',')) {
                                      const next = v
                                        .split(',')
                                        .map((vv) => vv.trim())
                                        .filter(Boolean);
                                      const currentArr = Array.isArray(rawValue)
                                        ? rawValue
                                        : [];
                                      const merged = mergeTags(
                                        currentArr,
                                        next
                                      );
                                      setInterviewCustomFieldValue(
                                        fieldId,
                                        merged
                                      );
                                      setTagInputBuffers((prev) => ({
                                        ...prev,
                                        [fieldId]: '',
                                      }));
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const buf = (
                                        tagInputBuffers[fieldId] ?? ''
                                      ).toString();
                                      if (!buf || !buf.trim()) {
                                        setTagInputBuffers((prev) => ({
                                          ...prev,
                                          [fieldId]: '',
                                        }));
                                        return;
                                      }
                                      const next = buf
                                        .split(',')
                                        .map((vv) => vv.trim())
                                        .filter(Boolean);
                                      if (next.length) {
                                        const currentArr = Array.isArray(
                                          rawValue
                                        )
                                          ? rawValue
                                          : [];
                                        const merged = mergeTags(
                                          currentArr,
                                          next
                                        );
                                        setInterviewCustomFieldValue(
                                          fieldId,
                                          merged
                                        );
                                      }
                                      setTagInputBuffers((prev) => ({
                                        ...prev,
                                        [fieldId]: '',
                                      }));
                                    }
                                  }}
                                  onBlur={() => {
                                    const buf = (
                                      tagInputBuffers[fieldId] ?? ''
                                    ).toString();
                                    if (buf && buf.trim()) {
                                      const next = buf
                                        .split(',')
                                        .map((vv) => vv.trim())
                                        .filter(Boolean);
                                      const currentArr = Array.isArray(rawValue)
                                        ? rawValue
                                        : [];
                                      const merged = mergeTags(
                                        currentArr,
                                        next
                                      );
                                      setInterviewCustomFieldValue(
                                        fieldId,
                                        merged
                                      );
                                      setTagInputBuffers((prev) => ({
                                        ...prev,
                                        [fieldId]: '',
                                      }));
                                    }
                                  }}
                                  className="flex-1 bg-transparent p-1 text-sm text-gray-800 outline-none dark:text-white/90"
                                  placeholder="tag1, tag2, tag3"
                                />
                              </div>
                            </div>
                          ) : (
                            <input
                              type={
                                inputType === 'number'
                                  ? 'number'
                                  : inputType === 'date'
                                    ? 'date'
                                    : inputType === 'email'
                                      ? 'email'
                                      : inputType === 'url'
                                        ? 'url'
                                        : inputType === 'phone'
                                          ? 'tel'
                                          : 'text'
                              }
                              value={rawValue ?? ''}
                              onChange={(e) =>
                                setInterviewCustomFieldValue(
                                  fieldId,
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            />
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <CustomResponses
            applicant={applicant}
            customFields={customFieldsForInterview}
          />
        )}

        {/* Questions Section - only show when NOT in edit-only mode */}
        {!isEditOnlyMode && !isInterviewEditMode && (
          <div onClick={(e) => e.stopPropagation()}>
            <Questions
              status={applicant?.status}
              interviews={applicantInterviews}
              className="mt-4"
            />
          </div>
        )}

        {/* Interview Questions Edit Section - only show in full interview edit mode */}
        {isInterviewEditMode && !isEditOnlyMode && (
          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-gray-900 dark:to-gray-800 border-2 border-violet-200 dark:border-violet-900/50 shadow-lg">
            <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-violet-700 dark:to-fuchsia-700 px-8 py-6">
              <h3 className="text-2xl font-extrabold text-white">
                Interview Questions
              </h3>
              <p className="text-sm text-violet-100 mt-0.5">
                Questions come from interview settings/interview record, and you
                only fill answers.
              </p>
            </div>

            <div className="p-8 space-y-6">
              {/* Interview Target Section */}
              <div className="rounded-xl border border-violet-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <Label className="mb-3 block text-xs text-violet-700 dark:text-violet-300 font-bold uppercase">
                  Interview Target
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">
                    <input
                      type="radio"
                      name="interview-target-mode"
                      checked={interviewTargetMode === 'existing'}
                      onChange={() =>
                        handleInterviewTargetModeChange('existing')
                      }
                    />
                    <span>Use Existing Interview</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">
                    <input
                      type="radio"
                      name="interview-target-mode"
                      checked={interviewTargetMode === 'new'}
                      onChange={() => handleInterviewTargetModeChange('new')}
                    />
                    <span>Create New Interview</span>
                  </label>
                </div>
                {interviewTargetMode === 'existing' ? (
                  <div className="mt-3 space-y-1">
                    <Label className="text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400">
                      Select Existing Interview
                    </Label>
                    {applicantInterviews.length === 0 ? (
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        No existing interviews found. Switch to "Create New
                        Interview" to create one on save.
                      </p>
                    ) : (
                      <select
                        value={interviewTargetId}
                        onChange={(e) =>
                          handleExistingInterviewSelection(e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-violet-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      >
                        <option value="">Select interview</option>
                        {applicantInterviews.map((iv: any, index: number) => {
                          const interviewId = String(iv?._id || '');
                          if (!interviewId) return null;
                          const statusText = String(iv?.status || 'scheduled')
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (char) => char.toUpperCase());
                          const typeText = iv?.type
                            ? ` | ${String(iv.type)}`
                            : '';
                          const whenRaw =
                            iv?.startedAt || iv?.scheduledAt || iv?.issuedAt;
                          const whenText = whenRaw
                            ? formatDate(whenRaw)
                            : 'No date';
                          return (
                            <option key={interviewId} value={interviewId}>
                              {`Interview ${index + 1} | ${statusText}${typeText} | ${whenText}`}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                    A new interview record will be created automatically when
                    you save these questions.
                  </p>
                )}
              </div>

              {/* Question Groups Section */}
              <div className="rounded-xl border border-violet-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Label className="text-xs text-violet-700 dark:text-violet-300 font-bold uppercase">
                    Question Groups (Company Settings)
                  </Label>
                </div>
                {companyInterviewGroups.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No question groups found in company interview settings.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {companyInterviewGroups.map((group) => {
                      const checked = selectedQuestionGroupIds.includes(
                        group.id
                      );
                      return (
                        <label
                          key={group.id}
                          className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold truncate">
                              {group.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {group.questions.length} questions
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const nextChecked = e.target.checked;
                              setSelectedQuestionGroupIds((prev) => {
                                if (nextChecked)
                                  return Array.from(
                                    new Set([...prev, group.id])
                                  );
                                return prev.filter((id) => id !== group.id);
                              });
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Questions List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-violet-700 dark:text-violet-300 font-bold uppercase">
                    Questions To Save In Interview
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                      Score {interviewScoreSummary.achievedScore}/
                      {interviewScoreSummary.totalScore}
                    </span>
                    {interviewTargetMode === 'new' ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                        Create new interview on save
                      </span>
                    ) : interviewTargetId ? (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">
                        Interview linked
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                        No interview record
                      </span>
                    )}
                  </div>
                </div>
                {interviewQuestionDrafts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    No questions yet. Select one or more groups above.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {interviewQuestionDrafts.map((item, idx) => (
                      <div
                        key={item.localId}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                      >
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500">
                              Q{idx + 1}
                            </span>
                            {item.source === 'group' && item.groupName && (
                              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">
                                {item.groupName}
                              </span>
                            )}
                          </div>
                          <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={Boolean(item.includeInTotal)}
                              onChange={(e) =>
                                updateInterviewQuestionIncluded(
                                  item.localId,
                                  e.target.checked
                                )
                              }
                            />
                            Include in total
                          </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                          <div className="md:col-span-5">
                            <Label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400">
                              Question
                            </Label>
                            <div className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                              {item.question || '-'}
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <Label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400">
                              Score
                            </Label>
                            <div className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                              {Number.isFinite(Number(item.score))
                                ? Number(item.score)
                                : 0}
                            </div>
                          </div>
                          <div className="md:col-span-3">
                            <Label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400">
                              Answer ({String(item.answerType || 'text')})
                            </Label>
                            {(() => {
                              const atype = String(
                                item.answerType || 'text'
                              ).toLowerCase();
                              if (atype === 'number') {
                                return (
                                  <input
                                    type="number"
                                    value={item.notes}
                                    onChange={(e) =>
                                      updateInterviewQuestionDraft(
                                        item.localId,
                                        'notes',
                                        e.target.value
                                      )
                                    }
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-violet-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                    placeholder="Type numeric answer"
                                  />
                                );
                              }
                              if (atype === 'checkbox') {
                                return (
                                  <select
                                    value={item.notes}
                                    onChange={(e) =>
                                      updateInterviewQuestionDraft(
                                        item.localId,
                                        'notes',
                                        e.target.value
                                      )
                                    }
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-violet-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                  >
                                    <option value="">Select answer</option>
                                    <option value="true">True</option>
                                    <option value="false">False</option>
                                  </select>
                                );
                              }
                              if (atype === 'radio' || atype === 'dropdown') {
                                const options = Array.isArray(item.choices)
                                  ? item.choices
                                  : [];
                                return (
                                  <select
                                    value={item.notes}
                                    onChange={(e) =>
                                      updateInterviewQuestionDraft(
                                        item.localId,
                                        'notes',
                                        e.target.value
                                      )
                                    }
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-violet-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                  >
                                    <option value="">Select answer</option>
                                    {options.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                );
                              }
                              if (atype === 'tags') {
                                const key = `ivq_${item.localId}`;
                                const currentArr = String(item.notes || '')
                                  .split(',')
                                  .map((v) => String(v || '').trim())
                                  .filter(Boolean);
                                return (
                                  <>
                                    <div className="mb-2">
                                      <input
                                        type="text"
                                        value={tagInputBuffers[key] ?? ''}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setTagInputBuffers((prev) => ({
                                            ...prev,
                                            [key]: v,
                                          }));
                                          if (v.includes(',')) {
                                            const next = v
                                              .split(',')
                                              .map((vv) => vv.trim())
                                              .filter(Boolean);
                                            const merged = mergeTags(
                                              currentArr,
                                              next
                                            );
                                            updateInterviewQuestionDraft(
                                              item.localId,
                                              'notes',
                                              merged.join(', ')
                                            );
                                            setTagInputBuffers((prev) => ({
                                              ...prev,
                                              [key]: '',
                                            }));
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const buf = (
                                              tagInputBuffers[key] ?? ''
                                            ).toString();
                                            if (!buf || !buf.trim()) {
                                              setTagInputBuffers((prev) => ({
                                                ...prev,
                                                [key]: '',
                                              }));
                                              return;
                                            }
                                            const next = buf
                                              .split(',')
                                              .map((vv) => vv.trim())
                                              .filter(Boolean);
                                            if (next.length) {
                                              const merged = mergeTags(
                                                currentArr,
                                                next
                                              );
                                              updateInterviewQuestionDraft(
                                                item.localId,
                                                'notes',
                                                merged.join(', ')
                                              );
                                            }
                                            setTagInputBuffers((prev) => ({
                                              ...prev,
                                              [key]: '',
                                            }));
                                          }
                                        }}
                                        onBlur={() => {
                                          const buf = (
                                            tagInputBuffers[key] ?? ''
                                          ).toString();
                                          if (buf && buf.trim()) {
                                            const next = buf
                                              .split(',')
                                              .map((vv) => vv.trim())
                                              .filter(Boolean);
                                            const merged = mergeTags(
                                              currentArr,
                                              next
                                            );
                                            updateInterviewQuestionDraft(
                                              item.localId,
                                              'notes',
                                              merged.join(', ')
                                            );
                                            setTagInputBuffers((prev) => ({
                                              ...prev,
                                              [key]: '',
                                            }));
                                          }
                                        }}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-violet-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                        placeholder="tag1, tag2, tag3"
                                      />
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {currentArr.length > 0
                                        ? currentArr.map((tagVal) => {
                                            const text = String(tagVal);
                                            return (
                                              <div
                                                key={`${item.localId}_tag_${text}`}
                                                className="group flex items-center justify-center rounded-full border-[0.7px] border-transparent bg-gray-100 py-1 pl-2.5 pr-2 text-sm text-gray-800 hover:border-gray-200 dark:bg-gray-800 dark:text-white/90 dark:hover:border-gray-800"
                                              >
                                                <span className="flex-initial max-w-full">
                                                  {text}
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const next =
                                                      currentArr.filter(
                                                        (t) =>
                                                          String(t) !==
                                                          String(tagVal)
                                                      );
                                                    updateInterviewQuestionDraft(
                                                      item.localId,
                                                      'notes',
                                                      next.join(', ')
                                                    );
                                                  }}
                                                  className="pl-2 text-gray-500 cursor-pointer group-hover:text-gray-400 dark:text-gray-400"
                                                  aria-label={`Remove ${text}`}
                                                >
                                                  <svg
                                                    className="fill-current"
                                                    width="14"
                                                    height="14"
                                                    viewBox="0 0 14 14"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                  >
                                                    <path
                                                      fillRule="evenodd"
                                                      clipRule="evenodd"
                                                      d="M3.40717 4.46881C3.11428 4.17591 3.11428 3.70104 3.40717 3.40815C3.70006 3.11525 4.17494 3.11525 4.46783 3.40815L6.99943 5.93975L9.53095 3.40822C9.82385 3.11533 10.2987 3.11533 10.5916 3.40822C10.8845 3.70112 10.8845 4.17599 10.5916 4.46888L8.06009 7.00041L10.5916 9.53193C10.8845 9.82482 10.8845 10.2997 10.5916 10.5926C10.2987 10.8855 9.82385 10.8855 9.53095 10.5926L6.99943 8.06107L4.46783 10.5927C4.17494 10.8856 3.70006 10.8856 3.40717 10.5927C3.11428 10.2998 3.11428 9.8249 3.40717 9.53201L5.93877 7.00041L3.40717 4.46881Z"
                                                    />
                                                  </svg>
                                                </button>
                                              </div>
                                            );
                                          })
                                        : null}
                                    </div>
                                  </>
                                );
                              }
                              return (
                                <input
                                  type="text"
                                  value={item.notes}
                                  onChange={(e) =>
                                    updateInterviewQuestionDraft(
                                      item.localId,
                                      'notes',
                                      e.target.value
                                    )
                                  }
                                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-violet-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                  placeholder="Type answer"
                                />
                              );
                            })()}
                          </div>
                          <div className="md:col-span-2">
                            <Label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400">
                              Achieved
                            </Label>
                            <div
                              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="number"
                                min={0}
                                max={Number(item.score || 0)}
                                step={1}
                                value={Number(item.achievedScore ?? 0)}
                                onChange={(e) =>
                                  updateInterviewQuestionDraft(
                                    item.localId,
                                    'achievedScore',
                                    e.target.value
                                  )
                                }
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onFocus={(e) => e.stopPropagation()}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-violet-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Photo Preview Modal */}
        <Modal
          isOpen={showPhotoModal}
          onClose={() => setShowPhotoModal(false)}
          className="max-w-3xl p-4"
          isFullscreen={false}
        >
          <div className="flex items-center justify-center">
            <img
              src={applicant?.profilePhoto}
              alt={applicant?.fullName}
              className="max-h-[75vh] w-full object-contain rounded-lg"
            />
          </div>
        </Modal>

        {/* Interview Schedule Modal */}
        <InterviewScheduleModal
          isOpen={showInterviewModal}
          onClose={() => {
            setShowInterviewModal(false);
            setInterviewError('');
            setInterviewForm({
              date: '',
              time: '',
              description: '',
              comment: '',
              location: '',
              link: '',
              type: 'phone',
            });
            setFormResetKey((prev) => prev + 1);
          }}
          formResetKey={formResetKey}
          interviewForm={interviewForm}
          setInterviewForm={setInterviewForm}
          interviewError={interviewError}
          setInterviewError={setInterviewError}
          handleInterviewSubmit={handleInterviewSubmit}
          fillCompanyAddress={fillCompanyAddress}
          notificationChannels={notificationChannels}
          setNotificationChannels={setNotificationChannels}
          emailOption={emailOption}
          setEmailOption={setEmailOption}
          customEmail={customEmail}
          setCustomEmail={setCustomEmail}
          phoneOption={phoneOption}
          setPhoneOption={setPhoneOption}
          customPhone={customPhone}
          setCustomPhone={setCustomPhone}
          messageTemplate={messageTemplate}
          setMessageTemplate={setMessageTemplate}
          interviewEmailSubject={interviewEmailSubject}
          setInterviewEmailSubject={setInterviewEmailSubject}
          isSubmittingInterview={isSubmittingInterview}
          setIsSubmittingInterview={setIsSubmittingInterview}
          setShowPreviewModal={setShowPreviewModal}
          setPreviewHtml={setPreviewHtml}
          buildInterviewEmailHtml={buildInterviewEmailHtml}
          getJobTitle={getJobTitle}
          applicant={applicant}
          companyData={companyFromMe || companyObj}
        />

        <InterviewSettingsModal
          isOpen={showInterviewSettingsModal}
          onClose={() => {
            setShowInterviewSettingsModal(false);
            setSelectedInterview(null);
          }}
          applicant={applicant}
          selectedInterview={selectedInterview}
          setSelectedInterview={setSelectedInterview}
          setShowInterviewSettingsModal={setShowInterviewSettingsModal}
          updateInterviewMutation={updateInterviewMutation}
        />

        {/* Preview Email Modal */}
        <Modal
          isOpen={showPreviewModal}
          onClose={() => {
            setShowPreviewModal(false);
            setPreviewHtml('');
          }}
          className="max-w-2xl p-6"
        >
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Email Preview
            </h2>
            <div
              className="border rounded p-4 bg-white dark:bg-gray-800"
              style={{ maxHeight: '70vh', overflow: 'auto' }}
            >
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="rounded-lg border border-stroke px-4 py-2 hover:bg-gray-100 dark:border-strokedark dark:hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>

        <MessageModal
          isOpen={showMessageModal}
          onClose={() => setShowMessageModal(false)}
          applicant={applicant}
          id={applicant._id}
          company={
            companyFromMe ||
            companyObj ||
            jobPosCompany ||
            (applicant && (applicant.company || applicant.companyObj))
          }
        />

        <CommentModal
          isOpen={showCommentModal}
          onClose={() => {
            setShowCommentModal(false);
            setCommentError('');
          }}
          commentForm={commentForm}
          setCommentForm={setCommentForm}
          commentError={commentError}
          setCommentError={setCommentError}
          handleCommentSubmit={handleCommentSubmit}
          isSubmittingComment={isSubmittingComment}
        />

        <StatusChangeModal
          isOpen={showStatusModal}
          onClose={() => {
            setShowStatusModal(false);
            setStatusError('');
            setStatusForm({ status: '', notes: '', reasons: [] });
          }}
          statusForm={statusForm}
          setStatusForm={setStatusForm}
          statusError={statusError}
          setStatusError={setStatusError}
          handleStatusChange={handleStatusChange}
          isSubmittingStatus={isSubmittingStatus}
          companyId={resolvedCompanyId}
          companySettings={companyFromMe || companyObj}
          jobIds={
            applicantJobPosition
              ? [applicantJobPosition._id || applicantJobPosition.id || '']
              : []
          }
          jobs={applicantJobPosition ? [applicantJobPosition] : []}
        />
      </div>
    </>
  );
};

export default ApplicantData;
