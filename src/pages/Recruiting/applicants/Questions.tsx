import { useState, useEffect, useMemo } from 'react';
import Label from '../../../components/form/Label';

type InterviewQuestion = {
	question?: string;
	score?: number;
	achievedScore?: number;
	notes?: string | null;
	answer?: string | null;
	answerType?: string;
	choices?: string[];
};

type InterviewLike = {
	_id?: string;
	status?: string;
	questions?: InterviewQuestion[];
	scheduledAt?: string | number;
	startedAt?: string | number;
	issuedAt?: string | number;
	createdAt?: string | number;
};

type QuestionsProps = {
	status?: string;
	interviews?: InterviewLike[];
	className?: string;
};

const normalizeStatus = (value?: string) => String(value || '').trim().toLowerCase();

export default function Questions({ status, interviews = [], className = '' }: QuestionsProps) {
	if (normalizeStatus(status) !== 'interviewed') return null;

	const interviewIds = useMemo(() => (Array.isArray(interviews) ? interviews.map((iv, i) => iv?._id ?? `idx_${i}`) : []), [interviews]);

	const defaultIndex = useMemo(() => {
		if (!Array.isArray(interviews) || interviews.length === 0) return -1;
		const idx = interviews.findIndex((iv) => normalizeStatus(iv?.status) === 'completed');
		return idx >= 0 ? idx : 0;
	}, [interviews]);

	const [selectedId, setSelectedId] = useState<string | null>(() => (interviewIds.length > 0 ? interviewIds[Math.max(0, defaultIndex || 0)] : null));

	useEffect(() => {
		// keep selection valid when interviews prop changes
		if (interviewIds.length === 0) {
			setSelectedId(null);
			return;
		}
		if (selectedId && interviewIds.includes(selectedId)) return;
		setSelectedId(interviewIds[Math.max(0, defaultIndex || 0)]);
	}, [interviewIds, selectedId, defaultIndex]);

	const selectedInterview = useMemo(() => {
		if (!selectedId) return null;
		const idx = interviewIds.indexOf(selectedId);
		if (idx >= 0 && Array.isArray(interviews) && interviews[idx]) return interviews[idx];
		// fallback: try find by _id
		return Array.isArray(interviews) ? interviews.find((iv) => String(iv?._id || '') === String(selectedId)) || null : null;
	}, [selectedId, interviewIds, interviews]);

	if (!selectedInterview) return null;

	const questions = Array.isArray(selectedInterview.questions) ? selectedInterview.questions : [];
	const totalScore = questions.reduce((sum, q) => sum + (Number(q?.score) || 0), 0);
	const achievedScore = questions.reduce((sum, q) => sum + (Number(q?.achievedScore) || 0), 0);
	const percentage = totalScore > 0 ? Math.round((achievedScore / totalScore) * 100) : 0;

	return (
		<div
			className={`group relative pl-5 pr-5 py-5 bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border-l-4 border-emerald-500 hover:bg-white dark:hover:bg-gray-800/60 transition-all duration-200 hover:shadow-lg ${className}`.trim()}
		>
			<div className="flex items-baseline justify-between gap-4">
				<div className="flex items-center gap-4">
					<div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30 rounded-lg group-hover:scale-110 transition-transform">
					<svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<div>
					<Label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Interview Results</Label>
					<p className="text-sm text-gray-900 dark:text-white mt-1">
						Score: {achievedScore} / {totalScore} ({percentage}%)
					</p>
				</div>
				</div>

				{Array.isArray(interviews) && interviews.length > 1 && (
					<div className="ml-4">
						<label className="sr-only">Select interview</label>
						<select
							value={selectedId ?? ''}
							onChange={(e) => setSelectedId(e.target.value)}
							className="text-sm rounded-md border border-gray-200 bg-white px-2 py-1 text-gray-700 dark:bg-gray-800 dark:border-gray-700"
						>
							{interviews.map((iv, idx) => {
								const id = interviewIds[idx];
								const statusLabel = iv?.status ? String(iv.status) : 'Interview';
								const date = iv?.scheduledAt ?? iv?.startedAt ?? iv?.issuedAt ?? iv?.createdAt;
								const dateStr = date ? new Date(date).toLocaleString() : `#${idx + 1}`;
								return (
									<option key={id} value={id}>
										{`${statusLabel} · ${dateStr}`}
									</option>
								);
							})}
						</select>
					</div>
				)}
			</div>

			<div className="mt-4">
				{questions.length === 0 ? (
					<p className="text-sm text-gray-500">No interview questions recorded.</p>
				) : (
					<ul className="space-y-3 mt-2">
						{questions.map((q, idx) => {
							const answer = String(q?.answer ?? q?.notes ?? '').trim();
							const answerType = String(q?.answerType || '').toLowerCase();
							const choices = Array.isArray(q?.choices) ? q!.choices : [];
							return (
								<li key={`ivq_${idx}`} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
									<div className="flex items-start justify-between gap-4">
										<div className="flex-1">
											<p className="text-sm font-medium text-gray-800 dark:text-white">{String(q?.question || '')}</p>
											{choices.length > 0 && (answerType === 'radio' || answerType === 'dropdown' || answerType === 'checkbox') ? (
												<div className="mt-2 flex flex-wrap gap-2">
													{choices.map((choice) => {
														const selected = String(choice) === answer;
														return (
															<span key={choice} className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${selected ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-white/90'}`}>
															{choice}
														</span>
													);
													})}
												</div>
											) : answerType === 'tags' ? (
												<div className="mt-2 flex flex-wrap gap-2">
													{(answer || '').split(',').map((t) => String(t || '').trim()).filter(Boolean).map((tag) => (
														<span key={tag} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800 dark:bg-gray-800 dark:text-white/90">{tag}</span>
													))}
												</div>
											) : (
												<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Answer: {answer || '-'}</p>
											)}
										</div>
										<div className="text-sm text-gray-700 dark:text-gray-200 min-w-[86px] text-right">
											<div className="font-bold">
												{Number(q?.achievedScore || 0)} / {Number(q?.score || 0)}
											</div>
										</div>
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}
