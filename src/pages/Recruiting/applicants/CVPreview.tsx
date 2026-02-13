import { useLocation, useNavigate, useParams } from 'react-router';
import PageBreadcrumb from '../../../components/common/PageBreadCrumb';
import PageMeta from '../../../components/common/PageMeta';
import ComponentCard from '../../../components/common/ComponentCard';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import { useMemo, useState, useEffect } from 'react';
import { useApplicant } from '../../../hooks/queries';

export default function CVPreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const cvUrlFromState = (location.state as any)?.cvUrl as string | undefined;

  const { data: fetchedApplicant, isLoading } = useApplicant(id || '');
  const applicant = fetchedApplicant;

  const src = useMemo(() => {
    const path = cvUrlFromState || (applicant as any)?.cvFilePath;
    if (!path) return null;
    if (typeof path !== 'string') return null;
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    const base = (import.meta.env.VITE_API_BASE_URL as string) || window.location.origin || '';
    if (!base) return path;
    return `${base.replace(/\/$/, '')}/${path.replace(/^\/+/, '')}`;
  }, [cvUrlFromState, applicant]);

  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);

  // If iframe doesn't fire onLoad within timeout, mark as failed (likely X-Frame-Options or CSP)
  useEffect(() => {
    setIframeLoaded(false);
    setIframeFailed(false);
    if (!src) return;
    const t = setTimeout(() => {
      if (!iframeLoaded) setIframeFailed(true);
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Debug: expose resolved src to console to help diagnose empty iframe
  // (servers may set X-Frame-Options; if so iframe will remain empty)
  // eslint-disable-next-line no-console
  console.debug('CVPreview resolved src:', { id, src, cvUrlFromState, applicantCv: (applicant as any)?.cvFilePath });

  return (
    <div className="space-y-6">
      <PageMeta title={`CV Preview${id ? ` | ${id}` : ''}`} description="Preview applicant CV" />
      <PageBreadcrumb pageTitle="CV Preview" />

      <ComponentCard title="CV Preview">
        {!src ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No CV URL provided.</p>
            <div className="mt-4">
              <button
                onClick={() => navigate(-1)}
                className="px-4 py-2 bg-brand-500 text-white rounded-lg"
              >
                Back
              </button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="w-full h-[80vh] relative">
            {/* Render the CV inside an iframe for preview. Do not provide a direct download button here. */}
            <iframe
              src={src}
              title="CV Preview"
              className="w-full h-full border rounded"
              sandbox="allow-forms allow-scripts allow-same-origin"
              onLoad={() => {
                setIframeLoaded(true);
                setIframeFailed(false);
              }}
              onError={() => setIframeFailed(true)}
            />

            {iframeFailed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 p-6">
                <p className="text-gray-700 mb-4">Unable to embed CV — the file cannot be displayed here (likely blocked by the file host).</p>
                <div className="flex gap-2">
                  <a
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-brand-500 text-white rounded-lg"
                  >
                    Open in new tab
                  </a>
                  <button onClick={() => navigate(-1)} className="px-4 py-2 border rounded-lg">Back</button>
                </div>
              </div>
            )}
          </div>
        )}
      </ComponentCard>
    </div>
  );
}
