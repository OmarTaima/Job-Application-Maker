import { useQuery } from "@tanstack/react-query";
import { applicantsService } from "../../services/applicantsService";
import { useAppSelector } from "../../store/hooks";
import { applicantsKeys } from "./useApplicants";
import type { Applicant } from "../../services/applicantsService";

type MinimalApplicant = {
  _id: string;
  status: Applicant['status'];
  submittedAt?: string;
  createdAt?: string;
};

export function getApplicantStatuses(
  companyId?: string[],
  jobPositionId?: string
) {
  const reduxApplicants = useAppSelector((s) => s.applicants.applicants);

  return useQuery<any>({
    queryKey: [...applicantsKeys.list(companyId, jobPositionId as any, 'statuses')],
    queryFn: async () => {
      const res = await applicantsService.getApplicantStatuses(companyId, jobPositionId as any);
      // Server may return either an array of minimal applicants OR an object with counts.
      if (Array.isArray(res)) {
        return res.map((a) => ({ _id: a._id, status: a.status, submittedAt: a.submittedAt, createdAt: a.createdAt } as MinimalApplicant));
      }
      return res;
    },
    staleTime: 2 * 60 * 1000,
    initialData: reduxApplicants && reduxApplicants.length > 0 ? reduxApplicants.map((a: any) => ({ _id: a._id, status: a.status, submittedAt: a.submittedAt, createdAt: a.createdAt })) : undefined,
  });
}
