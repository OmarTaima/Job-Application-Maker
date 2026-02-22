import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useApplicants } from "../../../hooks/queries/useApplicants";
import { useJobPositions } from "../../../hooks/queries/useJobPositions";
import { useCompanies } from "../../../hooks/queries/useCompanies";
import LoadingSpinner from "../../../components/common/LoadingSpinner";

export default function ApplicantsMobile(): JSX.Element {
	const [query, setQuery] = useState("");
	const [selectedCompany, setSelectedCompany] = useState<string | undefined>(undefined);
	const [selectedJob, setSelectedJob] = useState<string | undefined>(undefined);
	const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);

	const navigate = useNavigate();

	const { data: companies = [] } = useCompanies();
	const { data: jobPositions = [] } = useJobPositions(selectedCompany ? [selectedCompany] : undefined);
	const {
		data: applicants = [],
		isLoading: loading,
		
		refetch,
	} = useApplicants(selectedCompany ? [selectedCompany] : undefined, selectedJob);

	const filtered = (applicants || []).filter((a) => {
		if (selectedStatus && a.status !== selectedStatus) return false;
		if (!query) return true;
		const q = query.toLowerCase();
		return (
			(a.fullName || "").toLowerCase().includes(q) ||
			(a.email || "").toLowerCase().includes(q) ||
			(a.phone || "").toLowerCase().includes(q)
		);
	});

	const companyMap = useMemo(() => {
		const m: Record<string, string> = {};
		companies.forEach((c: any) => {
			m[c._id] = c.name || c.companyName || c.title || "";
		});
		return m;
	}, [companies]);

	const jobMap = useMemo(() => {
		const m: Record<string, string> = {};
		jobPositions.forEach((j: any) => {
			m[j._id] = j.title || j.name || "";
		});
		return m;
	}, [jobPositions]);

	const [filtersOpen, setFiltersOpen] = useState(false);

	return (
		<div className="min-h-screen bg-slate-50">
			<div className="sticky top-0 z-30 bg-white border-b">
				<div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
					<div>
						<h1 className="text-lg font-semibold">Applicants</h1>
						<p className="text-xs text-gray-500">{(applicants || []).length} total</p>
					</div>
					<div className="flex items-center gap-2">
						<button onClick={() => refetch && refetch()} className="p-2 rounded bg-gray-100">
							Refresh
						</button>
						<button onClick={() => { setSelectedCompany(undefined); setSelectedJob(undefined); setSelectedStatus(undefined); }} className="p-2 rounded bg-gray-100">
							Clear
						</button>
					</div>
				</div>
				<div className="px-4 pb-3">
					<div className="flex gap-2">
						<input
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search by name, email or phone"
							className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring"
						/>
						<button onClick={() => setFiltersOpen((s) => !s)} className="px-3 py-2 bg-primary-600 text-white rounded-lg">Filters</button>
					</div>
				</div>
			</div>

			<div className="max-w-xl mx-auto px-4 py-3">
				{/* Collapsible filters */}
				{filtersOpen && (
					<div className="mb-3 bg-white p-3 rounded-lg shadow-sm">
						<div className="grid grid-cols-1 gap-2">
							<select
								value={selectedCompany ?? ""}
								onChange={(e) => { const v = e.target.value || undefined; setSelectedCompany(v); setSelectedJob(undefined); }}
								className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white"
							>
								<option value="">All companies</option>
								{companies.map((c: any) => (
									<option key={c._id} value={c._id}>{c.name || c.companyName || c.title}</option>
								))}
							</select>

							<select
								value={selectedJob ?? ""}
								onChange={(e) => setSelectedJob(e.target.value || undefined)}
								className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white"
							>
								<option value="">All jobs</option>
								{jobPositions.map((j: any) => (
									<option key={j._id} value={j._id}>{j.title || j.name}</option>
								))}
							</select>

							<div>
								<label className="text-xs text-gray-600">Status</label>
								<div className="mt-1 flex flex-wrap gap-2">
									{["applied","under_review","pending","interview","interviewed","accepted","approved","rejected","trashed"].map((s) => (
										<button key={s} onClick={() => setSelectedStatus(selectedStatus === s ? undefined : s)} className={`px-3 py-1 rounded-full text-xs ${selectedStatus===s? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
											{ s.replace('_',' ') }
										</button>
									))}
								</div>
							</div>
						</div>
					</div>
				)}

				{loading ? (
					<div className="py-10 flex justify-center"><LoadingSpinner/></div>
				) : filtered.length === 0 ? (
					<div className="text-center text-gray-500 py-10">No applicants found</div>
				) : (
					<div className="space-y-3">
						{filtered.map((a) => (
							<div key={a._id} onClick={() => navigate(`/applicant/${a._id}`)} className="bg-white rounded-2xl p-4 shadow-sm flex items-start gap-3 touch-manipulation">
								<div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
									{a.profilePhoto ? <img src={a.profilePhoto} alt={a.fullName} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl font-semibold text-gray-600">{(a.firstName || a.fullName || '').charAt(0).toUpperCase()}</div>}
								</div>
								<div className="flex-1">
									<div className="flex items-center justify-between gap-2">
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<h3 className="text-sm font-semibold truncate">{a.fullName}</h3>
												<span className="text-xs text-gray-400 truncate">{companyMap[a.companyId] || ''}</span>
											</div>
											<p className="text-xs text-gray-500 truncate mt-1">{jobMap[a.jobPositionId] || ''}</p>
										</div>
										<span className={`text-xs px-2 py-1 rounded-full ${a.status==='rejected' || a.status==='trashed' ? 'bg-red-100 text-red-700' : a.status==='accepted' || a.status==='approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>{a.status.replace('_',' ')}</span>
									</div>
									<div className="mt-2 flex items-center justify-between">
										<p className="text-xs text-gray-400">{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : ''}</p>
										<div className="flex gap-2">
											<a onClick={(e) => e.stopPropagation()} href={`mailto:${a.email}`} className="px-3 py-1 bg-gray-100 rounded-lg text-xs">✉️</a>
											{a.phone ? <a onClick={(e) => e.stopPropagation()} href={`tel:${a.phone}`} className="px-3 py-1 bg-gray-100 rounded-lg text-xs">📞</a> : null}
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
									
}

