import { useEffect, useMemo, useState } from "react";
import {
	ClipboardList,
	PlusCircle,
	Save,
	Trash2,
	ArrowRight,
	CircleCheckBig,
	LibraryBig,
} from "lucide-react";
import Swal from "../../../utils/swal";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadCrumb from "../../../components/common/PageBreadCrumb";
import {
	useDeleteSavedQuestionGroup,
	useSavedQuestionGroups,
	useUpdateSavedQuestionGroups,
} from "../../../hooks/queries";
import type {
	SavedQuestion,
	SavedQuestionAnswerType,
	SavedQuestionGroup,
} from "../../../services/savedQuestionGroupsService";

const ANSWER_TYPES: SavedQuestionAnswerType[] = [
	"text",
	"number",
	"radio",
	"checkbox",
	"dropdown",
	"tags",
];

const EMPTY_QUESTION: SavedQuestion = {
	question: "",
	score: 0,
	answerType: "text",
};

const normalizeGroups = (
	groups: SavedQuestionGroup[] | undefined | null
): SavedQuestionGroup[] => {
	if (!Array.isArray(groups)) return [];

	return groups.map((group: any) => ({
		_id: typeof group?._id === "string" ? group._id : undefined,
		name: String(group?.name ?? ""),
		questions: Array.isArray(group?.questions)
			? group.questions.map((question: any) => {
				const answerType = ANSWER_TYPES.includes(question?.answerType)
					? question.answerType
					: "text";
				const score = Number(question?.score);
				return {
					question: String(question?.question ?? ""),
					score: Number.isFinite(score) ? score : 0,
					answerType,
				};
			})
			: [],
	}));
};

export default function SavedQuestionsPage() {
	const {
		data: groupsFromApi,
		isLoading: isGroupsLoading,
		isFetching: isGroupsFetching,
	} = useSavedQuestionGroups();
	const updateGroupsMutation = useUpdateSavedQuestionGroups();
	const deleteGroupMutation = useDeleteSavedQuestionGroup();

	const [groups, setGroups] = useState<SavedQuestionGroup[]>([]);
	const [isSaving, setIsSaving] = useState(false);

	const isLoading = isGroupsLoading || isGroupsFetching;

	useEffect(() => {
		setGroups(normalizeGroups(groupsFromApi));
	}, [groupsFromApi]);

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

	const removeGroup = async (groupIndex: number) => {
		const groupToRemove = groups[groupIndex];
		if (!groupToRemove) return;

		setGroups((prev) => prev.filter((_, index) => index !== groupIndex));

		if (!groupToRemove._id) return;

		try {
			await deleteGroupMutation.mutateAsync(groupToRemove._id);
		} catch (error: any) {
			setGroups((prev) => {
				if (prev.some((group) => group._id === groupToRemove._id)) {
					return prev;
				}

				const restored = [...prev];
				const insertIndex = Math.min(groupIndex, restored.length);
				restored.splice(insertIndex, 0, groupToRemove);
				return restored;
			});

			Swal.fire(
				"Delete Failed",
				error?.message || "Failed to delete question group.",
				"error"
			);
		}
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
		patch: Partial<SavedQuestion>
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

	const validateGroups = (): SavedQuestionGroup[] | null => {
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
		const payloadGroups = validateGroups();
		if (!payloadGroups) return;

		setIsSaving(true);
		try {
			const savedGroups = await updateGroupsMutation.mutateAsync(payloadGroups);
			setGroups(normalizeGroups(savedGroups));

			Swal.fire({
				title: "Saved",
				text: "Saved questions updated successfully.",
				icon: "success",
				timer: 1200,
				showConfirmButton: false,
			});
		} catch (error: any) {
			Swal.fire(
				"Save Failed",
				error?.message || "Failed to save question groups.",
				"error"
			);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-8">
			<PageMeta
				title="Saved Questions | Job Application Maker"
				description="Manage reusable interview question groups for the current user"
			/>
			<PageBreadCrumb pageTitle="Saved Questions" />

			<div className="mx-auto max-w-7xl space-y-6">
				<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="flex flex-col gap-5 border-b border-slate-200 px-6 py-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
						<div className="flex items-start gap-4">
							<div className="flex size-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
								<LibraryBig className="size-6" />
							</div>
							<div>
								<p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600/80 dark:text-brand-300">
									Saved Questions
								</p>
								<h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
									Interview Question Library
								</h1>
								<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
									Build reusable question groups for interviews. This library is separate from company interview settings.
								</p>
							</div>
						</div>
						<button
							onClick={handleSaveAll}
							disabled={isSaving || isLoading}
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
					</div>

					<div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
						<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
							<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
								Question Groups
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
				</div>

				<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="flex flex-col gap-3 border-b border-slate-200 p-6 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
						<div className="flex items-center gap-3">
							<div className="flex size-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
								<ClipboardList className="size-6" />
							</div>
							<div>
								<h2 className="text-xl font-semibold tracking-tight">Saved Question Groups</h2>
								<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
									Create reusable questions and answer types for future interviews.
								</p>
							</div>
						</div>

						<button
							type="button"
							onClick={addGroup}
							disabled={isLoading}
							className="inline-flex items-center gap-2 self-start rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
						>
							<PlusCircle className="size-4" /> Add Group
						</button>
					</div>

					<div className="space-y-5 p-6">
						{isLoading && (
							<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
								Loading saved question groups...
							</div>
						)}

						{!isLoading && groups.length === 0 && (
							<div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
								<ClipboardList className="mx-auto mb-3 size-10 text-slate-300 dark:text-slate-600" />
								<p className="text-sm font-medium text-slate-500 dark:text-slate-400">
									No saved question groups yet. Add your first group to get started.
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
											placeholder="Behavioral Questions"
											className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800"
										/>
									</div>

									<button
										type="button"
										onClick={() => removeGroup(groupIndex)}
										className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
									>
										<Trash2 className="size-4" /> Remove Group
									</button>
								</div>

								<div className="space-y-3">
									{group.questions.map((question, questionIndex) => (
										<div
											key={`${groupIndex}-${questionIndex}`}
											className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60 lg:grid-cols-[1fr_170px_120px_auto]"
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
													placeholder="Describe a time you resolved a difficult issue"
													className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900"
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
																answerType: e.target.value as SavedQuestionAnswerType,
														})
													}
													className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900"
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
													value={question.score}
													onChange={(e) => {
														const value = Number(e.target.value);
														updateQuestion(groupIndex, questionIndex, {
															score: Number.isFinite(value) ? value : 0,
														});
													}}
													className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900"
												/>
											</div>

											<div className="flex items-end">
												<button
													type="button"
													onClick={() => removeQuestion(groupIndex, questionIndex)}
													className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
												>
													<Trash2 className="size-4" /> Remove
												</button>
											</div>
										</div>
									))}

									<button
										type="button"
										onClick={() => addQuestion(groupIndex)}
										className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300"
									>
										<PlusCircle className="size-4" /> Add Question
									</button>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
