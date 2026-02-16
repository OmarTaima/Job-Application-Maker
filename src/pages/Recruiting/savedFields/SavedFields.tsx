import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import ComponentCard from "../../../components/common/ComponentCard";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { useSavedFields, useDeleteSavedField } from "../../../hooks/queries";
import Swal from "sweetalert2";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../../components/ui/table";
import { PencilIcon, TrashBinIcon } from "../../../icons";
import { useQueryClient } from "@tanstack/react-query";
import { savedFieldsKeys } from "../../../hooks/queries/useSavedFields";

export default function SavedFields() {
  const navigate = useNavigate();
  const { data, isLoading } = useSavedFields();
  const deleteMutation = useDeleteSavedField();
  const qc = useQueryClient();
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});

  const fields = useMemo(() => data || [], [data]);

  const convertToString = (value: any): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
      if (value.en) return value.en;
      return Object.keys(value)
        .filter((key) => !isNaN(Number(key)) && key !== '_id')
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => value[key])
        .join('');
    }
    return '';
  };

  const convertChoicesArray = (choices: any): string[] => {
    if (!Array.isArray(choices)) return [];
    return choices.map((choice: any) => {
      if (typeof choice === 'object' && choice !== null && choice.en) return choice.en;
      return convertToString(choice);
    });
  };

  

  

  const handleEdit = (field: any) => {
    navigate(`/recruiting/saved-fields/create`, { state: { field } });
  };

  const handleDelete = async (fieldId: string) => {
    const result = await Swal.fire({
      title: "Delete Saved Field?",
      text: "This action is permanent.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
    });
    if (!result.isConfirmed) return;

    // Use mutation lifecycle for optimistic update
    const successToast = Swal.fire({ title: "Deleted", icon: "success", timer: 1200, showConfirmButton: false });

    // mark as deleting locally so UI hides row instantly
    setDeletingIds((s) => ({ ...s, [fieldId]: true }));

    deleteMutation.mutate(fieldId, {
      onError: (err, id) => {
        // rollback
        Swal.fire({ title: "Error", text: String((err as any)?.message || err), icon: "error" });
        // unmark deleting so it re-appears
        setDeletingIds((s) => { const copy = { ...s }; delete copy[id as string]; return copy; });
      },
      onSettled: () => {
        qc.invalidateQueries({ queryKey: savedFieldsKeys.lists() });
        // clear deleting flag after settled
        setDeletingIds((s) => { const copy = { ...s }; delete copy[fieldId]; return copy; });
      },
    });

    // show the success toast without waiting for network
    await successToast;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageMeta title="Saved Fields" description="Loading saved fields" />
        <PageBreadcrumb pageTitle="Saved Fields" />
        <LoadingSpinner fullPage message="Loading saved fields..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageMeta title="Saved Fields" description="Manage your saved field templates" />
      <PageBreadcrumb pageTitle="Saved Fields" />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Saved Fields</h1>
        <button
          onClick={() => navigate(`/recruiting/saved-fields/create`)}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Create Saved Field
        </button>
      </div>

      <ComponentCard title="Your Saved Fields" desc="Reusable field templates">
        {fields.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">No saved fields yet.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Label</TableCell>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Type</TableCell>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Required</TableCell>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Options</TableCell>
                    <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Actions</TableCell>
                  </TableRow>
                </TableHeader>

                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {fields.filter((f: any) => !deletingIds[f.fieldId]).map((f: any) => (
                    <TableRow key={f.fieldId} className="cursor-default hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                      <TableCell className="px-5 py-4 text-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-400">en</span>
                            <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90">{typeof f.label === 'string' ? f.label : f.label?.en}</span>
                          </div>
                          {typeof f.label !== 'string' && f.label?.ar && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-400">ar</span>
                              <span className="text-xs text-gray-500">{f.label.ar}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start">
                        <span className="text-sm text-gray-700 dark:text-gray-200">{f.inputType}</span>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start">
                        <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-400/40">{f.isRequired ? 'Yes' : 'No'}</span>
                      </TableCell>

                      <TableCell className="px-5 py-4 text-start max-w-[280px] align-middle">
                        {(() => {
                          const choices = f.choices || (f as any).options || [];
                          const enArr = convertChoicesArray(choices);
                          return enArr && enArr.length > 0 ? (
                            <span
                              className="text-sm text-gray-600 dark:text-gray-400 overflow-hidden whitespace-nowrap truncate block"
                              title={enArr.join(", ")}
                            >
                              {enArr.slice(0, 3).join(", ")}{enArr.length > 3 ? "..." : ""}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          );
                        })()}
                      </TableCell>

                      <TableCell className="px-5 py-4 text-start">
                        <div className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => handleEdit(f)} className="rounded p-1.5 text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10" title="Edit">
                            <PencilIcon className="size-4" />
                          </button>
                          <button onClick={() => handleDelete(f.fieldId)} className="rounded p-1.5 text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10" title="Delete">
                            <TrashBinIcon className="size-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </ComponentCard>
    </div>
  );
}
