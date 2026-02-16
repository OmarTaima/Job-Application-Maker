import { useLocation, useNavigate, useParams } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import ComponentCard from "../../../components/common/ComponentCard";
import { useSavedFields } from "../../../hooks/queries";

export default function SavedFieldsPreview() {
  const { state } = useLocation();
  const { fieldId } = useParams<{ fieldId: string }>();
  const navigate = useNavigate();
  const { data } = useSavedFields();

  const field = state?.field || (data || []).find((f: any) => f.fieldId === decodeURIComponent(fieldId || ""));

  if (!field) {
    return (
      <div className="space-y-6">
        <PageMeta title="Saved Field Not Found" description="No saved field found" />
        <PageBreadcrumb pageTitle="Saved Field Preview" />
        <div className="p-6 text-center">Saved field not found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageMeta title={`${field.label} | Saved Field Preview`} description={`Preview for ${field.label}`} />
      <PageBreadcrumb pageTitle="Saved Field Preview" />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{typeof field.label === 'string' ? field.label : field.label?.en}</h1>
        <div>
          <button onClick={() => navigate(-1)} className="rounded-lg bg-gray-200 px-3 py-1 text-sm">Back</button>
        </div>
      </div>

      <ComponentCard title="Field Details">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-600">Field ID</label>
            <div className="mt-1 text-sm text-gray-900">{field.fieldId}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Input Type</label>
            <div className="mt-1 text-sm text-gray-900">{field.inputType}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Default Value</label>
              <div className="mt-1 text-sm text-gray-900">{field.defaultValue ?? "-"}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Required</label>
              <div className="mt-1 text-sm text-gray-900">{field.isRequired ? "Yes" : "No"}</div>
          </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-600">Choices</label>
              <div className="mt-1 text-sm text-gray-900">
                {(field.choices || []).length === 0 ? "-" : (
                  (field.choices || []).map((c: any) => (
                    <div key={c.en || c} className="pb-1">
                      <div className="font-medium">{typeof c === 'string' ? c : c.en}</div>
                      {typeof c !== 'string' && c.ar && <div className="text-xs text-gray-500">{c.ar}</div>}
                    </div>
                  ))
                )}
              </div>
            </div>
        </div>
      </ComponentCard>
    </div>
  );
}
