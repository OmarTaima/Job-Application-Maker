import PageMeta from '../../../../components/common/PageMeta';

import  Applicants  from './Applicants';

interface InterviewApplicantsProps {
  companyId?: string;
  jobId?: string;
}

export default function InterviewApplicants({ companyId }: InterviewApplicantsProps) {
  const rejectedStatuses = [
    'rejected'
  ];

  return (
    <>
      <PageMeta title="Rejected Applicants" description="View and manage rejected applicants" />
      <div className="grid gap-6">
          <Applicants
            layoutKey="rejected_applicants_table"
            onlyStatus={rejectedStatuses}
            companyIdOverride={companyId}
          />
      </div>
    </>
  );
}