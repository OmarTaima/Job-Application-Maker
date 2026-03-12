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
  const authUser = useAppSelector((s: any) => s.auth.user);

  const userCompanyIds = (() => {
    const roleName = authUser?.roleId?.name?.toLowerCase?.();
    if (roleName === "admin" || roleName === "super admin") return undefined;
    const fromCompanies = Array.isArray(authUser?.companies)
      ? authUser.companies
          .map((c: any) => (typeof c?.companyId === "string" ? c.companyId : c?.companyId?._id))
          .filter(Boolean)
      : [];
    const fromAssigned = Array.isArray(authUser?.assignedcompanyId)
      ? authUser.assignedcompanyId.filter(Boolean)
      : [];
    const merged = Array.from(new Set([...fromCompanies, ...fromAssigned]));
    return merged.length > 0 ? merged : undefined;
  })();

  const effectiveCompanyId = companyId && companyId.length > 0 ? companyId : userCompanyIds;

  return useQuery<any>({
    queryKey: [...applicantsKeys.list(effectiveCompanyId, jobPositionId as any, 'statuses')],
    queryFn: async () => {
      const res = await applicantsService.getApplicantStatuses(effectiveCompanyId, jobPositionId as any);
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
