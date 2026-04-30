import { useParams, useSearchParams } from 'react-router';
import ApplicantPageView from './ApplicantPageView';

export default function ApplicantDynamicPage() {
  const { pageName } = useParams();
  const [searchParams] = useSearchParams();

  const statuses =
    searchParams
      .get('statuses')
      ?.split(',')
      .map(decodeURIComponent)
      .filter(Boolean) ?? [];

  const decoded = decodeURIComponent(pageName ?? '');

  return (
    <ApplicantPageView
      title={decoded}
      statuses={statuses}
      layoutKey={`applicant_page_${pageName}`}
    />
  );
}
