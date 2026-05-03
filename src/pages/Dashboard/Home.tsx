import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageMeta from '../../components/common/PageMeta';
import DatePicker from '../../components/form/date-picker';
import { useAuth } from '../../context/AuthContext';
import { useApplicantStatuses } from '../../hooks/queries/useApplicants'; // ✅ Fixed import
import { useCompanies } from '../../hooks/queries/useCompanies';
import { useStatusSettings } from '../../hooks/useStatusSettings';
import {
  TimeIcon,
  ChatIcon,
  CheckCircleIcon,
  CheckLineIcon,
  CloseLineIcon,
  TrashBinIcon,
  UserIcon,
} from '../../icons';
import InterviewScheduleWidget from '../../components/charts/MyInterviewWidget';

// Map status names to icons (fallback icons for common statuses)
const getStatusIcon = (statusName: string): any => {
  const lowerStatus = statusName.toLowerCase();
  const iconMap: Record<string, any> = {
    pending: TimeIcon,
    interview: ChatIcon,
    interviewed: CheckCircleIcon,
    approved: CheckCircleIcon,
    rejected: CloseLineIcon,
    accepted: CheckLineIcon,
    trashed: TrashBinIcon,
    deleted: TrashBinIcon,
  };

  return iconMap[lowerStatus] || UserIcon;
};

// Helper to get the appropriate company ID based on user role and selected company
function getCompanyIdFromUser(
  user: any,
  selectedCompanyId?: string
): string[] | undefined {
  const roleName = user?.roleId?.name?.toLowerCase();

  // Super admin can select a company or see all
  if (roleName === 'super admin') {
    if (selectedCompanyId) return [selectedCompanyId];
    return undefined; // undefined means fetch all
  }

  // Regular user - get their assigned companies
  const userCompanyIds =
    user?.companies?.map((c: any) =>
      typeof c.companyId === 'string' ? c.companyId : c.companyId?._id
    ).filter(Boolean) || [];

  return userCompanyIds.length > 0 ? userCompanyIds : undefined;
}

export default function Home() {
  const navigate = useNavigate();
  const [selectedCompanyId, setSelectedCompanyId] = useState<
    string | undefined
  >(undefined);
  const [range, setRange] = useState<Date[] | null>(null);
  const { user } = useAuth();

  const isSuperAdmin = useMemo(() => {
    const roleName = user?.roleId?.name?.toLowerCase();
    return roleName === 'super admin';
  }, [user?.roleId?.name]);

  // Get companies for super admin selector
  const { data: companies = [] } = useCompanies(
    isSuperAdmin
      ? undefined
      : (user?.companies?.map(
          (c: any) => c.companyId?._id || c.companyId
        ) as any)
  );

  // Determine companyId for the query
  const companyIds = useMemo(() => {
    return getCompanyIdFromUser(user, selectedCompanyId);
  }, [user, selectedCompanyId]);

  // Get the selected company object for status settings
  const selectedCompany = useMemo(() => {
    if (selectedCompanyId && companies.length > 0) {
      return companies.find((c: any) => c._id === selectedCompanyId);
    }
    // If user is not super admin, get their first company
    if (!isSuperAdmin && companies.length > 0) {
      return companies[0];
    }
    return null;
  }, [selectedCompanyId, companies, isSuperAdmin]);

  // Get status settings (colors, display names) for the selected company
  const { statusOptions, getColor } = useStatusSettings(selectedCompany);

  // ✅ Fixed: Use the correct hook with proper parameters
  const {
    data: applicantsData,
    isLoading: loading,
    refetch,
    isFetching,
  } = useApplicantStatuses({
    companyId: companyIds,
    // The hook expects a string for status, not a date range
    // Date filtering should be handled separately
    enabled: true,
  });

  // Extract counts from the response
  const countsData = useMemo(() => {
    if (applicantsData && typeof applicantsData === 'object' && !Array.isArray(applicantsData)) {
      return applicantsData;
    }
    return null;
  }, [applicantsData]);

  const [lastRefetch, setLastRefetch] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState<string | null>(null);

  // When initial load finishes, start the timer from that moment
  useEffect(() => {
    if (!loading && lastRefetch === null) {
      setLastRefetch(new Date());
    }
  }, [loading, lastRefetch]);

  // Tick elapsed timer when lastRefetch is set
  useEffect(() => {
    if (!lastRefetch) {
      setElapsed(null);
      return;
    }
    const formatRelative = (d: Date) => {
      const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diffSec < 60) return 'now';
      const mins = Math.floor(diffSec / 60);
      if (mins < 60) return `${mins} min ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      const days = Math.floor(hours / 24);
      if (days === 1) return 'yesterday';
      if (days < 7) return `${days} days ago`;
      return d.toLocaleDateString();
    };

    const update = () => setElapsed(formatRelative(lastRefetch));
    update();
    const id = setInterval(update, 30 * 1000);
    return () => clearInterval(id);
  }, [lastRefetch]);

  // Handle card click to navigate to applicants page with status filter
  const handleStatusCardClick = (statusName: string) => {
    // For non-super admin or when a specific company is selected
    if (selectedCompanyId) {
      navigate(`/applicants/company/${selectedCompanyId}/status/${statusName.toLowerCase()}`);
    } else {
      const searchParams = new URLSearchParams();
      searchParams.append('status', statusName.toLowerCase());

      if (range && range.length === 2) {
        searchParams.append('startDate', range[0].toISOString());
        searchParams.append('endDate', range[1].toISOString());
      }

      navigate(`/applicants?${searchParams.toString()}`);
    }
  };

  const handleTotalCardClick = () => {
    if (selectedCompanyId) {
      navigate(`/applicants/company/${selectedCompanyId}`);
    } else {
      const searchParams = new URLSearchParams();
      if (range && range.length === 2) {
        searchParams.append('startDate', range[0].toISOString());
        searchParams.append('endDate', range[1].toISOString());
      }
      navigate(`/applicants?${searchParams.toString()}`);
    }
  };

  // Build dynamic status cards from the API response with company colors
  const statusCards = useMemo(() => {
    if (!countsData) return [];

    const excludeFromCards = ['total', 'trashed', 'deleted'];

    const cards = Object.entries(countsData)
      .filter(([key]) => !excludeFromCards.includes(key.toLowerCase()))
      .map(([statusName, count]) => {
        const statusOption = statusOptions?.find(
          (opt: any) =>
            opt.label?.toLowerCase() === statusName.toLowerCase() ||
            opt.value?.toLowerCase() === statusName.toLowerCase()
        );

        const bgColor = statusOption?.color || getColor(statusName) || '#94a3b8';

        return {
          name: statusName,
          count: Number(count),
          bgColor,
          textColor: '#111827',
          icon: getStatusIcon(statusName),
        };
      })
      .sort((a, b) => b.count - a.count);

    return cards;
  }, [countsData, statusOptions, getColor]);

  // Get total excluding trashed/deleted
  const totalApplicants = useMemo(() => {
    if (!countsData) return 0;
    const total = countsData.total || 0;
    const trashed = countsData.Trashed || countsData.Deleted || countsData.trashed || countsData.deleted || 0;
    return total - trashed;
  }, [countsData]);

  return (
    <>
      <PageMeta
        title="Dashboard | Applicants Overview"
        description="Applicants summary and filters"
      />

      <div className="space-y-6">
        <div className="grid grid-cols-12 gap-4 md:gap-6 items-end">
          {/* Company selector for super admin */}
          {isSuperAdmin && (
            <div className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                Company
              </label>
              <select
                value={selectedCompanyId || ''}
                onChange={(e) => setSelectedCompanyId(e.target.value || undefined)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800"
              >
                <option value="">All Companies</option>
                {companies.map((c: any) => (
                  <option key={c._id} value={c._id}>
                    {typeof c.name === 'object' ? c.name.en : c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3">
            <DatePicker
              id="applicant-range"
              label="Filter by date range"
              mode="range"
              placeholder="Select date range"
              onChange={(selectedDates) => setRange(selectedDates as Date[])}
            />
          </div>

          <div className="col-span-12 sm:col-span-12 md:col-span-12 lg:col-span-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-sm text-gray-500">Showing</div>
              <div className="font-semibold text-gray-800">
                {loading ? 'Loading...' : `${totalApplicants} applicants`}
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await refetch();
                    setLastRefetch(new Date());
                  } catch (e) {
                    // ignore
                  }
                }}
                disabled={isFetching}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
              >
                {isFetching ? 'Updating Data' : 'Update Data'}
              </button>
              <div className="text-sm text-gray-500">
                {elapsed ? `Last Update: ${elapsed}` : 'Not updated yet'}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Status Cards Grid with Company Colors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {/* Total card */}
          <div
            onClick={handleTotalCardClick}
            className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-5 dark:from-gray-800 dark:to-gray-900 cursor-pointer transition hover:shadow-md hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Applicants
              </div>
              <div className="text-gray-400">
                <UserIcon className="size-5" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-800 dark:text-gray-200">
              {loading ? (
                <span className="inline-block h-6 w-14 rounded bg-gray-200 animate-pulse" />
              ) : (
                totalApplicants
              )}
            </div>
          </div>

          {/* Dynamic status cards from API with company colors */}
          {loading
            ? // Loading skeletons
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-16 rounded bg-gray-200 animate-pulse" />
                    <div className="h-5 w-5 rounded bg-gray-200 animate-pulse" />
                  </div>
                  <div className="mt-2 h-8 w-12 rounded bg-gray-200 animate-pulse" />
                </div>
              ))
            : statusCards.map((card) => {
                const Icon = card.icon;
                const bgStyle = {
                  backgroundColor: card.bgColor + '15',
                  borderLeftColor: card.bgColor,
                  borderLeftWidth: '4px',
                };

                return (
                  <div
                    key={card.name}
                    onClick={() => handleStatusCardClick(card.name)}
                    className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
                    style={bgStyle}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold" style={{ color: card.textColor }}>
                        {card.name}
                      </div>
                      <div style={{ color: card.bgColor }}>
                        {Icon && <Icon className="size-5" />}
                      </div>
                    </div>
                    <div className="mt-2 text-2xl font-bold" style={{ color: card.textColor }}>
                      {card.count}
                    </div>
                  </div>
                );
              })}
        </div>
        <InterviewScheduleWidget />

        {/* Show message when no data */}
        {!loading && statusCards.length === 0 && countsData && (
          <div className="text-center py-12">
            <p className="text-gray-500">No status data available</p>
          </div>
        )}
      </div>
    </>
  );
}