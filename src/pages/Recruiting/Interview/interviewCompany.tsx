import { useEffect, useMemo, useState } from "react";
import {
	Building2,
	Ban,
	ClipboardList,
	PlusCircle,
	Save,
	Trash2,
	ArrowRight,
	ShieldCheck,
	CircleCheckBig,
} from "lucide-react";
import Swal from "../../../utils/swal";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadCrumb from "../../../components/common/PageBreadCrumb";
import { useAuth } from "../../../context/AuthContext";
import {
	useCompanies,
	useCompanyInterviewSettings,
	useUpdateCompanyInterviewSettings,
} from "../../../hooks/queries/useCompanies";
import RejectionTab from "./Rejectiontab";
import type {
	InterviewAnswerType,
	InterviewGroup,
	InterviewQuestion,
} from "../../../services/companiesService";

type CompanyShape = {
	_id: string;
	name?: string | { en?: string; ar?: string };
	interviewSettings?: {
		groups?: InterviewGroup[];
	};
	settings?: {
		_id?: string;
		company?: string;
		interviewSettings?: {
			groups?: InterviewGroup[];
		};
	};
};

const ANSWER_TYPES: InterviewAnswerType[] = [
	"text",
	"number",
	"radio",
	"checkbox",
	"dropdown",
	"tags",
];

const EMPTY_QUESTION: InterviewQuestion = {
	question: "",
	score: 0,
	answerType: "text",
};



const normalizeQuestion = (question: Partial<InterviewQuestion> | undefined): InterviewQuestion => {
	const answerType =
		question?.answerType && ANSWER_TYPES.includes(question.answerType)
			? question.answerType
			: "text";

	const score = Number(question?.score);
	return {
		question: String(question?.question ?? ""),
		score: Number.isFinite(score) ? score : 0,
		answerType,
	};
};

const normalizeGroups = (groups: InterviewGroup[] | undefined | null): InterviewGroup[] => {
	if (!Array.isArray(groups)) return [];

	return groups.map((group) => ({
		name: String(group?.name ?? ""),
		questions: Array.isArray(group?.questions)
			? group.questions.map((question) => normalizeQuestion(question))
			: [],
	}));
};

const getCompanyName = (company: CompanyShape | undefined): string => {
	if (!company) return "";
	if (typeof company.name === "string") return company.name;
	return company.name?.en || company.name?.ar || "Unnamed Company";
};

const getCompanyIdFromPayload = (
	company: CompanyShape | undefined,
	fallbackCompanyId: string | undefined
): string | undefined => {
	const idFromSettings = company?.settings?.company;
	if (typeof idFromSettings === "string" && idFromSettings.trim()) {
		return idFromSettings;
	}

	if (company?._id) return company._id;
	return fallbackCompanyId;
};

const getCompanySettingsIdFromPayload = (
	company: CompanyShape | undefined
): string | undefined => {
	const settingsId = company?.settings?._id;
	if (typeof settingsId === "string" && settingsId.trim()) {
		return settingsId;
	}
	return undefined;
};

const hasInvalidCompanySettingsIdError = (error: any): boolean => {
	const message = String(
		error?.response?.data?.message ?? error?.message ?? ""
	).toLowerCase();

	if (message.includes("invalid companysettings id")) return true;

	const details = error?.response?.data?.details;
	if (!Array.isArray(details)) return false;

	return details.some((detail: any) => {
		const detailMessage = String(detail?.message ?? "").toLowerCase();
		return detailMessage.includes("companysettings");
	});
};

const hasInvalidCompanyIdError = (error: any): boolean => {
	const message = String(
		error?.response?.data?.message ?? error?.message ?? ""
	).toLowerCase();

	if (message.includes("invalid company id")) return true;

	const details = error?.response?.data?.details;
	if (!Array.isArray(details)) return false;

	return details.some((detail: any) => {
		const detailMessage = String(detail?.message ?? "").toLowerCase();
		return detailMessage.includes("company id");
	});
};

export default function InterviewCompanySettingsPage() {
	const { user, hasPermission } = useAuth();
	const { data: companies = [], isLoading: isCompaniesLoading } = useCompanies();

	const isSuperAdmin =
		!!user?.roleId?.name?.toString().toLowerCase().includes("admin");

	const userCompanyIds = (user?.companies ?? [])
		.map((c: any) =>
			typeof c.companyId === "string" ? c.companyId : c.companyId?._id
		)
		.filter(Boolean) as string[];

	const canRead =
		hasPermission("Company Management", "read") ||
		hasPermission("Settings Management", "read");
	const canEdit =
		hasPermission("Company Management", "write") ||
		hasPermission("Settings Management", "write") ||
		hasPermission("Settings Management", "create");

	const showSelector = isSuperAdmin || userCompanyIds.length > 1;

	const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(undefined);
	const [groups, setGroups] = useState<InterviewGroup[]>([]);
	const [isSaving, setIsSaving] = useState(false);
	const [activeTab, setActiveTab] = useState<"interview-groups" | "rejection-reasons">(
		"interview-groups"
	);

	const selectedCompany = useMemo(
		() => (companies as CompanyShape[]).find((company) => company._id === selectedCompanyId),
		[companies, selectedCompanyId]
	);

	const updateInterviewMutation = useUpdateCompanyInterviewSettings();

	const {
		data: interviewSettingsFromQuery,
		isLoading: isInterviewLoading,
		isFetching: isInterviewFetching,
	} = useCompanyInterviewSettings(selectedCompanyId, { enabled: !!selectedCompanyId && !isSuperAdmin });

	const derivedInterviewSettings = isSuperAdmin
		? (selectedCompany as any)?.interviewSettings ?? (selectedCompany as any)?.settings?.interviewSettings ?? null
		: interviewSettingsFromQuery;

	const isLoading = isSuperAdmin ? isCompaniesLoading : isInterviewLoading || isInterviewFetching;
	const isInterviewGroupsTab = activeTab === "interview-groups";

	useEffect(() => {
		if (!selectedCompanyId && companies.length > 0) {
			if (!showSelector && userCompanyIds.length === 1) {
				setSelectedCompanyId(userCompanyIds[0]);
				return;
			}
			setSelectedCompanyId((companies[0] as CompanyShape)?._id);
		}
	}, [companies, selectedCompanyId, showSelector, userCompanyIds]);

	useEffect(() => {
		const normalized = normalizeGroups(derivedInterviewSettings?.groups);
		setGroups(normalized);
	}, [derivedInterviewSettings]);

    



	const totalQuestions = useMemo(
		() => groups.reduce((acc, group) => acc + group.questions.length, 0),
		[groups]
	);

	const addGroup = () => {
		setGroups((prev) => [
			...prev,
			{
				name: `Group ${prev.length + 1}`,
				questions: [{ ...EMPTY_QUESTION }],
			},
		]);
	};

	const removeGroup = (groupIndex: number) => {
		setGroups((prev) => prev.filter((_, index) => index !== groupIndex));
	};

	const updateGroupName = (groupIndex: number, name: string) => {
		setGroups((prev) =>
			prev.map((group, index) =>
				index === groupIndex ? { ...group, name } : group
			)
		);
	};

	const addQuestion = (groupIndex: number) => {
		setGroups((prev) =>
			prev.map((group, index) => {
				if (index !== groupIndex) return group;
				return {
					...group,
					questions: [...group.questions, { ...EMPTY_QUESTION }],
				};
			})
		);
	};

	const removeQuestion = (groupIndex: number, questionIndex: number) => {
		setGroups((prev) =>
			prev.map((group, index) => {
				if (index !== groupIndex) return group;
				return {
					...group,
					questions: group.questions.filter((_, idx) => idx !== questionIndex),
				};
			})
		);
	};

	const updateQuestion = (
		groupIndex: number,
		questionIndex: number,
		patch: Partial<InterviewQuestion>
	) => {
		setGroups((prev) =>
			prev.map((group, index) => {
				if (index !== groupIndex) return group;

				return {
					...group,
					questions: group.questions.map((question, qIndex) =>
						qIndex === questionIndex ? { ...question, ...patch } : question
					),
				};
			})
		);
	};

    

	const validateGroups = (): InterviewGroup[] | null => {
		for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
			const group = groups[groupIndex];
			if (!group.name.trim()) {
				Swal.fire(
					"Validation",
					`Group ${groupIndex + 1} must have a name.`,
					"warning"
				);
				return null;
			}

			for (let questionIndex = 0; questionIndex < group.questions.length; questionIndex += 1) {
				const question = group.questions[questionIndex];

				if (!question.question.trim()) {
					Swal.fire(
						"Validation",
						`Question ${questionIndex + 1} in group ${groupIndex + 1} must not be empty.`,
						"warning"
					);
					return null;
				}

				if (!Number.isFinite(question.score)) {
					Swal.fire(
						"Validation",
						`Question ${questionIndex + 1} in group ${groupIndex + 1} needs a valid numeric score.`,
						"warning"
					);
					return null;
				}
			}
		}

		return groups.map((group) => ({
			name: group.name.trim(),
			questions: group.questions.map((question) => ({
				question: question.question.trim(),
				score: Number(question.score),
				answerType: question.answerType,
			})),
		}));
	};

	const handleSaveAll = async () => {
		if (!selectedCompanyId) {
			Swal.fire("Validation", "Please select a company first.", "warning");
			return;
		}

		const payloadGroups = validateGroups();
		if (!payloadGroups) return;

		const targetCompanyId = getCompanyIdFromPayload(selectedCompany, selectedCompanyId);
		const companySettingsId = getCompanySettingsIdFromPayload(selectedCompany);
		const primarySaveId = companySettingsId ?? targetCompanyId;
		const fallbackSaveId =
			companySettingsId && targetCompanyId && companySettingsId !== targetCompanyId
				? targetCompanyId
				: undefined;

		if (!primarySaveId) {
			Swal.fire("Validation", "Unable to resolve company identity for saving.", "warning");
			return;
		}

		setIsSaving(true);
		try {
			await updateInterviewMutation.mutateAsync({
				companyId: primarySaveId,
				data: {
					groups: payloadGroups,
				},
			});

			Swal.fire({
				title: "Saved",
				icon: "success",
				timer: 1200,
				showConfirmButton: false,
			});
		} catch (error: any) {
			const canRetryWithSettingsId =
				!!fallbackSaveId &&
				(
					hasInvalidCompanySettingsIdError(error) ||
					hasInvalidCompanyIdError(error) ||
					error?.response?.status === 404
				);

			if (canRetryWithSettingsId) {
				try {
					await updateInterviewMutation.mutateAsync({
						companyId: fallbackSaveId,
						data: {
							groups: payloadGroups,
						},
					});

					Swal.fire({
						title: "Saved",
						icon: "success",
						timer: 1200,
						showConfirmButton: false,
					});
					return;
				} catch (retryError: any) {
					Swal.fire(
						"Save Failed",
						retryError?.message || "Failed to save interview settings.",
						"error"
					);
					return;
				}
			}

			Swal.fire(
				"Save Failed",
				error?.message || "Failed to save interview settings.",
				"error"
			);
		} finally {
			setIsSaving(false);
		}
	};

	if (!canRead) {
		return (
			<div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
				<div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
						<ShieldCheck className="size-8" />
					</div>
					<h2 className="text-2xl font-bold tracking-tight">Restricted Protocol</h2>
					<p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
						Your account does not have permission to manage interview configuration.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-8">
			<PageMeta
				title="Interview Settings | Job Application Maker"
				description="Manage interview groups, questions, reject reasons, and gradient settings per company"
			/>
			<PageBreadCrumb pageTitle="Interview Configuration" />

			<div className="mx-auto max-w-7xl space-y-6">
				<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="flex flex-col gap-5 border-b border-slate-200 px-6 py-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
						<div className="flex items-start gap-4">
							<div className="flex size-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
								<ClipboardList className="size-6" />
							</div>
							<div>
								<p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600/80 dark:text-brand-300">
									Interview Settings
								</p>
								<h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
									Company Interview Playbook
								</h1>
								<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
									Define interview groups, scoring rules, answer types, and rejection reasons from a unified screen.
								</p>
							</div>
						</div>
						{isInterviewGroupsTab && (
							<button
								onClick={handleSaveAll}
								disabled={isSaving || isLoading || !canEdit}
								className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{isSaving ? (
									<div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
								) : (
									<Save className="size-4" />
								)}
								Save All
								<ArrowRight className="size-4" />
							</button>
						)}
					</div>

					<div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
						<button
							type="button"
							onClick={() => setActiveTab("interview-groups")}
							className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
								isInterviewGroupsTab
									? "bg-brand-500 text-white"
									: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
							}`}
						>
							<ClipboardList className="size-4" /> Interview Groups
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("rejection-reasons")}
							className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
								!isInterviewGroupsTab
									? "bg-brand-500 text-white"
									: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
							}`}
						>
							<Ban className="size-4" /> Rejection Reasons
						</button>
					</div>

					{isInterviewGroupsTab && (
						<div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-4">
						<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
							<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
								Company
							</p>
							<p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
								{getCompanyName(selectedCompany) || "No company selected"}
							</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
							<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
								Interview Groups
							</p>
							<p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
								{groups.length}
							</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
							<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
								Total Questions
							</p>
							<p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
								{totalQuestions}
							</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
							<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
								Save Status
							</p>
							<p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
								<CircleCheckBig className="size-4" /> Ready
							</p>
						</div>
						</div>
					)}
				</div>

				<div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
					<div className={showSelector ? "space-y-6 xl:col-span-3" : "hidden"}>
						{showSelector && (
								<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
									<div className="mb-4 flex items-center gap-3">
										<div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
											<Building2 className="size-5" />
										</div>
										<h3 className="text-lg font-semibold tracking-tight">Active Company</h3>
									</div>
									<div className="relative">
										<select
											value={selectedCompanyId || ""}
											onChange={(e) => setSelectedCompanyId(e.target.value || undefined)}
											className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-10 text-sm font-medium outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800"
										>
											{(companies as CompanyShape[]).map((company) => (
												<option key={company._id} value={company._id}>
													{getCompanyName(company)}
												</option>
											))}
										</select>
										<ArrowRight className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 rotate-90 text-slate-400" />
									</div>
									<p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
										Change company context to configure another interview blueprint.
									</p>
								</div>
						)}

                        
					</div>

					<div className={showSelector ? "xl:col-span-9" : "xl:col-span-12"}>
						{isInterviewGroupsTab ? (
							<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
							<div className="flex flex-col gap-3 border-b border-slate-200 p-6 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
								<div className="flex items-center gap-3">
									<div className="flex size-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
										<ClipboardList className="size-6" />
									</div>
									<div>
										<h2 className="text-xl font-semibold tracking-tight">Interview Groups</h2>
										<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
											Create question groups and choose the answer type for each question.
										</p>
									</div>
								</div>

								<button
									type="button"
									onClick={addGroup}
									disabled={!canEdit}
									className="inline-flex items-center gap-2 self-start rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
								>
									<PlusCircle className="size-4" /> Add Group
								</button>
							</div>

							<div className="space-y-5 p-6">
								{isLoading && (
									<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
										Loading company interview settings...
									</div>
								)}

								{!isLoading && groups.length === 0 && (
									<div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
										<ClipboardList className="mx-auto mb-3 size-10 text-slate-300 dark:text-slate-600" />
										<p className="text-sm font-medium text-slate-500 dark:text-slate-400">
											No interview groups yet. Add your first group to get started.
										</p>
									</div>
								)}

								{groups.map((group, groupIndex) => (
									<div
										key={`${group.name}-${groupIndex}`}
										className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
									>
										<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
											<div className="flex-1">
												<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
													Group Name
												</label>
												<input
													value={group.name}
													onChange={(e) => updateGroupName(groupIndex, e.target.value)}
													disabled={!canEdit}
													placeholder="Technical Assessment"
													className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800"
												/>
											</div>

											<button
												type="button"
												onClick={() => removeGroup(groupIndex)}
												disabled={!canEdit}
												className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
											>
												<Trash2 className="size-4" /> Remove Group
											</button>
										</div>

										<div className="space-y-3">
											{group.questions.map((question, questionIndex) => (
												<div
													key={`${groupIndex}-${questionIndex}`}
													className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60 lg:grid-cols-[1fr_150px_130px_auto]"
												>
													<div>
														<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
															Question
														</label>
														<input
															value={question.question}
															onChange={(e) =>
																updateQuestion(groupIndex, questionIndex, {
																	question: e.target.value,
																})
															}
															disabled={!canEdit}
															placeholder="Tell us about a complex challenge you solved"
															className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900"
														/>
													</div>

													<div>
														<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
															Answer Type
														</label>
														<select
															value={question.answerType}
															onChange={(e) =>
																updateQuestion(groupIndex, questionIndex, {
																	answerType: e.target.value as InterviewAnswerType,
																})
															}
															disabled={!canEdit}
															className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900"
														>
															{ANSWER_TYPES.map((type) => (
																<option key={type} value={type}>
																	{type}
																</option>
															))}
														</select>
													</div>

													<div>
														<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
															Score
														</label>
														<input
															type="number"
															min={0}
															value={question.score}
															onChange={(e) =>
																updateQuestion(groupIndex, questionIndex, {
																	score: Number(e.target.value),
																})
															}
															disabled={!canEdit}
															className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900"
														/>
													</div>

													<div className="flex items-end">
														<button
															type="button"
															onClick={() => removeQuestion(groupIndex, questionIndex)}
															disabled={!canEdit}
															className="inline-flex h-10 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
														>
															<Trash2 className="size-4" />
														</button>
													</div>
												</div>
											))}

											<button
												type="button"
												onClick={() => addQuestion(groupIndex)}
												disabled={!canEdit}
												className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300"
											>
												<PlusCircle className="size-4" /> Add Question
											</button>
										</div>
									</div>
								))}
							</div>
							</div>
						) : (
							<RejectionTab
								companyId={selectedCompanyId}
								hideCompanySelector
								embedded
							/>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
