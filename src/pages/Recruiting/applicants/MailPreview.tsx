import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
	Building2,
	Briefcase,
	ChevronLeft,
	ChevronRight,
	Clock3,
	Mail,
	MessageSquareText,
	Search,
	ServerCog,
	Sparkles,
} from 'lucide-react';
import PageMeta from '../../../components/common/PageMeta';
import axiosInstance from '../../../config/axios';
import { useCompanies } from '../../../hooks/queries/useCompanies';
import { useJobPositions } from '../../../hooks/queries/useJobPositions';
import { useApplicants } from '../../../hooks/queries/useApplicants';
import { useAppSelector } from '../../../store/hooks';

type MailStatus = 'queued' | 'delivery delayed' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';

type MailEventType = 'queued' | 'provider_accepted' | 'delivered' | 'open' | 'click' | 'bounce' | 'complaint' | 'custom';

type MailEvent = {
	id: string;
	type: MailEventType;
	at: string;
	detail: string;
};

type ApiMailRecord = {
	_id: string;
	company: string;
	sentBy: string;
	to: string;
	from: string;
	subject: string;
	html: string;
	applicant: string | null;
	jobPosition?: unknown;
	resendEmailId: string;
	status: string;
	deliveredAt: string | null;
	openedAt: string | null;
	clickedAt: string | null;
	bouncedAt: string | null;
	complainedAt: string | null;
	webhookEvents: Array<{ type?: string; createdAt?: string; [key: string]: any }>;
	createdAt: string;
	updatedAt: string;
	__v: number;
};

type ApiMailResponse = {
	message: string;
	page: string;
	PageCount: number | null;
	TotalCount: number;
	data: ApiMailRecord[];
};

type UiMailRecord = {
	id: string;
	applicantId: string | null;
	applicantName: string;
	applicantEmail: string;
	applicantJobPositionId: string | null;
	applicantAssignedJobId: string | null;
	applicantAssignedJobTitle: string;
	applicantAssignedCompanyId: string | null;
	applicantAssignedCompanyName: string;
	companyId: string;
	senderId: string;
	sender: string;
	resendEmailId: string;
	statusRaw: string;
	status: MailStatus;
	score: number;
	createdAt: string;
	lastUpdateAt: string;
	subject: string;
	preview: string;
	bodyHtml: string;
	deliveredAt: string | null;
	openedAt: string | null;
	clickedAt: string | null;
	bouncedAt: string | null;
	complainedAt: string | null;
	webhookEvents: ApiMailRecord['webhookEvents'];
	events: MailEvent[];
	raw: ApiMailRecord;
};

const STATUS_OPTIONS: Array<{ key: 'all' | MailStatus; label: string }> = [
	{ key: 'all', label: 'All' },
	{ key: 'queued', label: 'Queued' },
	{ key: 'delivery delayed', label: 'Delivery Delayed' },
	{ key: 'delivered', label: 'Delivered' },
	{ key: 'opened', label: 'Opened' },
	{ key: 'clicked', label: 'Clicked' },
	{ key: 'bounced', label: 'Bounced' },
	{ key: 'failed', label: 'Failed' },
];

const MAIL_POLL_INTERVAL_MS = 30 * 1000;
const MAIL_LIST_PAGE_SIZE = 8;

const formatDateTime = (value: string) =>
	new Date(value).toLocaleString('en-US', {
		month: 'short',
		day: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const isInvalidNameToken = (value: string) => /^(undefined|null|unknown|n\/a|na)$/i.test(value.trim());

const getApplicantNameFromHtml = (html: string) => {
	const match = html.match(/Dear\s+([^,<]+)[,:]?/i);
	const parsedName = match?.[1]?.trim() || '';
	if (!parsedName || isInvalidNameToken(parsedName)) return 'Unknown Applicant';
	return parsedName;
};

const getFallbackNameFromEmail = (email: string) => {
	if (!email) return 'Unknown Applicant';
	const localPart = email.split('@')[0]?.trim();
	if (!localPart) return 'Unknown Applicant';
	const normalized = localPart.replace(/[._-]+/g, ' ').trim();
	if (!normalized || isInvalidNameToken(normalized)) return 'Unknown Applicant';
	return normalized;
};

const resolveUiStatus = (mail: ApiMailRecord): MailStatus => {
  // First, check the backend status field
  const backendStatus = String(mail.status || '').toLowerCase();
  
  // Map backend status to our MailStatus type
  switch (backendStatus) {
    case 'queued':
      return 'queued';
    case 'delivery delayed':
      return 'delivery delayed';
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'opened':
      return 'opened';
    case 'clicked':
      return 'clicked';
    case 'bounced':
      return 'bounced';
    case 'failed':
      return 'failed';
    default:
      // If backend status is not recognized, fall back to deriving from timestamps
      if (mail.clickedAt) return 'clicked';
      if (mail.openedAt) return 'opened';
      if (mail.deliveredAt) return 'delivered';
      if (mail.bouncedAt) return 'bounced';
      if (mail.complainedAt) return 'failed';
      return 'delivery delayed';
  }
};

const buildEvents = (mail: ApiMailRecord): MailEvent[] => {
	const events: MailEvent[] = [
		{ id: `${mail._id}-q`, type: 'queued', at: mail.createdAt, detail: 'Mail queued.' },
		{ id: `${mail._id}-a`, type: 'provider_accepted', at: mail.updatedAt, detail: 'Provider accepted.' },
	];
	if (mail.deliveredAt) events.push({ id: `${mail._id}-d`, type: 'delivered', at: mail.deliveredAt, detail: 'Delivered.' });
	if (mail.openedAt) events.push({ id: `${mail._id}-o`, type: 'open', at: mail.openedAt, detail: 'Opened.' });
	if (mail.clickedAt) events.push({ id: `${mail._id}-c`, type: 'click', at: mail.clickedAt, detail: 'Clicked.' });
	if (mail.bouncedAt) events.push({ id: `${mail._id}-b`, type: 'bounce', at: mail.bouncedAt, detail: 'Bounced.' });
	if (mail.complainedAt) events.push({ id: `${mail._id}-cp`, type: 'complaint', at: mail.complainedAt, detail: 'Complaint.' });
	return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
};

const toUiRecord = (mail: ApiMailRecord): UiMailRecord => {
	const status = resolveUiStatus(mail);
	return {
		id: mail._id,
		applicantId: extractId(mail.applicant),
		applicantName: getApplicantNameFromHtml(mail.html),
		applicantEmail: mail.to,
		applicantJobPositionId: extractId(mail.jobPosition),
		applicantAssignedJobId: null,
		applicantAssignedJobTitle: 'Unknown Job',
		applicantAssignedCompanyId: null,
		applicantAssignedCompanyName: 'Unknown',
		companyId: extractId(mail.company) || String(mail.company || ''),
		senderId: extractId(mail.sentBy) || String(mail.sentBy || ''),
		sender: mail.from,
		resendEmailId: mail.resendEmailId,
		statusRaw: mail.status,
		status,
		score: status === 'opened' || status === 'clicked' ? 95 : status === 'delivered' ? 85 : 40,
		createdAt: mail.createdAt,
		lastUpdateAt: mail.updatedAt,
		subject: mail.subject,
		preview: stripHtml(mail.html).slice(0, 100),
		bodyHtml: mail.html,
		deliveredAt: mail.deliveredAt,
		openedAt: mail.openedAt,
		clickedAt: mail.clickedAt,
		bouncedAt: mail.bouncedAt,
		complainedAt: mail.complainedAt,
		webhookEvents: mail.webhookEvents,
		events: buildEvents(mail),
		raw: mail,
	};
};

const statusChipClasses: Record<MailStatus, string> = {
	queued: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
	'delivery delayed': 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
	sent: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
	delivered: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
	opened: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
	clicked: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
	bounced: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
	failed: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
};



const toDisplayText = (value: unknown, fallback: string) => {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed || fallback;
	}

	if (value && typeof value === 'object') {
		const localized = value as { en?: unknown; ar?: unknown; name?: unknown; title?: unknown };
		const candidates = [localized.en, localized.ar, localized.name, localized.title];
		for (const candidate of candidates) {
			if (typeof candidate === 'string' && candidate.trim()) {
				return candidate.trim();
			}
		}
	}

	return fallback;
};

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

const getApplicantCompanyId = (applicantRecord: any): string | null => {
	if (!applicantRecord) return null;
	return (
		extractId(applicantRecord?.companyId) ||
		extractId(applicantRecord?.company) ||
		extractId(applicantRecord?.companyObj) ||
		extractId(applicantRecord?.jobPositionId?.companyId) ||
		extractId(applicantRecord?.jobPositionId?.company) ||
		extractId(applicantRecord?.jobPosition?.companyId) ||
		extractId(applicantRecord?.jobPosition?.company) ||
		null
	);
};

const getApplicantJobPositionId = (applicantRecord: any): string | null => {
	if (!applicantRecord) return null;
	return extractId(applicantRecord?.jobPositionId) || extractId(applicantRecord?.jobPosition) || null;
};

const getApplicantJobTitle = (applicantRecord: any): string | null => {
	if (!applicantRecord) return null;
	const titleFromJobPositionId = toDisplayText((applicantRecord as any)?.jobPositionId?.title || (applicantRecord as any)?.jobPositionId?.name, '');
	if (titleFromJobPositionId) return titleFromJobPositionId;
	const titleFromJobPosition = toDisplayText((applicantRecord as any)?.jobPosition?.title || (applicantRecord as any)?.jobPosition?.name, '');
	if (titleFromJobPosition) return titleFromJobPosition;
	return null;
};

const MetricCard = ({ label, value, colorClass }: { label: string; value: string | number; colorClass: string }) => (
	<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
	  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
	  <p className={`mt-1 text-2xl font-semibold tracking-tight ${colorClass}`}>{value}</p>
	</div>
);

export default function MailPreview() {
	const user = useAppSelector((state) => state.auth.user);
	const roleName = user?.roleId?.name?.toLowerCase();
	const isSuperAdmin = roleName === 'super admin' || roleName === 'admin';

	// Filters
	const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
	const [selectedJobId, setSelectedJobId] = useState<string>('all');
	const [statusFilter, setStatusFilter] = useState<'all' | MailStatus>('all');
	const [searchTerm, setSearchTerm] = useState('');
	const [selectedMailId, setSelectedMailId] = useState('');
	const [mailPage, setMailPage] = useState(1);

	// Get user's assigned companies if not super admin
	const assignedCompanyIds = useMemo(() => {
		if (isSuperAdmin) return [];
		const fromCompanies = Array.isArray(user?.companies)
			? user.companies.map((c: any) => extractId(c?.companyId))
			: [];
		const fromAssigned = Array.isArray(user?.assignedcompanyId) ? user.assignedcompanyId : [];
		return Array.from(new Set([...fromCompanies, ...fromAssigned])).filter(Boolean) as string[];
	}, [user, isSuperAdmin]);

	// Fetch Companies (for Filter)
	const { data: companies } = useCompanies(isSuperAdmin ? undefined : assignedCompanyIds);
	const availableCompanyIds = useMemo(
		() => (companies || []).map((company: any) => extractId(company?._id || company?.id)).filter(Boolean) as string[],
		[companies],
	);
	const shouldShowCompanyFilter = availableCompanyIds.length > 1;
	const companyNameById = useMemo(() => {
		const map = new Map<string, string>();
		(companies || []).forEach((company: any) => {
			map.set(company._id, toDisplayText(company?.name, 'Unknown Company'));
		});
		return map;
	}, [companies]);

	useEffect(() => {
		if (availableCompanyIds.length === 1) {
			const onlyCompanyId = availableCompanyIds[0];
			if (selectedCompanyId !== onlyCompanyId) {
				setSelectedCompanyId(onlyCompanyId);
				setSelectedJobId('all');
			}
			return;
		}

		if (availableCompanyIds.length === 0 && selectedCompanyId !== 'all') {
			setSelectedCompanyId('all');
			setSelectedJobId('all');
			return;
		}

		if (
			availableCompanyIds.length > 1 &&
			selectedCompanyId !== 'all' &&
			!availableCompanyIds.includes(selectedCompanyId)
		) {
			setSelectedCompanyId('all');
			setSelectedJobId('all');
		}
	}, [availableCompanyIds, selectedCompanyId]);

	// Fetch Job Positions (for Filter)
	const jobPositionParams = useMemo(() => {
		if (isSuperAdmin) {
			return selectedCompanyId !== 'all' ? [selectedCompanyId] : undefined;
		}
		if (availableCompanyIds.length === 1) {
			return [availableCompanyIds[0]];
		}
		return assignedCompanyIds;
	}, [isSuperAdmin, selectedCompanyId, assignedCompanyIds, availableCompanyIds]);
	const { data: jobPositions } = useJobPositions(jobPositionParams);

	const scopedJobPositions = useMemo(() => {
		if (selectedCompanyId === 'all') return [] as any[];
		return (jobPositions || []).filter((j: any) => extractId(j?.companyId) === selectedCompanyId);
	}, [jobPositions, selectedCompanyId]);

	const jobTitleById = useMemo(() => {
		const map = new Map<string, string>();
		(jobPositions || []).forEach((job: any) => {
			if (job?._id) map.set(job._id, toDisplayText((job as any)?.title || (job as any)?.name, 'Untitled Job'));
		});
		return map;
	}, [jobPositions]);

	const applicantCompanyIds = useMemo(() => {
		if (!isSuperAdmin && assignedCompanyIds.length > 0) return assignedCompanyIds;
		return undefined;
	}, [isSuperAdmin, assignedCompanyIds]);

	const {
		data: applicants = [],
		isLoading: isApplicantsLoading,
		isFetching: isApplicantsFetching,
		isFetched: isApplicantsFetched,
	} = useApplicants(applicantCompanyIds);
	const applicantById = useMemo(() => {
		const map = new Map<string, any>();
		(applicants || []).forEach((applicant: any) => {
			if (applicant?._id) map.set(applicant._id, applicant);
		});
		return map;
	}, [applicants]);

	const queryCompanyIds = useMemo(() => {
		if (!isSuperAdmin && assignedCompanyIds.length > 0) return assignedCompanyIds;
		return [] as string[];
	}, [isSuperAdmin, assignedCompanyIds]);

	// Fetch Mail Logs
	const { data: apiResponse, isLoading } = useQuery<ApiMailResponse>({
		queryKey: ['mail-logs', queryCompanyIds.join(',')],
		queryFn: async () => {
			const baseParams: Record<string, string> = { PageCount: 'all' };

			if (queryCompanyIds.length <= 1) {
				if (queryCompanyIds.length === 1) {
					const companyId = queryCompanyIds[0];
					baseParams.company = companyId;
				}

				const res = await axiosInstance.get<ApiMailResponse>('/mail', { params: baseParams });
				return res.data;
			}

			// For multi-company users, request each company separately and merge on the client.
			const responses = await Promise.all(
				queryCompanyIds.map((companyId) =>
					axiosInstance.get<ApiMailResponse>('/mail', {
						params: {
							...baseParams,
							companyId,
							company: companyId,
						},
					}),
				),
			);

			const mergedMap = new Map<string, ApiMailRecord>();
			responses.forEach((response) => {
				(response.data?.data || []).forEach((mail) => {
					mergedMap.set(mail._id, mail);
				});
			});

			const data = Array.from(mergedMap.values()).sort(
				(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);
			const firstResponse = responses[0]?.data;

			return {
				message: firstResponse?.message || 'success',
				page: firstResponse?.page || 'all',
				PageCount: firstResponse?.PageCount ?? null,
				TotalCount: data.length,
				data,
			};
		},
		staleTime: 5 * 60 * 1000, // Cache data for 5 minutes without refetching globally
		refetchInterval: MAIL_POLL_INTERVAL_MS,
		refetchIntervalInBackground: true,
	});

	const knownNameByApplicantId = useMemo(() => {
		const map = new Map<string, string>();
		(apiResponse?.data || []).forEach((mail) => {
			const applicantId = extractId((mail as any)?.applicant);
			const parsedName = getApplicantNameFromHtml((mail as any)?.html || '');
			if (applicantId && parsedName !== 'Unknown Applicant' && !isInvalidNameToken(parsedName)) {
				map.set(applicantId, parsedName);
			}
		});
		return map;
	}, [apiResponse]);

	const knownNameByEmail = useMemo(() => {
		const map = new Map<string, string>();
		(apiResponse?.data || []).forEach((mail) => {
			const email = String((mail as any)?.to || '').trim().toLowerCase();
			const parsedName = getApplicantNameFromHtml((mail as any)?.html || '');
			if (email && parsedName !== 'Unknown Applicant' && !isInvalidNameToken(parsedName)) {
				if (!map.has(email)) map.set(email, parsedName);
			}
		});
		return map;
	}, [apiResponse]);

	const uiRecords = useMemo(() => {
		if (isLoading || !apiResponse) return [];
		return (apiResponse.data || []).map((mail) => {
			const base = toUiRecord(mail);
			const matchedApplicant = base.applicantId ? applicantById.get(base.applicantId) : null;
			const hasLinkedApplicant = !!base.applicantId;
			const applicantJobPositionId = getApplicantJobPositionId(matchedApplicant) || base.applicantJobPositionId || null;
			const applicantAssignedJobTitle =
				getApplicantJobTitle(matchedApplicant) ||
				(applicantJobPositionId ? jobTitleById.get(applicantJobPositionId) || applicantJobPositionId : 'Unknown Job');
			const userFullName = toDisplayText(matchedApplicant?.fullName || matchedApplicant?.name, '');
			const parsedHtmlName = base.applicantName !== 'Unknown Applicant' && !isInvalidNameToken(base.applicantName)
				? base.applicantName
				: '';
			const knownByApplicantId = base.applicantId ? knownNameByApplicantId.get(base.applicantId) || '' : '';
			const knownByEmail = knownNameByEmail.get(String(base.applicantEmail || '').trim().toLowerCase()) || '';
			const fallbackName = getFallbackNameFromEmail(base.applicantEmail);
			const shouldWaitForApplicantLookup =
				hasLinkedApplicant &&
				!matchedApplicant &&
				(!isApplicantsFetched || isApplicantsLoading || isApplicantsFetching);
			const applicantName =
				userFullName ||
				parsedHtmlName ||
				knownByApplicantId ||
				knownByEmail ||
				(shouldWaitForApplicantLookup ? 'Loading recipient...' : (hasLinkedApplicant ? 'Unknown Applicant' : fallbackName));
			const assignedCompanyId = getApplicantCompanyId(matchedApplicant) || base.companyId || null;
			const assignedCompanyName = assignedCompanyId
				? companyNameById.get(assignedCompanyId) || assignedCompanyId
				: 'Unknown Company';

			return {
				...base,
				applicantName,
				applicantJobPositionId,
				applicantAssignedJobId: applicantJobPositionId,
				applicantAssignedJobTitle,
				applicantAssignedCompanyId: assignedCompanyId,
				applicantAssignedCompanyName: assignedCompanyName,
			};
		});
	}, [
		apiResponse,
		applicantById,
		companyNameById,
		jobTitleById,
		knownNameByApplicantId,
		knownNameByEmail,
		isApplicantsLoading,
		isApplicantsFetching,
		isApplicantsFetched,
	]);
	
	const filteredMails = useMemo(() => uiRecords
		.filter((m) => {
			const matchesCompany = selectedCompanyId === 'all' || m.companyId === selectedCompanyId;
			const matchesJob = selectedJobId === 'all' || m.applicantJobPositionId === selectedJobId;
			const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
			const matchesSearch = !searchTerm || [m.applicantName, m.applicantEmail, m.subject].some((f) => f.toLowerCase().includes(searchTerm.toLowerCase()));
			return matchesCompany && matchesJob && matchesStatus && matchesSearch;
		})
		.sort((a, b) => {
			const createdDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			if (createdDiff !== 0) return createdDiff;
			return new Date(b.lastUpdateAt).getTime() - new Date(a.lastUpdateAt).getTime();
		}),
	[uiRecords, selectedCompanyId, selectedJobId, statusFilter, searchTerm]);

	useEffect(() => {
		setMailPage(1);
	}, [selectedCompanyId, selectedJobId, statusFilter, searchTerm]);

	const totalMailPages = useMemo(() => Math.max(1, Math.ceil(filteredMails.length / MAIL_LIST_PAGE_SIZE)), [filteredMails.length]);

	useEffect(() => {
		setMailPage((prev) => Math.min(prev, totalMailPages));
	}, [totalMailPages]);

	const paginatedMails = useMemo(() => {
		const startIndex = (mailPage - 1) * MAIL_LIST_PAGE_SIZE;
		return filteredMails.slice(startIndex, startIndex + MAIL_LIST_PAGE_SIZE);
	}, [filteredMails, mailPage]);

	const selectedMail = useMemo(() => filteredMails.find(m => m.id === selectedMailId) || (filteredMails.length > 0 ? filteredMails[0] : null), [filteredMails, selectedMailId]);

	const metrics = useMemo(() => {
		const total = uiRecords.length;
		const delivered = uiRecords.filter(m => ['delivered', 'opened', 'clicked'].includes(m.status)).length;
		const open = uiRecords.filter(m => ['opened', 'clicked'].includes(m.status)).length;
		return { total, delivery: total ? Math.round((delivered/total)*100) : 0, open: total ? Math.round((open/total)*100) : 0 };
	}, [uiRecords]);

	return (
		<div className="mx-auto max-w-[1600px] space-y-6 pb-14">
			<PageMeta title="Mail IQ" description="Intelligence Center" />

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
				<div className="flex flex-col gap-6 border-b border-slate-200 p-6 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between lg:p-8">
					<div className="space-y-3">
						<div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
							<Sparkles className="h-3.5 w-3.5" /> Intelligence Center
						</div>
						<h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">Mail Intelligence</h1>
						<p className="max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">Advanced audit logs and real-time engagement tracking for applicant communications.</p>
					</div>
					<div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 lg:w-auto">
						<MetricCard label="Volume" value={metrics.total} colorClass="text-gray-900 dark:text-white" />
						<MetricCard label="Delivered" value={`${metrics.delivery}%`} colorClass="text-green-600" />
						<MetricCard label="Open Rate" value={`${metrics.open}%`} colorClass="text-brand-600" />
					</div>
				</div>

				<div className="space-y-4 p-6 lg:p-8">
					<div className={`grid grid-cols-1 gap-3 ${shouldShowCompanyFilter ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
						{shouldShowCompanyFilter && (
							<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
								<p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Company Scope</p>
								<div className="flex items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
									<Building2 className="h-4 w-4 text-brand-500" />
									<select
										value={selectedCompanyId}
										onChange={e => { setSelectedCompanyId(e.target.value); setSelectedJobId('all'); }}
										className="w-full appearance-none border-0 bg-transparent p-0 text-sm font-medium text-slate-900 outline-none ring-0 shadow-none focus:outline-none focus:ring-0 dark:text-slate-100 dark:[&_option]:bg-slate-900"
									>
										<option value="all">Global Workspace (All Companies)</option>
										{(companies || []).map(c => (
											<option key={c._id} value={c._id}>{toDisplayText((c as any).name, 'Unnamed Company')}</option>
										))}
									</select>
								</div>
							</div>
						)}

						<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
							<p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Job Scope</p>
							<div className="flex items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
								<Briefcase className="h-4 w-4 text-orange-500" />
								<select
									value={selectedJobId}
									onChange={e => setSelectedJobId(e.target.value)}
									disabled={selectedCompanyId === 'all'}
									className="w-full appearance-none border-0 bg-transparent p-0 text-sm font-medium text-slate-900 outline-none ring-0 shadow-none focus:outline-none focus:ring-0 disabled:opacity-50 dark:text-slate-100 dark:[&_option]:bg-slate-900"
								>
									{selectedCompanyId === 'all' ? null : (
										<>
											<option value="all">Universal View (All Jobs)</option>
											{scopedJobPositions.map(j => (
												<option key={j._id} value={j._id}>{toDisplayText((j as any).title, 'Untitled Job')}</option>
											))}
										</>
									)}
								</select>
							</div>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						{shouldShowCompanyFilter && (
							<span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
								{selectedCompanyId === 'all' ? 'All Companies' : 'Company Filter Active'}
							</span>
						)}
						<span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
							{selectedJobId === 'all' ? 'All Jobs' : 'Job Filter Active'}
						</span>
					</div>
				</div>
			</section>

			<div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
				<aside className="space-y-6">
					<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
						<div className="space-y-4 border-b border-slate-200 p-5 dark:border-slate-800">
							<div className="relative">
								<Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
								<input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search transmissions..." className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
							</div>
							<div className="flex flex-wrap gap-1.5">
								{STATUS_OPTIONS.map(o => (
									<button key={o.key} onClick={() => setStatusFilter(o.key as any)} className={`rounded-lg px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] transition ${statusFilter === o.key ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
										{o.label}
									</button>
								))}
							</div>
						</div>
						<div className="h-[760px] overflow-y-auto p-3 custom-scrollbar">
							<div className="space-y-2">
								{paginatedMails.map(m => (
									<button key={m.id} onClick={() => setSelectedMailId(m.id)} className={`group relative w-full rounded-xl border p-4 text-left transition ${selectedMail?.id === m.id ? 'border-brand-300 bg-brand-50/60 dark:border-brand-500/30 dark:bg-brand-500/10' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800/70'}`}>
										<div className="flex items-start justify-between gap-4">
											<div className="min-w-0">
												<p className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">{m.applicantName}</p>
												<p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{m.applicantEmail}</p>
											</div>
											<span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${statusChipClasses[m.status]}`}>{m.status}</span>
										</div>
										<p className="mt-2 line-clamp-1 text-[12px] font-medium text-slate-600 dark:text-slate-400">{m.subject}</p>
									</button>
								))}
							</div>
						</div>
						{filteredMails.length > MAIL_LIST_PAGE_SIZE && (
							<div className="flex items-center justify-center gap-3 border-t border-slate-200 p-4 dark:border-slate-800">
								<button
									disabled={mailPage === 1}
									onClick={() => setMailPage((prev) => Math.max(1, prev - 1))}
									className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-brand-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
								>
									<ChevronLeft className="h-4 w-4" />
								</button>
								<div className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
									Page {mailPage} <span className="mx-1 opacity-40">/</span> {totalMailPages}
								</div>
								<button
									disabled={mailPage === totalMailPages}
									onClick={() => setMailPage((prev) => Math.min(totalMailPages, prev + 1))}
									className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-brand-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
								>
									<ChevronRight className="h-4 w-4" />
								</button>
							</div>
						)}
					</div>
				</aside>

				<main>
					{selectedMail ? (
						<article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
							<div className="border-b border-slate-200 p-6 dark:border-slate-800 lg:p-8">
								<div className="mb-8 flex flex-wrap items-center justify-between gap-4">
									<div className="space-y-2">
										<p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">
											<span className="h-1 w-6 rounded-full bg-brand-500" /> Transmission Report
										</p>
										<h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 lg:text-3xl">{selectedMail.subject}</h2>
									</div>
									<div className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusChipClasses[selectedMail.status]}`}>
										{selectedMail.status}
									</div>
								</div>
								<div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
									{[
										{ l: 'Recipient', v: selectedMail.applicantName, s: selectedMail.applicantEmail },
										{ l: 'Assigned Company', v: selectedMail.applicantAssignedCompanyName, s: selectedMail.applicantAssignedCompanyId || 'No company match' },
										{ l: 'Assigned Job', v: selectedMail.applicantAssignedJobTitle, s: selectedMail.applicantAssignedJobId || 'No job match' },
										{ l: 'Score', v: `${selectedMail.score}% Reliable`, s: 'Engagement index' }
									].map((c, i) => (
										<div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
											<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{c.l}</p>
											<p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{c.v}</p>
										</div>
									))}
								</div>
							</div>
							<div className="grid grid-cols-1 lg:grid-cols-2">
								<div className="border-b border-slate-200 p-6 dark:border-slate-800 lg:border-b-0 lg:border-r lg:p-8">
									<h3 className="mb-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500"><Clock3 className="h-4 w-4" /> Activity Feed</h3>
									<div className="space-y-8 pl-4">
										{selectedMail.events.map((e, i) => (
											<div key={i} className="relative pl-8">
												<div className="absolute left-0 top-1 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-brand-500/10" />
												<p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">{formatDateTime(e.at)}</p>
												<p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-900 dark:text-slate-100">{e.type.replace(/_/g, ' ')}</p>
												<p className="mt-1 text-[12px] text-slate-600 dark:text-slate-400">{e.detail}</p>
											</div>
										))}
									</div>
								</div>
								<div className="flex h-full flex-col p-6 lg:p-8">
									<div className="mb-6 flex items-center justify-between">
										<h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500"><MessageSquareText className="h-4 w-4" /> Payload Body</h3>
										<div className="h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
									</div>
									<div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/60">
										<iframe srcDoc={selectedMail.bodyHtml} title="Mail Preview" className="h-full min-h-[500px] w-full rounded-lg border-none bg-white dark:bg-slate-900" />
									</div>
								</div>
							</div>
							<div className="border-t border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/40 lg:p-8">
								<details className="group">
									<summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition hover:text-slate-800 dark:hover:text-slate-100">
										<div className="flex items-center gap-2"><ServerCog className="h-4 w-4" /> Metadata Trace</div>
										<div className="h-4 w-4 transition-transform group-open:rotate-90">→</div>
									</summary>
									<pre className="mt-5 max-h-[420px] overflow-auto rounded-xl bg-slate-900 p-5 font-mono text-[10px] leading-relaxed text-brand-300">
										{JSON.stringify(selectedMail.raw, null, 2)}
									</pre>
								</details>
							</div>
						</article>
					) : (
						<div className="flex h-[760px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
							<div className="relative">
								<Mail className="h-16 w-16 text-slate-300 dark:text-slate-600" />
								<div className="absolute inset-0 animate-ping rounded-full bg-brand-500/5" />
							</div>
							<p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Select transmission to inspect</p>
						</div>
					)}
				</main>
			</div>
		</div>
	);
}
