// InterviewApplicants.tsx
import PageMeta from '../../../../components/common/PageMeta';
import PageBreadcrumb from '../../../../components/common/PageBreadCrumb';
import ComponentCard from '../../../../components/common/ComponentCard';
import  Applicants  from './Applicants';

interface InterviewApplicantsProps {
  companyId?: string;
  jobId?: string;
}

export default function InterviewApplicants({ companyId }: InterviewApplicantsProps) {
  const interviewStatuses = [
    'interview',
    'interviewed'
  ];

  return (
    <>
      <PageMeta 
        title="Interview Applicants" 
        description="View and manage applicants in interview stages" 
      />
      <PageBreadcrumb 
        pageTitle="Interview Applicants" 
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              Showing applicants with status: Interview & Interviewed
            </span>
          </div>
        }
      />
      <div className="grid gap-6">
        <ComponentCard 
          title="Interview Stage Applicants" 
          desc="Applicants currently in interview process"
        >
          <Applicants
            layoutKey="interview_applicants_table"
            onlyStatus={interviewStatuses}
            companyIdOverride={companyId}
          />
        </ComponentCard>
      </div>
    </>
  );
}