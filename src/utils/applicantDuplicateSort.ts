type ApplicantLike = {
  _id?: string;
  id?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  companyId?: any;
  company?: any;
  companyObj?: any;
  interviews?: Array<{ scheduledAt?: string }>;
  seenBy?: any[];
};

export type ApplicantDuplicateMeta = {
  isDuplicate: boolean;
  duplicateKeys: string[];
  isUnseenByCurrentUser: boolean;
  hasUpcomingInterview: boolean;
  priorityScore: number;
  groupId?: string;
};

type DuplicateOptions = {
  getCompanyId?: (applicant: ApplicantLike) => string | undefined;
};

const getId = (a: any): string => String(a?._id || a?.id || '');

const normalizeName = (name: any): string =>
  (name || '')
    .toString()
    .trim()
    .toLowerCase();

const normalizePhone = (phone: any): string =>
  (phone || '')
    .toString()
    .replace(/\D/g, '');

const normalizeEmail = (email: any): string =>
  (email || '')
    .toString()
    .trim()
    .toLowerCase();

const normalizeCompanyId = (
  applicant: ApplicantLike,
  options?: DuplicateOptions
): string => {
  try {
    const resolved = options?.getCompanyId?.(applicant);
    if (resolved) return String(resolved);
  } catch (e) {
    // ignore
  }

  const raw =
    (applicant as any)?.companyId ??
    (applicant as any)?.company ??
    (applicant as any)?.companyObj;
  if (!raw) return '__no_company__';
  if (typeof raw === 'string' || typeof raw === 'number') return String(raw);
  return String(raw?._id || raw?.id || '__no_company__');
};

const isPlausiblePhone = (phone: string): boolean => {
  if (!phone) return false;
  if (phone.length < 8) return false;
  // ignore placeholders like 00000000 or 1111111111
  if (/^(\d)\1+$/.test(phone)) return true;
  return true;
};

const isSeenByUser = (applicant: ApplicantLike, userId?: string): boolean => {
  if (!userId) return false;
  const seenBy = applicant?.seenBy;
  if (!Array.isArray(seenBy)) return false;
  return seenBy.some((s: any) => {
    if (!s) return false;
    if (typeof s === 'string') return s === userId;
    return String(s._id || s.id || '') === userId;
  });
};

const hasUpcomingInterview = (applicant: ApplicantLike): boolean => {
  const interviews = Array.isArray(applicant?.interviews)
    ? applicant.interviews
    : [];
  const now = Date.now();
  return interviews.some((it) => {
    const ts = it?.scheduledAt ? new Date(it.scheduledAt).getTime() : NaN;
    return Number.isFinite(ts) && ts > now;
  });
};

export const buildApplicantDuplicateLookup = (
  applicants: ApplicantLike[],
  userId?: string,
  options?: DuplicateOptions
): Map<string, ApplicantDuplicateMeta> => {
  const groups = new Map<string, ApplicantLike[]>();
  const groupIdMap = new Map<string, string>();

  const addGroup = (key: string, applicant: ApplicantLike) => {
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(applicant);
  };

  (applicants || []).forEach((a) => {
    const companyKey = normalizeCompanyId(a, options);
    const nameKey = normalizeName(a?.fullName);
    const phoneKey = normalizePhone(a?.phone);
    const emailKey = normalizeEmail(a?.email);

    // Conservative duplicate keys to avoid false positives:
    // 1) exact email match
    if (emailKey) addGroup(`company:${companyKey}|email:${emailKey}`, a);

    // 2) exact name + phone match (no name-only and no phone-only grouping)
    if (nameKey && isPlausiblePhone(phoneKey)) {
      addGroup(`company:${companyKey}|name_phone:${nameKey}::${phoneKey}`, a);
    }
  });

  const duplicateKeysById = new Map<string, Set<string>>();
  groups.forEach((items, key) => {
    if (items.length < 2) return;
    items.forEach((a) => {
      const id = getId(a);
      if (!id) return;
      if (!duplicateKeysById.has(id)) duplicateKeysById.set(id, new Set());
      duplicateKeysById.get(id)?.add(key);
    });
  });

  // Generate unique group IDs for duplicate groups
  let nextGroupId = 1;
  const processedDuplicates = new Set<string>();
  void processedDuplicates
  
  groups.forEach((items, key) => {
    if (items.length < 2) return;
    const groupId = `dup_group_${nextGroupId++}`;
    items.forEach((a) => {
      const id = getId(a);
      if (id) {
        groupIdMap.set(id, groupId);
      }
    });
  });

  const lookup = new Map<string, ApplicantDuplicateMeta>();

  (applicants || []).forEach((a) => {
    const id = getId(a);
    if (!id) return;

    const duplicateKeys = Array.from(duplicateKeysById.get(id) || []);
    const isDuplicate = duplicateKeys.length > 0;
    const unseen = !isSeenByUser(a, userId);
    const upcomingInterview = hasUpcomingInterview(a);

    // Applicant-specific priority based on existing fields in this project.
    let priorityScore = 0;
    if (unseen) priorityScore += 2;
    if (upcomingInterview) priorityScore += 1;

    lookup.set(id, {
      isDuplicate,
      duplicateKeys,
      isUnseenByCurrentUser: unseen,
      hasUpcomingInterview: upcomingInterview,
      priorityScore,
      groupId: groupIdMap.get(id),
    });
  });

  return lookup;
};

export const sortApplicantsByDuplicatePriority = <T extends ApplicantLike>(
  applicants: T[],
  userId: string | undefined,
  fallbackComparator?: (a: T, b: T) => number,
  options?: DuplicateOptions
): T[] => {
  const lookup = buildApplicantDuplicateLookup(applicants, userId, options);
  
  // First, separate duplicates and non-duplicates
  const duplicates: T[] = [];
  const nonDuplicates: T[] = [];
  
  applicants.forEach((applicant) => {
    const id = getId(applicant);
    const meta = lookup.get(id);
    if (meta?.isDuplicate) {
      duplicates.push(applicant);
    } else {
      nonDuplicates.push(applicant);
    }
  });
  
  // Group duplicates by their group ID
  const duplicateGroups = new Map<string, T[]>();
  
  duplicates.forEach((applicant) => {
    const id = getId(applicant);
    const meta = lookup.get(id);
    const groupId = meta?.groupId || id;
    
    if (!duplicateGroups.has(groupId)) {
      duplicateGroups.set(groupId, []);
    }
    duplicateGroups.get(groupId)!.push(applicant);
  });
  
  // Sort each duplicate group by priority score (higher priority first)
  const sortedDuplicateGroups = Array.from(duplicateGroups.values()).map((group) => {
    return group.sort((a, b) => {
      const idA = getId(a);
      const idB = getId(b);
      const metaA = lookup.get(idA);
      const metaB = lookup.get(idB);
      
      const scoreA = metaA?.priorityScore ?? 0;
      const scoreB = metaB?.priorityScore ?? 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      
      // If same priority, sort by name as fallback
      return String(a?.fullName || '').localeCompare(String(b?.fullName || ''));
    });
  });
  
  // Sort duplicate groups by the highest priority score in the group
  sortedDuplicateGroups.sort((groupA, groupB) => {
    const maxScoreA = Math.max(...groupA.map(a => lookup.get(getId(a))?.priorityScore ?? 0));
    const maxScoreB = Math.max(...groupB.map(b => lookup.get(getId(b))?.priorityScore ?? 0));
    if (maxScoreA !== maxScoreB) return maxScoreB - maxScoreA;
    
    // If same max priority, sort by the first applicant's name
    const nameA = groupA[0]?.fullName || '';
    const nameB = groupB[0]?.fullName || '';
    return String(nameA).localeCompare(String(nameB));
  });
  
  // Flatten the groups
  const groupedDuplicates = sortedDuplicateGroups.flat();
  
  // Sort non-duplicates by priority score
  const sortedNonDuplicates = nonDuplicates.sort((a, b) => {
    const idA = getId(a);
    const idB = getId(b);
    const metaA = lookup.get(idA);
    const metaB = lookup.get(idB);
    
    const scoreA = metaA?.priorityScore ?? 0;
    const scoreB = metaB?.priorityScore ?? 0;
    if (scoreA !== scoreB) return scoreB - scoreA;
    
    if (fallbackComparator) {
      const result = fallbackComparator(a, b);
      if (result !== 0) return result;
    }
    
    return String(a?.fullName || '').localeCompare(String(b?.fullName || ''));
  });
  
  // Return duplicates first (grouped together), then non-duplicates
  return [...groupedDuplicates, ...sortedNonDuplicates];
};