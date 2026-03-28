import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
	Building2,
	Briefcase,
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

type MailStatus =
	| 'queued'
	| 'sending'
	| 'delivered'
	| 'opened'
	| 'clicked'
	| 'bounced'
	| 'failed';

type MailEventType =
	| 'queued'
	| 'provider_accepted'
	| 'delivered'
	| 'open'
	| 'click'
	| 'bounce'
	| 'complaint'
	| 'custom';

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
	{ key: 'sending', label: 'Sending' },
	{ key: 'delivered', label: 'Delivered' },
	{ key: 'opened', label: 'Opened' },
	{ key: 'clicked', label: 'Clicked' },
	{ key: 'bounced', label: 'Bounced' },
	{ key: 'failed', label: 'Failed' },
];

const MAIL_POLL_INTERVAL_MS = 30 * 1000;

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
	if (mail.complainedAt) return 'failed';
	if (mail.bouncedAt) return 'bounced';
	if (mail.clickedAt) return 'clicked';
	if (mail.openedAt) return 'opened';
	if (mail.deliveredAt) return 'delivered';
	if (mail.status === 'queued') return 'queued';
	if (mail.status === 'failed') return 'failed';
	return 'sending';
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
	sending: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
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
	<div className="rounded-[2rem] border border-white/40 bg-white/40 p-5 shadow-sm backdrop-blur-md dark:border-white/5 dark:bg-gray-900/40">
	  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
	  <p className={`mt-1 text-2xl font-black ${colorClass}`}>{value}</p>
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
	const companyNameById = useMemo(() => {
		const map = new Map<string, string>();
		(companies || []).forEach((company: any) => {
			map.set(company._id, toDisplayText(company?.name, 'Unknown Company'));
		});
		return map;
	}, [companies]);

	// Fetch Job Positions (for Filter)
	const jobPositionParams = useMemo(() => {
		if (isSuperAdmin) {
			return selectedCompanyId !== 'all' ? [selectedCompanyId] : undefined;
		}
		return assignedCompanyIds;
	}, [isSuperAdmin, selectedCompanyId, assignedCompanyIds]);
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
			const params: Record<string, any> = { PageCount: 'all' };

			if (queryCompanyIds.length > 0) {
				const companyIds = queryCompanyIds.join(',');
				params.companyId = companyIds;
				params.company = companyIds;
			}

			const res = await axiosInstance.get('/mail', { params });
			return res.data;
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
	
	const filteredMails = useMemo(() => uiRecords.filter(m => {
		const matchesCompany = selectedCompanyId === 'all' || m.companyId === selectedCompanyId;
		const matchesJob = selectedJobId === 'all' || m.applicantJobPositionId === selectedJobId;
		const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
		const matchesSearch = !searchTerm || [m.applicantName, m.applicantEmail, m.subject].some(f => f.toLowerCase().includes(searchTerm.toLowerCase()));
		return matchesCompany && matchesJob && matchesStatus && matchesSearch;
	}), [uiRecords, selectedCompanyId, selectedJobId, statusFilter, searchTerm]);

	const selectedMail = useMemo(() => filteredMails.find(m => m.id === selectedMailId) || (filteredMails.length > 0 ? filteredMails[0] : null), [filteredMails, selectedMailId]);

	const metrics = useMemo(() => {
		const total = uiRecords.length;
		const delivered = uiRecords.filter(m => ['delivered', 'opened', 'clicked'].includes(m.status)).length;
		const open = uiRecords.filter(m => ['opened', 'clicked'].includes(m.status)).length;
		return { total, delivery: total ? Math.round((delivered/total)*100) : 0, open: total ? Math.round((open/total)*100) : 0 };
	}, [uiRecords]);

	return (
		<div className="mx-auto max-w-[1600px] space-y-8 pb-20">
			<PageMeta title="Mail IQ" description="Intelligence Center" />

			<section className="relative overflow-hidden rounded-[3rem] border border-white/20 bg-gradient-to-br from-white/80 to-white/40 p-10 shadow-2xl backdrop-blur-3xl dark:from-gray-900/80 dark:to-gray-900/40">
				<div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-brand-500/10 blur-[100px]" />
				<div className="relative flex flex-col items-center justify-between gap-10 lg:flex-row">
					<div className="space-y-4">
						<div className="inline-flex items-center gap-2 rounded-full border border-brand-200/50 bg-brand-50/50 px-4 py-1 text-[10px] font-black uppercase tracking-widest text-brand-600 dark:border-brand-800/50 dark:bg-brand-900/50 dark:text-brand-400">
							<Sparkles className="h-3.5 w-3.5" /> Intelligence Center
						</div>
						<h1 className="text-5xl font-black tracking-tighter text-gray-900 dark:text-white sm:text-6xl uppercase">Mail Intelligence</h1>
						<p className="max-w-md text-gray-500 dark:text-gray-400 font-medium leading-relaxed">Advanced audit logs and real-time engagement tracking for applicant communications.</p>
					</div>
					<div className="grid w-full grid-cols-2 gap-4 sm:w-auto sm:grid-cols-3">
						<MetricCard label="Volume" value={metrics.total} colorClass="text-gray-900 dark:text-white" />
						<MetricCard label="Delivered" value={`${metrics.delivery}%`} colorClass="text-green-600" />
						<MetricCard label="Open Rate" value={`${metrics.open}%`} colorClass="text-brand-600" />
					</div>
				</div>

				{/* Selection Tool Bar */}
				<div className="mt-8 rounded-[2rem] border border-white/40 bg-white/20 p-3 shadow-lg backdrop-blur-xl">
					<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
						<div className="rounded-2xl border border-white/40 bg-gradient-to-r from-white/80 to-brand-50/70 p-4 dark:from-gray-900/70 dark:to-brand-900/20">
							<p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-brand-600 dark:text-brand-400">Company Scope</p>
							<div className="flex items-center gap-3 rounded-xl border border-brand-100/80 bg-white/70 px-3 py-2.5 shadow-sm dark:border-brand-800/40 dark:bg-gray-950/70">
								<Building2 className="h-4 w-4 text-brand-500" />
								<select
									value={selectedCompanyId}
									onChange={e => { setSelectedCompanyId(e.target.value); setSelectedJobId('all'); }}
									className="w-full appearance-none border-0 bg-transparent p-0 text-sm font-bold tracking-tight text-gray-900 outline-none ring-0 shadow-none focus:outline-none focus:ring-0 dark:text-white dark:[&_option]:bg-gray-950"
								>
									<option value="all">Global Workspace (All Companies)</option>
									{(companies || []).map(c => (
										<option key={c._id} value={c._id}>{toDisplayText((c as any).name, 'Unnamed Company')}</option>
									))}
								</select>
							</div>
						</div>

						<div className="rounded-2xl border border-white/40 bg-gradient-to-r from-white/80 to-orange-50/70 p-4 dark:from-gray-900/70 dark:to-orange-900/20">
							<p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-orange-600 dark:text-orange-400">Job Scope</p>
							<div className="flex items-center gap-3 rounded-xl border border-orange-100/80 bg-white/70 px-3 py-2.5 shadow-sm dark:border-orange-800/40 dark:bg-gray-950/70">
								<Briefcase className="h-4 w-4 text-orange-500" />
								<select
									value={selectedJobId}
									onChange={e => setSelectedJobId(e.target.value)}
									disabled={selectedCompanyId === 'all'}
									className="w-full appearance-none border-0 bg-transparent p-0 text-sm font-bold tracking-tight text-gray-900 outline-none ring-0 shadow-none focus:outline-none focus:ring-0 dark:text-white dark:[&_option]:bg-gray-950"
								>
									{selectedCompanyId === 'all' ? (
										<option value="all">Choose company first</option>
									) : (
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

					<div className="mt-3 flex flex-wrap items-center gap-2 px-1">
						<span className="rounded-full bg-brand-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
							{selectedCompanyId === 'all' ? 'All Companies' : 'Company Filter Active'}
						</span>
						<span className="rounded-full bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-orange-700 dark:text-orange-300">
							{selectedJobId === 'all' ? 'All Jobs' : 'Job Filter Active'}
						</span>
					</div>
				</div>
			</section>

			<div className="grid grid-cols-1 gap-8 xl:grid-cols-[400px_1fr]">
				<aside className="space-y-6">
					<div className="overflow-hidden rounded-[2.5rem] border border-gray-100 bg-white/50 shadow-xl backdrop-blur-xl dark:border-gray-800 dark:bg-gray-950/50">
						<div className="space-y-6 border-b border-gray-50 p-6 dark:border-gray-800">
							<div className="relative">
								<Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
								<input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search transmissions..." className="w-full rounded-2xl border-none bg-gray-50 py-4 pl-12 pr-4 text-sm font-black uppercase tracking-tighter focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900" />
							</div>
							<div className="flex flex-wrap gap-1.5 focus-within:ring-0">
								{STATUS_OPTIONS.map(o => (
									<button key={o.key} onClick={() => setStatusFilter(o.key as any)} className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-tighter transition-all ${statusFilter === o.key ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800'}`}>
										{o.label}
									</button>
								))}
							</div>
						</div>
						<div className="h-[800px] overflow-y-auto p-4 custom-scrollbar">
							<div className="space-y-2">
								{filteredMails.map(m => (
									<button key={m.id} onClick={() => setSelectedMailId(m.id)} className={`group relative w-full rounded-[1.8rem] border p-5 text-left transition-all ${selectedMail?.id === m.id ? 'border-brand-200 bg-brand-50/50 dark:border-brand-500/20 dark:bg-brand-900/10' : 'border-transparent hover:bg-gray-50/50 dark:hover:bg-gray-900/50'}`}>
										<div className="flex items-start justify-between gap-4">
											<div className="min-w-0">
												<p className="text-base font-black tracking-tight text-gray-900 dark:text-white truncate">{m.applicantName}</p>
												<p className="text-[10px] font-bold text-gray-400 truncate uppercase mt-0.5">{m.applicantEmail}</p>
											</div>
											<span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${statusChipClasses[m.status]}`}>{m.status}</span>
										</div>
										<p className="mt-3 line-clamp-1 text-xs font-bold text-gray-600 dark:text-gray-400">{m.subject}</p>
									</button>
								))}
							</div>
						</div>
					</div>
				</aside>

				<main>
					{selectedMail ? (
						<article className="overflow-hidden rounded-[3rem] border border-gray-100 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950">
							<div className="border-b border-gray-50 p-10 dark:border-gray-800">
								<div className="mb-10 flex flex-wrap items-center justify-between gap-6">
									<div className="space-y-2">
										<p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-brand-500">
											<span className="h-1 w-6 rounded-full bg-brand-500" /> Transmission Report
										</p>
										<h2 className="text-4xl font-black tracking-tighter text-gray-900 dark:text-white uppercase">{selectedMail.subject}</h2>
									</div>
									<div className={`rounded-2xl px-6 py-3 text-xs font-black uppercase tracking-widest shadow-sm ${statusChipClasses[selectedMail.status]}`}>
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
										<div key={i} className="rounded-[2rem] bg-gray-50/50 p-6 dark:bg-gray-900/50">
											<p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{c.l}</p>
											<p className="mt-1 font-black text-gray-900 dark:text-white truncate">{c.v}</p>
											<p className="text-[10px] font-bold text-gray-400 mt-0.5 truncate uppercase tracking-tighter">{c.s}</p>
										</div>
									))}
								</div>
							</div>
							<div className="grid grid-cols-1 lg:grid-cols-2">
								<div className="p-10 border-b lg:border-b-0 lg:border-r border-gray-50 dark:border-gray-800">
									<h3 className="mb-10 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400"><Clock3 className="h-4 w-4" /> Activity Feed</h3>
									<div className="space-y-8 pl-4">
										{selectedMail.events.map((e, i) => (
											<div key={i} className="relative pl-8">
												<div className="absolute left-0 top-1 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-brand-500/10" />
												<p className="text-[9px] font-black text-gray-400 opacity-60 uppercase">{formatDateTime(e.at)}</p>
												<p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{e.type.replace(/_/g, ' ')}</p>
												<p className="text-xs font-medium text-gray-500 mt-0.5">{e.detail}</p>
											</div>
										))}
									</div>
								</div>
								<div className="p-10 flex flex-col h-full">
									<div className="mb-10 flex items-center justify-between">
										<h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400"><MessageSquareText className="h-4 w-4" /> Payload Body</h3>
										<div className="h-1 w-10 rounded-full bg-gray-100 dark:bg-gray-800" />
									</div>
									<div className="flex-1 rounded-[2.5rem] border border-gray-50 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-900/50">
										<iframe srcDoc={selectedMail.bodyHtml} title="Mail Preview" className="w-full h-full min-h-[500px] rounded-[2rem] border-none" />
									</div>
								</div>
							</div>
							<div className="bg-gray-50/50 p-10 dark:bg-gray-900/20 border-t border-gray-50 dark:border-gray-800">
								<details className="group">
									<summary className="flex cursor-pointer list-none items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black dark:hover:text-white transition-colors">
										<div className="flex items-center gap-2"><ServerCog className="h-4 w-4" /> Metadata Trace</div>
										<div className="h-4 w-4 transition-transform group-open:rotate-90">→</div>
									</summary>
									<pre className="mt-8 rounded-[2rem] bg-gray-900 p-8 text-[10px] font-mono text-brand-400 overflow-auto dark:bg-black/40 leading-relaxed shadow-2xl">
										{JSON.stringify(selectedMail.raw, null, 2)}
									</pre>
								</details>
							</div>
						</article>
					) : (
						<div className="flex h-[800px] flex-col items-center justify-center rounded-[3.5rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
							<div className="relative">
								<Mail className="h-20 w-20 text-gray-100 dark:text-gray-800" />
								<div className="absolute inset-0 animate-ping rounded-full bg-brand-500/5" />
							</div>
							<p className="mt-8 text-xl font-black tracking-tight text-gray-300 dark:text-gray-700 uppercase">Select transmission to decode</p>
						</div>
					)}
				</main>
			</div>
		</div>
	);
}
