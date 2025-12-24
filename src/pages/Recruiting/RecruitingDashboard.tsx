import type { ChangeEvent, FormEvent } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import TextArea from "../../components/form/input/TextArea";
import { PlusIcon } from "../../icons";

type CompanyForm = {
  name: string;
  description: string;
  contactEmail: string;
  phone: string;
  address: string;
  website: string;
};

const defaultCompany: CompanyForm = {
  name: "",
  description: "",
  contactEmail: "",
  phone: "",
  address: "",
  website: "",
};

export default function RecruitingDashboard() {
  const navigate = useNavigate();
  const [companyForm, setCompanyForm] = useState<CompanyForm>(defaultCompany);

  const handleCompanyChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setCompanyForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCompanySubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Simulate API call that returns generated ID
    const generatedId = `COMP-${Date.now().toString().slice(-8)}`;

    // Redirect to preview page with the new company ID
    navigate(`/company/${generatedId}`);
  };

  const companyPayload = useMemo(() => companyForm, [companyForm]);

  return (
    <div className="space-y-6">
      <PageMeta
        title="Create Company | TailAdmin React"
        description="Create a new company for recruiting."
      />
      <PageBreadcrumb pageTitle="Create Company" />

      <ComponentCard
        title="Company Information"
        desc="Enter the company details to create a new recruiting company"
      >
        <form className="space-y-4" onSubmit={handleCompanySubmit}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="name">Company name</Label>
              <Input
                id="name"
                name="name"
                value={companyForm.name}
                onChange={handleCompanyChange}
                placeholder="Company name"
              />
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                value={companyForm.website}
                onChange={handleCompanyChange}
                placeholder="https://"
              />
            </div>
            <div>
              <Label htmlFor="contactEmail">Contact email</Label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                value={companyForm.contactEmail}
                onChange={handleCompanyChange}
                placeholder="contact@company.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                value={companyForm.phone}
                onChange={handleCompanyChange}
                placeholder="+1-555-0123"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <TextArea
              placeholder="What does this company do?"
              rows={3}
              value={companyForm.description}
              onChange={(value) =>
                setCompanyForm((prev) => ({ ...prev, description: value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <TextArea
              placeholder="Street, city, state"
              rows={2}
              value={companyForm.address}
              onChange={(value) =>
                setCompanyForm((prev) => ({ ...prev, address: value }))
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
            >
              <PlusIcon className="size-4" />
              Create Company
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-200">
            <div className="flex items-center justify-between gap-2 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <span>Payload preview</span>
              <span>POST /api/companies</span>
            </div>
            <pre className="overflow-x-auto text-xs leading-relaxed">
              {JSON.stringify(companyPayload, null, 2)}
            </pre>
          </div>
        </form>
      </ComponentCard>
    </div>
  );
}
