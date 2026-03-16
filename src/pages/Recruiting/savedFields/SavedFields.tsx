import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { useSavedFields, useDeleteSavedField } from "../../../hooks/queries";
import Swal from "sweetalert2";
import { PencilIcon, TrashBinIcon, PlusIcon } from "../../../icons";
import { useQueryClient } from "@tanstack/react-query";
import { savedFieldsKeys } from "../../../hooks/queries/useSavedFields";

export default function SavedFields() {
  const navigate = useNavigate();
  const { data, isLoading } = useSavedFields();
  const deleteMutation = useDeleteSavedField();
  const qc = useQueryClient();
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});

  const fields = useMemo(() => data || [], [data]);

  const handleEdit = (field: any) => {
    navigate(`/recruiting/saved-fields/create`, { state: { field } });
  };

  const handleDelete = async (fieldId: string) => {
    const result = await Swal.fire({
      title: "Delete Saved Field?",
      text: "This action is permanent and cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EF4444",
      cancelButtonColor: "#6B7280",
      confirmButtonText: "Delete Template",
      customClass: {
        popup: "rounded-3xl border-none",
        confirmButton: "rounded-xl px-6 py-2.5 font-bold",
        cancelButton: "rounded-xl px-6 py-2.5 font-bold",
      }
    });
    if (!result.isConfirmed) return;

    setDeletingIds((s) => ({ ...s, [fieldId]: true }));
    deleteMutation.mutate(fieldId, {
      onError: (err, id) => {
        Swal.fire({ title: "Error", text: String((err as any)?.message || err), icon: "error" });
        setDeletingIds((s) => { const copy = { ...s }; delete copy[id as string]; return copy; });
      },
      onSettled: () => {
        qc.invalidateQueries({ queryKey: savedFieldsKeys.lists() });
        setDeletingIds((s) => { const copy = { ...s }; delete copy[fieldId]; return copy; });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen space-y-6 pb-20">
        <PageMeta title="Saved Fields" description="Loading field templates..." />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <PageBreadcrumb pageTitle="Saved Fields" />
        </div>
        <div className="flex flex-col items-center justify-center py-20">
          <LoadingSpinner fullPage message="Locating your field templates..." />
        </div>
      </div>
    );
  }

  const activeFields = fields.filter((f: any) => !deletingIds[f.fieldId]);

  return (
    <div className="mx-auto max-w-[1200px] space-y-8 pb-20">
      <PageMeta title="Saved Fields" description="Manage your reusable field templates" />
      
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageBreadcrumb pageTitle="Saved Fields" />
        <button
          onClick={() => navigate(`/recruiting/saved-fields/create`)}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand-500 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-brand-500/25 transition-all hover:bg-brand-600 hover:shadow-brand-500/40 active:scale-95"
        >
          <PlusIcon className="size-5" />
          Create New Template
        </button>
      </div>

      <div className="relative overflow-hidden rounded-[2.5rem] border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-950">
        <div className="p-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Field Repository</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Total of {activeFields.length} reusable field templates found</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center dark:bg-brand-500/10">
                    <svg className="size-6 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                </div>
            </div>

            {activeFields.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-100 py-20 dark:border-gray-800">
                <div className="rounded-full bg-gray-50 p-6 dark:bg-gray-900">
                    <svg className="size-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                </div>
                <h4 className="mt-6 text-lg font-bold text-gray-900 dark:text-white">Empty Repository</h4>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-xs text-center">Start by creating your first reusable field template for job applications.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {activeFields.map((f: any) => (
                    <div 
                        key={f.fieldId}
                        className="group relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:border-brand-200 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900/50"
                    >
                        <div className="flex items-start justify-between">
                            <div className="space-y-3 flex-1 overflow-hidden">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl bg-gray-50 p-2 dark:bg-gray-800">
                                        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                                            {f.inputType === "repeatable_group" ? "GRP" : f.inputType.substring(0, 3)}
                                        </span>
                                    </div>
                                    {f.isRequired && (
                                        <span className="rounded-full bg-error-50 px-2 py-0.5 text-[10px] font-bold text-error-600 dark:bg-error-500/10 dark:text-error-400 uppercase">Required</span>
                                    )}
                                </div>
                                
                                <div>
                                    <h4 className="truncate text-lg font-bold text-gray-900 dark:text-white group-hover:text-brand-600 transition-colors">
                                        {typeof f.label === "string" ? f.label : (f.label?.en || "Untitled Field")}
                                    </h4>
                                    {typeof f.label !== "string" && f.label?.ar && (
                                        <p className="mt-1 truncate text-sm text-gray-400 font-medium" dir="rtl">{f.label.ar}</p>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <div className="rounded-xl bg-blue-50/50 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                                        Type: {f.inputType.replace("_", " ")}
                                    </div>
                                    {(f.choices || []).length > 0 && (
                                        <div className="rounded-xl bg-amber-50/50 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                                            {f.choices.length} Options
                                        </div>
                                    )}
                                    {(f.groupFields || []).length > 0 && (
                                        <div className="rounded-xl bg-purple-50/50 px-3 py-1.5 text-xs font-semibold text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
                                            {f.groupFields.length} Nested Fields
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={() => handleEdit(f)}
                                    className="rounded-xl p-2.5 text-gray-400 bg-gray-50 hover:bg-brand-50 hover:text-brand-600 transition-all dark:bg-gray-800 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
                                    title="Edit Template"
                                >
                                    <PencilIcon className="size-5" />
                                </button>
                                <button 
                                    onClick={() => handleDelete(f.fieldId)}
                                    className="rounded-xl p-2.5 text-gray-400 bg-gray-50 hover:bg-error-50 hover:text-error-600 transition-all dark:bg-gray-800 dark:hover:bg-error-500/10 dark:hover:text-error-400"
                                    title="Delete Template"
                                >
                                    <TrashBinIcon className="size-5" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="absolute bottom-0 left-0 h-1 w-0 bg-brand-500 transition-all group-hover:w-full" />
                    </div>
                ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
