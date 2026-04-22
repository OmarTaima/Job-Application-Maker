import PageMeta from '../../../components/common/PageMeta';

import { Applicants } from './Applicants';

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
      <PageMeta title="Interview Applicants" description="View and manage applicants in interview stages" />
      <div className="grid gap-6">
          <Applicants
            layoutKey="interview_applicants_table"
            onlyStatus={interviewStatuses}
            companyIdOverride={companyId}
          />
      </div>
    </>
  );
}