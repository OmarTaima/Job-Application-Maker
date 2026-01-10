/**
 * Example: Using useCompaniesWithApplicants Hook
 * 
 * This example demonstrates how to fetch only companies that have applicants,
 * which optimizes data fetching and reduces unnecessary API calls.
 */

import { useState, useMemo } from "react";
import { useApplicants, useCompaniesWithApplicants } from "../hooks/queries";
import type { Applicant } from "../store/slices/applicantsSlice";
import type { Company } from "../services/companiesService";

/**
 * Example 1: Applicants List with Company Filter
 * 
 * This component shows applicants and allows filtering by company.
 * Only companies that have applicants are fetched and shown in the filter.
 */
export const ApplicantsWithCompanyFilter = () => {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");
  
  // Fetch all applicants
  const { data: applicants = [], isLoading: applicantsLoading } = useApplicants();
  
  // Fetch ONLY companies that have applicants
  const { data: companies = [], isLoading: companiesLoading } = useCompaniesWithApplicants(applicants);
  
  const filteredApplicants = useMemo(() => {
    if (selectedCompanyId === "all") return applicants;
    return applicants.filter((applicant: Applicant) => {
      const companyId = typeof applicant.companyId === "string" 
        ? applicant.companyId 
        : (applicant.companyId as any)?._id;
      return companyId === selectedCompanyId;
    });
  }, [applicants, selectedCompanyId]);

  if (applicantsLoading || companiesLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h2>Applicants by Company</h2>
      
      {/* Company Filter - Only shows companies with applicants */}
      <select 
        value={selectedCompanyId} 
        onChange={(e) => setSelectedCompanyId(e.target.value)}
      >
        <option value="all">All Companies ({companies.length})</option>
        {companies.map((company: Company) => (
          <option key={company._id} value={company._id}>
            {company.name}
          </option>
        ))}
      </select>

      {/* Applicants List */}
      <div>
        <p>Showing {filteredApplicants.length} applicants</p>
        {filteredApplicants.map((applicant: Applicant) => (
          <div key={applicant._id}>
            {applicant.fullName} - {applicant.email}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Example 2: Applicants Grouped by Company
 * 
 * This component groups applicants by their company.
 * Only companies with applicants are fetched.
 */
export const ApplicantsByCompany = () => {
  // Fetch all applicants
  const { data: applicants = [], isLoading: applicantsLoading } = useApplicants();
  
  // Fetch ONLY companies that have applicants
  const { data: companies = [], isLoading: companiesLoading } = useCompaniesWithApplicants(applicants);
  
  // Group applicants by company
  const applicantsByCompany = useMemo(() => {
    const grouped: Record<string, { company: Company; applicants: Applicant[] }> = {};
    
    companies.forEach((company: Company) => {
      grouped[company._id] = {
        company,
        applicants: applicants.filter((applicant: Applicant) => {
          const companyId = typeof applicant.companyId === "string" 
            ? applicant.companyId 
            : (applicant.companyId as any)?._id;
          return companyId === company._id;
        }),
      };
    });
    
    return Object.values(grouped);
  }, [applicants, companies]);

  if (applicantsLoading || companiesLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h2>Applicants Grouped by Company</h2>
      {applicantsByCompany.map(({ company, applicants }) => (
        <div key={company._id}>
          <h3>{company.name}</h3>
          <p>{applicants.length} applicant(s)</p>
          <ul>
            {applicants.map((applicant) => (
              <li key={applicant._id}>
                {applicant.fullName} - {applicant.status}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

/**
 * Example 3: Statistics Dashboard
 * 
 * Shows statistics for companies that have applicants.
 */
export const CompanyApplicantStats = () => {
  const { data: applicants = [] } = useApplicants();
  const { data: companies = [] } = useCompaniesWithApplicants(applicants);
  
  const stats = useMemo(() => {
    return companies.map((company: Company) => {
      const companyApplicants = applicants.filter((applicant: Applicant) => {
        const companyId = typeof applicant.companyId === "string" 
          ? applicant.companyId 
          : (applicant.companyId as any)?._id;
        return companyId === company._id;
      });
      
      return {
        companyName: company.name,
        totalApplicants: companyApplicants.length,
        pending: companyApplicants.filter((a: Applicant) => a.status === "applied").length,
        interviewed: companyApplicants.filter((a: Applicant) => a.status === "interviewed").length,
        accepted: companyApplicants.filter((a: Applicant) => a.status === "accepted").length,
        rejected: companyApplicants.filter((a: Applicant) => a.status === "rejected").length,
      };
    });
  }, [applicants, companies]);

  return (
    <div>
      <h2>Company Statistics (Only Companies with Applicants)</h2>
      <table>
        <thead>
          <tr>
            <th>Company</th>
            <th>Total</th>
            <th>Pending</th>
            <th>Interviewed</th>
            <th>Accepted</th>
            <th>Rejected</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((stat: any) => (
            <tr key={stat.companyName}>
              <td>{stat.companyName}</td>
              <td>{stat.totalApplicants}</td>
              <td>{stat.pending}</td>
              <td>{stat.interviewed}</td>
              <td>{stat.accepted}</td>
              <td>{stat.rejected}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * COMPARISON: Before vs After
 * 
 * BEFORE (fetching all companies):
 * - If you have 100 companies but only 10 have applicants
 * - You still fetch all 100 companies
 * - Waste of bandwidth and processing
 * 
 * AFTER (using useCompaniesWithApplicants):
 * - If you have 100 companies but only 10 have applicants
 * - You only fetch those 10 companies
 * - More efficient and faster
 * 
 * Performance Impact:
 * - Reduced data transfer
 * - Faster page loads
 * - Less memory usage
 * - Better user experience
 */
