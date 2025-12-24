import { useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ComponentCard from "../../components/common/ComponentCard";
import { Link, useNavigate } from "react-router";
import { PlusIcon } from "../../icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { useAuth } from "../../context/AuthContext";

type Company = {
  id: string;
  name: string;
  description: string;
  contactEmail: string;
  phone: string;
  address: string;
  website: string;
  departmentCount: number;
  createdAt: string;
};

// Mock data - replace with API call
const mockCompanies: Company[] = [
  {
    id: "COMP-12345678",
    name: "Tech Solutions Inc.",
    description: "A technology solutions company",
    contactEmail: "contact@techsolutions.com",
    phone: "+1-555-0123",
    address: "123 Tech Street, Silicon Valley, CA",
    website: "https://techsolutions.com",
    departmentCount: 3,
    createdAt: "2025-12-20",
  },
  {
    id: "COMP-87654321",
    name: "Innovation Labs",
    description: "Research and development company",
    contactEmail: "info@innovationlabs.com",
    phone: "+1-555-0456",
    address: "456 Innovation Ave, San Francisco, CA",
    website: "https://innovationlabs.com",
    departmentCount: 5,
    createdAt: "2025-12-18",
  },
  {
    id: "COMP-11223344",
    name: "Digital Ventures",
    description: "Digital transformation consulting",
    contactEmail: "hello@digitalventures.com",
    phone: "+1-555-0789",
    address: "789 Digital Blvd, Austin, TX",
    website: "https://digitalventures.com",
    departmentCount: 2,
    createdAt: "2025-12-15",
  },
];

export default function Companies() {
  const navigate = useNavigate();
  const { user, canAccessCompany } = useAuth();

  // Filter companies based on user access
  const allCompanies = mockCompanies.filter((company) =>
    user?.role === "admin" ? true : canAccessCompany(company.id)
  );

  const [companies] = useState<Company[]>(allCompanies);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCompanies = companies.filter(
    (company) =>
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.contactEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRowClick = (companyId: string) => {
    navigate(`/company/${companyId}`);
  };

  return (
    <div className="space-y-6">
      <PageMeta
        title="Companies | TailAdmin React"
        description="View and manage all recruiting companies in the system."
      />
      <PageBreadcrumb pageTitle="Companies" />

      <ComponentCard
        title="All Companies"
        desc="Browse and manage companies registered for recruiting"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 w-full max-w-md rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
              />
            </div>
            <Link
              to="/recruiting"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
            >
              <PlusIcon className="size-4" />
              Create Company
            </Link>
          </div>

          {filteredCompanies.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-12 dark:border-gray-700">
              <svg
                className="mb-4 size-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                No companies found
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {searchTerm
                  ? "Try adjusting your search"
                  : "Get started by creating a new company"}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                    <TableRow>
                      <TableCell
                        isHeader
                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                      >
                        Company Name
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                      >
                        Company ID
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                      >
                        Contact
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                      >
                        Departments
                      </TableCell>
                      <TableCell
                        isHeader
                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                      >
                        Created
                      </TableCell>
                    </TableRow>
                  </TableHeader>

                  <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {filteredCompanies.map((company) => (
                      <TableRow
                        key={company.id}
                        onClick={() => handleRowClick(company.id)}
                        className="cursor-pointer transition hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                      >
                        <TableCell className="px-5 py-4 text-start">
                          <div>
                            <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90">
                              {company.name}
                            </span>
                            <span className="block text-gray-500 text-theme-xs dark:text-gray-400">
                              {company.description}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                            {company.id}
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <div>
                            <span className="block text-sm text-gray-800 dark:text-gray-200">
                              {company.contactEmail}
                            </span>
                            <span className="block text-xs text-gray-500 dark:text-gray-400">
                              {company.phone}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-400/40">
                            {company.departmentCount}
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                          {new Date(company.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </ComponentCard>
    </div>
  );
}
