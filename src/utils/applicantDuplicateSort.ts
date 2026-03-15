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
  if (/^(\d)\1+$/.test(phone)) return false;
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

  return [...(applicants || [])].sort((a, b) => {
    const metaA = lookup.get(getId(a));
    const metaB = lookup.get(getId(b));

    const dupA = metaA?.isDuplicate ? 1 : 0;
    const dupB = metaB?.isDuplicate ? 1 : 0;
    if (dupA !== dupB) return dupB - dupA;

    const scoreA = metaA?.priorityScore ?? 0;
    const scoreB = metaB?.priorityScore ?? 0;
    if (scoreA !== scoreB) return scoreB - scoreA;

    if (fallbackComparator) {
      const result = fallbackComparator(a, b);
      if (result !== 0) return result;
    }

    return String(a?.fullName || '').localeCompare(String(b?.fullName || ''));
  });
};
