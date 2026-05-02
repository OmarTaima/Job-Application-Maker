import { useAuth } from "../context/AuthContext";
import type { Company, CompanyStatus } from '../types/companies';

// Static status keys with their permanent descriptions (never change)
const STATIC_STATUS_DESCRIPTIONS: Record<string, string> = {
  pending: "Pending leads awaiting triage.",
  approved: "Approved leads ready for next steps.",
  interview: "Scheduled for interview.",
  interviewed: "Interview completed.",
  rejected: "Not a fit / disqualified.",
  trashed: "Removed or archived applications.",
};

// Default initial statuses
const DEFAULT_STATUSES: CompanyStatus[] = [
  { name: "pending", color: "#FEF3C7", textColor: "#92400E", description: STATIC_STATUS_DESCRIPTIONS.pending, isDefault: true, statusKey: "pending" },
  { name: "approved", color: "#D1FAE5", textColor: "#065F46", description: STATIC_STATUS_DESCRIPTIONS.approved, isDefault: false, statusKey: "approved" },
  { name: "interview", color: "#DBEAFE", textColor: "#1E40AF", description: STATIC_STATUS_DESCRIPTIONS.interview, isDefault: false, statusKey: "interview" },
  { name: "interviewed", color: "#DBEAFE", textColor: "#065F46", description: STATIC_STATUS_DESCRIPTIONS.interviewed, isDefault: false, statusKey: "interviewed" },
  { name: "rejected", color: "#FEE2E2", textColor: "#991B1B", description: STATIC_STATUS_DESCRIPTIONS.rejected, isDefault: false, statusKey: "rejected" },
  { name: "trashed", color: "#6B7280", textColor: "#FFFFFF", description: STATIC_STATUS_DESCRIPTIONS.trashed, isDefault: false, statusKey: "trashed" },
];

// Extended type that includes the original status key
export type CompanyStatusWithKey = CompanyStatus & {
  statusKey?: string;
};

export function useStatusSettings(company?: Company | any) {
  const { user } = useAuth();

  const getContrastColor = (hex: string | undefined): string => {
    try {
      if (!hex) return '#111827';
      const h = String(hex).replace('#', '').trim();
      const r = parseInt(h.length === 3 ? h[0] + h[0] : h.substring(0, 2), 16);
      const g = parseInt(h.length === 3 ? h[1] + h[1] : h.substring(h.length === 3 ? 1 : 2, h.length === 3 ? 2 : 4), 16);
      const b = parseInt(h.length === 3 ? h[2] + h[2] : h.substring(h.length === 3 ? 2 : 4, h.length === 3 ? 3 : 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.6 ? '#111827' : '#FFFFFF';
    } catch (e) {
      return '#111827';
    }
  };

  const resolveStatuses = (): CompanyStatusWithKey[] => {
    const payloadCandidates: any[] = [
      (company as any)?.statuses,
      (company as any)?.settings?.statuses,
      (company as any)?.data?.statuses,
      (company as any)?.data?.settings?.statuses,
      (company as any)?.applicantStatus,
      (company as any)?.settings?.applicantStatus,
      (company as any)?.leadStatuses,
      (company as any)?.settings?.leadStatuses,
      (user as any)?.company?.settings?.statuses,
      (user as any)?.company?.applicantStatus,
    ];

    for (const candidate of payloadCandidates) {
      if (Array.isArray(candidate) && candidate.length > 0) {
        // Map saved statuses, preserving the original statusKey if it exists
        return candidate.map((status: any) => {
          const statusKey = status.statusKey || status.name?.toLowerCase();
          const isStatic = STATIC_STATUS_DESCRIPTIONS[statusKey];
          
          return {
            name: status.name || '',
            color: status.color || '#94a3b8',
            textColor: status.textColor || status.text_color || getContrastColor(status.color),
            // For static statuses, ALWAYS use the original description, never save a custom one
            description: isStatic ? STATIC_STATUS_DESCRIPTIONS[statusKey] : (status.description || ''),
            isDefault: status.isDefault || false,
            statusKey: statusKey,
          };
        });
      }
    }

    return DEFAULT_STATUSES;
  };

  const statuses: CompanyStatusWithKey[] = resolveStatuses();

  const getStatus = (statusKeyOrName: string): CompanyStatusWithKey => {
    // First try to find by statusKey
    let found = statuses.find((s) => s.statusKey === statusKeyOrName);
    // If not found, try by name
    if (!found) found = statuses.find((s) => s.name === statusKeyOrName);
    if (found) return found;
    
    // Return a default based on whether this is a static key
    const isStatic = STATIC_STATUS_DESCRIPTIONS[statusKeyOrName];
    return {
      name: statusKeyOrName,
      color: '#4B5563',
      textColor: '#FFFFFF',
      description: isStatic ? STATIC_STATUS_DESCRIPTIONS[statusKeyOrName] : '',
      isDefault: false,
      statusKey: statusKeyOrName,
    };
  };

  const getColor = (statusKeyOrName: string): string => getStatus(statusKeyOrName).color;

  const getTextColor = (statusKeyOrName: string): string => {
    const status = getStatus(statusKeyOrName);
    return status?.textColor || getContrastColor(status?.color) || '#111827';
  };

  const getDescription = (statusKeyOrName: string): string => {
    const status = getStatus(statusKeyOrName);
    // Always return the static description for static status keys, even if the name changed
    if (status.statusKey && STATIC_STATUS_DESCRIPTIONS[status.statusKey]) {
      return STATIC_STATUS_DESCRIPTIONS[status.statusKey];
    }
    return status?.description || '';
  };

  const defaultStatus = statuses.find((s) => s.isDefault)?.name ?? statuses[0]?.name ?? 'pending';

  const statusOptions = statuses.map((s) => ({
    value: s.name,
    label: s.name,
    color: s.color,
    textColor: s.textColor,
    description: getDescription(s.statusKey || s.name),
  }));

  // Check if a status is static (has a permanent description)
  const isStaticStatus = (statusKeyOrName: string): boolean => {
    const status = getStatus(statusKeyOrName);
    return !!(status.statusKey && STATIC_STATUS_DESCRIPTIONS[status.statusKey]);
  };

  return { 
    statuses, 
    getStatus, 
    getColor, 
    getTextColor, 
    getDescription,
    defaultStatus, 
    statusOptions,
    isStaticStatus,
  };
}