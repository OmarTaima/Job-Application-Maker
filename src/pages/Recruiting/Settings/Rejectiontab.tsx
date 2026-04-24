import { useEffect, useMemo, useState } from "react";
import {
	ArrowRight,
	Ban,
	Building2,
	CircleCheckBig,
	PlusCircle,
	Save,
	ShieldCheck,
	Trash2,
	GripVertical,
} from "lucide-react";
import Swal from "../../../utils/swal";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadCrumb from "../../../components/common/PageBreadCrumb";
import { useAuth } from "../../../context/AuthContext";
import {
	useCompanies,
	useCompanySettings,
	useUpdateCompanyRejectionReasons,
} from "../../../hooks/queries/useCompanies";
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	DragEndEvent,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Props = {
	companyId?: string;
	onSaved?: (rejectReasons: string[]) => void;
	onChange?: (rejectReasons: string[]) => void;
	hideCompanySelector?: boolean;
	embedded?: boolean;
};

type CompanyShape = {
	_id: string;
	name?: string | { en?: string; ar?: string };
	rejectReasons?: string[];
	settings?: {
		_id?: string;
		company?: string;
		rejectReasons?: string[];
	};
};

const normalizeRejectReasons = (reasons: unknown): string[] => {
	if (!Array.isArray(reasons)) return [];

	return reasons
		.map((reason) => String(reason ?? "").trim())
		.filter(Boolean);
};

const getCompanyName = (company: CompanyShape | undefined): string => {
	if (!company) return "No company selected";
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

// Sortable Item Component
function SortableReasonItem({
	id,
	index,
	reason,
	canEdit,
	onUpdateReason,
	onRemoveReason,
}: {
	id: string;
	index: number;
	reason: string;
	canEdit: boolean;
	onUpdateReason: (index: number, value: string) => void;
	onRemoveReason: (index: number) => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 transition-all duration-200 dark:border-slate-700 dark:bg-slate-800/60 md:grid-cols-[auto_1fr_auto] ${
				isDragging ? "shadow-lg ring-2 ring-brand-500" : "hover:shadow-sm"
			}`}
		>
			<div className="flex items-center justify-center">
				<div
					{...attributes}
					{...listeners}
					className={`flex cursor-grab items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 active:cursor-grabbing dark:hover:bg-slate-700 dark:hover:text-slate-300 ${
						!canEdit ? "cursor-not-allowed opacity-50" : ""
					}`}
				>
					<GripVertical className="size-5" />
				</div>
			</div>

			<div>
				<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
					Reason {index + 1}
				</label>
				<input
					value={reason}
					onChange={(e) => onUpdateReason(index, e.target.value)}
					disabled={!canEdit}
					placeholder="Example: Candidate did not meet mandatory experience criteria"
					className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900"
				/>
			</div>

			<div className="flex items-end">
				<button
					type="button"
					onClick={() => onRemoveReason(index)}
					disabled={!canEdit}
					className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition-all hover:bg-red-100 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
				>
					<Trash2 className="size-4" />
				</button>
			</div>
		</div>
	);
}

export default function RejectionTab({
	companyId,
	onSaved,
	onChange,
	hideCompanySelector = false,
	embedded = false,
}: Props) {
	const { user, hasPermission } = useAuth();
	const { data: companies = [], isLoading: isCompaniesLoading } = useCompanies();

	const isSuperAdmin = !!user?.roleId?.name?.toString().toLowerCase().includes("admin");

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

	const showSelector = !hideCompanySelector && (isSuperAdmin || userCompanyIds.length > 1);

	const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(companyId);
	const [rejectReasons, setRejectReasons] = useState<string[]>([]);
	const [isSaving, setIsSaving] = useState(false);

	const selectedCompany = useMemo(
		() => (companies as CompanyShape[]).find((company) => company._id === selectedCompanyId),
		[companies, selectedCompanyId]
	);

	const { data: selectedCompanySettings, isLoading: isSettingsLoading, isFetching: isSettingsFetching } =
		useCompanySettings(selectedCompanyId, { enabled: !!selectedCompanyId });

	const updateRejectionReasonsMutation = useUpdateCompanyRejectionReasons();

	const derivedRejectReasons = useMemo(() => {
		const fromSettings = normalizeRejectReasons((selectedCompanySettings as any)?.rejectReasons);
		if (fromSettings.length > 0) return fromSettings;

		const fromNestedSettings = normalizeRejectReasons(
			(selectedCompanySettings as any)?.settings?.rejectReasons
		);
		if (fromNestedSettings.length > 0) return fromNestedSettings;

		const fromCompanyRoot = normalizeRejectReasons((selectedCompany as any)?.rejectReasons);
		if (fromCompanyRoot.length > 0) return fromCompanyRoot;

		return normalizeRejectReasons((selectedCompany as any)?.settings?.rejectReasons);
	}, [selectedCompany, selectedCompanySettings]);

	const isLoading = isCompaniesLoading || isSettingsLoading || isSettingsFetching;

	useEffect(() => {
		if (companyId && companyId !== selectedCompanyId) {
			setSelectedCompanyId(companyId);
			return;
		}

		if (!selectedCompanyId && companies.length > 0) {
			if (!showSelector && userCompanyIds.length === 1) {
				setSelectedCompanyId(userCompanyIds[0]);
				return;
			}
			setSelectedCompanyId((companies[0] as CompanyShape)?._id);
		}
	}, [companyId, companies, selectedCompanyId, showSelector, userCompanyIds]);

	useEffect(() => {
		setRejectReasons(derivedRejectReasons);
	}, [derivedRejectReasons]);

	useEffect(() => {
		onChange?.(rejectReasons);
	}, [onChange, rejectReasons]);

	const addReason = () => {
		setRejectReasons((prev) => [...prev, ""]);
	};

	const updateReason = (index: number, value: string) => {
		setRejectReasons((prev) => prev.map((reason, i) => (i === index ? value : reason)));
	};

	const removeReason = (index: number) => {
		setRejectReasons((prev) => prev.filter((_, i) => i !== index));
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		
		if (over && active.id !== over.id) {
			setRejectReasons((items) => {
				const oldIndex = items.findIndex((_, i) => i.toString() === active.id);
				const newIndex = items.findIndex((_, i) => i.toString() === over.id);
				
				if (oldIndex !== -1 && newIndex !== -1) {
					return arrayMove(items, oldIndex, newIndex);
				}
				return items;
			});
		}
	};

	const handleSave = async () => {
		if (!selectedCompanyId) {
			Swal.fire("Validation", "Please select a company first.", "warning");
			return;
		}

		const payload = normalizeRejectReasons(rejectReasons);
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
			await updateRejectionReasonsMutation.mutateAsync({
				companyId: primarySaveId,
				data: {
					rejectReasons: payload,
				},
			});

			Swal.fire({
				title: "Saved",
				icon: "success",
				timer: 1200,
				showConfirmButton: false,
			});

			onSaved?.(payload);
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
					await updateRejectionReasonsMutation.mutateAsync({
						companyId: fallbackSaveId,
						data: {
							rejectReasons: payload,
						},
					});

					Swal.fire({
						title: "Saved",
						icon: "success",
						timer: 1200,
						showConfirmButton: false,
					});

					onSaved?.(payload);
					return;
				} catch (retryError: any) {
					Swal.fire(
						"Save Failed",
						retryError?.message || "Failed to save rejection reasons.",
						"error"
					);
					return;
				}
			}

			Swal.fire(
				"Save Failed",
				error?.message || "Failed to save rejection reasons.",
				"error"
			);
		} finally {
			setIsSaving(false);
		}
	};

	// Set up sensors for drag and drop
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 5,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	if (!canRead) {
		return (
			<div className={embedded ? "" : "min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950"}>
				<div className={`${embedded ? "" : "mx-auto max-w-lg"} rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900`}>
					<div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
						<ShieldCheck className="size-8" />
					</div>
					<h2 className="text-2xl font-bold tracking-tight">Restricted Protocol</h2>
					<p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
						Your account does not have permission to manage rejection reasons.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className={embedded ? "space-y-6" : "min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-8"}>
			{!embedded && (
				<>
					<PageMeta
						title="Rejection Reasons | Job Application Maker"
						description="Manage company rejection reasons"
					/>
					<PageBreadCrumb pageTitle="Rejection Reasons" />
				</>
			)}

			<div className={embedded ? "space-y-6" : "mx-auto max-w-7xl space-y-6"}>
				<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="flex flex-col gap-5 border-b border-slate-200 px-6 py-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
						<div className="flex items-start gap-4">
							<div className="flex size-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
								<Ban className="size-6" />
							</div>
							<div>
								<p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600/80 dark:text-rose-300">
									Applicant Workflow
								</p>
								<h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
									Rejection Reasons
								</h1>
								<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
									Configure reusable reasons recruiters can choose when rejecting applicants.
								</p>
							</div>
						</div>

						<button
							onClick={handleSave}
							disabled={isSaving || isLoading || !canEdit}
							className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isSaving ? (
								<div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
							) : (
								<Save className="size-4" />
							)}
							Save Reasons
							<ArrowRight className="size-4" />
						</button>
					</div>

					<div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
						<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
							<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
								Company
							</p>
							<p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
								{getCompanyName(selectedCompany)}
							</p>
						</div>

						<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
							<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
								Total Reasons
							</p>
							<p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
								{normalizeRejectReasons(rejectReasons).length}
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
				</div>

				<div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
					{showSelector && (
						<div className="space-y-6 xl:col-span-3">
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
									Switch company context to manage another rejection reason set.
								</p>
							</div>
						</div>
					)}

					<div className={showSelector ? "xl:col-span-9" : "xl:col-span-12"}>
						<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
							<div className="flex flex-col gap-3 border-b border-slate-200 p-6 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
								<div className="flex items-center gap-3">
									<div className="flex size-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
										<Ban className="size-6" />
									</div>
									<div>
										<h2 className="text-xl font-semibold tracking-tight">Reason Library</h2>
										<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
											Drag and drop to reorder reasons. Keep reasons short and clear for consistent rejection communication.
										</p>
									</div>
								</div>

								<button
									type="button"
									onClick={addReason}
									disabled={!canEdit}
									className="inline-flex items-center gap-2 self-start rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
								>
									<PlusCircle className="size-4" /> Add Reason
								</button>
							</div>

							<div className="space-y-4 p-6">
								{isLoading && (
									<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
										Loading company rejection reasons...
									</div>
								)}

								{!isLoading && rejectReasons.length === 0 && (
									<div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
										<Ban className="mx-auto mb-3 size-10 text-slate-300 dark:text-slate-600" />
										<p className="text-sm font-medium text-slate-500 dark:text-slate-400">
											No rejection reasons yet. Add your first reason to get started.
										</p>
									</div>
								)}

								{!isLoading && rejectReasons.length > 0 && (
									<DndContext
										sensors={sensors}
										collisionDetection={closestCenter}
										onDragEnd={handleDragEnd}
									>
										<SortableContext
											items={rejectReasons.map((_, index) => index.toString())}
											strategy={verticalListSortingStrategy}
										>
											<div className="space-y-3">
												{rejectReasons.map((reason, index) => (
													<SortableReasonItem
														key={index}
														id={index.toString()}
														index={index}
														reason={reason}
														canEdit={canEdit}
														onUpdateReason={updateReason}
														onRemoveReason={removeReason}
													/>
												))}
											</div>
										</SortableContext>
									</DndContext>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}