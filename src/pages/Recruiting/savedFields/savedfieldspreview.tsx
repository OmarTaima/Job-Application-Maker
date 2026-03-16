import { useLocation, useNavigate, useParams } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import { useSavedFields } from "../../../hooks/queries";
import { PencilIcon } from "../../../icons";

export default function SavedFieldsPreview() {
  const { state } = useLocation();
  const { fieldId } = useParams<{ fieldId: string }>();
  const navigate = useNavigate();
  const { data } = useSavedFields();

  const field = state?.field || (data || []).find((f: any) => f.fieldId === decodeURIComponent(fieldId || ""));

  if (!field) {
    return (
      <div className="mx-auto max-w-4xl space-y-8 pb-20 pt-10 text-center">
        <PageMeta title="Field Not Found" description="Template mismatch" />
        <div className="rounded-[2.5rem] border border-gray-100 bg-white p-20 shadow-xl dark:border-gray-800 dark:bg-gray-950">
          <div className="flex flex-col items-center">
             <div className="rounded-full bg-error-50 p-6 dark:bg-error-500/10 mb-6">
                <svg className="size-12 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
             </div>
             <h2 className="text-3xl font-black text-gray-900 dark:text-white">Template Not Found</h2>
             <p className="mt-4 text-gray-500 dark:text-gray-400">The field template you are looking for does not exist or has been removed.</p>
             <button onClick={() => navigate(-1)} className="mt-8 rounded-2xl bg-brand-500 px-8 py-3 font-bold text-white shadow-lg shadow-brand-500/25">Return to Repository</button>
          </div>
        </div>
      </div>
    );
  }

  const labelEn = typeof field.label === "string" ? field.label : (field.label?.en || "Unnamed Field");
  const labelAr = typeof field.label === "string" ? "" : (field.label?.ar || "");

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      <PageMeta title={`${labelEn} | Template Preview`} description={`Detailed preview for ${labelEn}`} />
      
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageBreadcrumb pageTitle="Field Template Preview" />
        <div className="flex gap-3">
            <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"
            >
                Back
            </button>
            <button
                onClick={() => navigate(`/recruiting/saved-fields/create`, { state: { field } })}
                className="inline-flex items-center gap-2 rounded-2xl bg-brand-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600"
            >
                <PencilIcon className="size-4" />
                Edit Template
            </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2.5rem] border border-gray-100 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-950">
        <div className="relative h-48 bg-gradient-to-br from-brand-500 to-indigo-600 dark:from-brand-600 dark:to-indigo-800">
            <div className="absolute -bottom-12 left-10 flex h-24 w-24 items-center justify-center rounded-3xl bg-white p-4 shadow-xl dark:bg-gray-900">
                <div className="flex h-full w-full items-center justify-center rounded-2xl bg-brand-50 text-3xl font-black text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                    {field.inputType.substring(0, 1).toUpperCase()}
                </div>
            </div>
            
            <div className="absolute bottom-6 left-40">
                <h1 className="text-3xl font-black text-white">{labelEn}</h1>
                <p className="text-brand-100 font-medium opacity-80" dir="rtl">{labelAr}</p>
            </div>
        </div>

        <div className="p-10 pt-20">
            <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
                <div className="space-y-6 md:col-span-2">
                    <section>
                        <h3 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-gray-400">Configuration Details</h3>
                        <div className="grid grid-cols-2 gap-8 rounded-3xl bg-gray-50/50 p-8 dark:bg-gray-900/50">
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-gray-400">FIELD TYPE</span>
                                <div className="text-lg font-bold text-gray-900 dark:text-white capitalize">{field.inputType.replace("_", " ")}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-gray-400">VALIDATION</span>
                                <div className={`text-lg font-bold ${field.isRequired ? "text-error-500" : "text-emerald-500"}`}>
                                    {field.isRequired ? "Mandatory" : "Optional"}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-gray-400">TEMPLATE ID</span>
                                <div className="text-sm font-mono text-gray-600 dark:text-gray-400">{field.fieldId}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-gray-400">DEFAULT VALUE</span>
                                <div className="text-lg font-bold text-gray-900 dark:text-white">{field.defaultValue || "—"}</div>
                            </div>
                        </div>
                    </section>

                    {(field.choices && field.choices.length > 0) && (
                        <section>
                            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-gray-400">Available Options</h3>
                            <div className="flex flex-wrap gap-3">
                                {field.choices.map((c: any, i: number) => (
                                    <div key={i} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                        <div className="h-3 w-3 rounded-full bg-brand-500" />
                                        <div>
                                            <div className="font-bold text-gray-900 dark:text-white">{typeof c === "string" ? c : c.en}</div>
                                            {typeof c !== "string" && c.ar && <div className="text-xs text-gray-500" dir="rtl">{c.ar}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {(field.groupFields && field.groupFields.length > 0) && (
                        <section>
                            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-gray-400">Nested Schema</h3>
                            <div className="space-y-4">
                                {field.groupFields.map((gf: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between rounded-2xl bg-gray-50 p-5 dark:bg-gray-900/50">
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-bold text-gray-400 shadow-sm dark:bg-gray-800">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white">{typeof gf.label === "string" ? gf.label : gf.label?.en}</div>
                                                <div className="text-xs text-brand-600 font-bold uppercase tracking-widest">{gf.inputType}</div>
                                            </div>
                                        </div>
                                        {gf.isRequired && <span className="text-[10px] font-black text-error-500 uppercase tracking-tighter">Required</span>}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="rounded-3xl border border-blue-100 bg-blue-50/30 p-8 dark:border-blue-900/20 dark:bg-blue-900/10">
                        <h4 className="text-sm font-black text-blue-900 dark:text-blue-300">Quick Note</h4>
                        <p className="mt-4 text-sm leading-relaxed text-blue-700 dark:text-blue-400/80">
                            Templates are reusable across multiple job postings. Changing this template will not retroactively affect existing jobs, but will be available for all future listings.
                        </p>
                    </div>
                    
                    <div className="rounded-3xl border border-gray-100 bg-white p-8 dark:border-gray-800 dark:bg-gray-950">
                        <h4 className="text-sm font-black text-gray-900 dark:text-white">Active Usage</h4>
                        <div className="mt-6 flex items-baseline gap-2">
                            <span className="text-4xl font-black text-gray-900 dark:text-white">—</span>
                            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Jobs</span>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">Currently used in active job applications.</p>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
