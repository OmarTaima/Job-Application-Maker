import { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  CircleCheckBig,
  Bot,
  FileSearch,
  UserRound,
  Mail,
  Filter,
  ListChecks,
  ClipboardCheck,
  FileText,
} from 'lucide-react';
import Swal from '../../../utils/swal';
import PageMeta from '../../../components/common/PageMeta';
import PageBreadCrumb from '../../../components/common/PageBreadCrumb';
import { useAuth } from '../../../context/AuthContext';
import { useLocale } from '../../../context/LocaleContext';
import {
  useCompanies,
  useUpdateCompanyAiFeatures,
} from '../../../hooks/queries/useCompanies';
import Switch from '../../../components/form/switch/Switch';
import { useCompanyFilter } from '../../../context/CompanyFilterContext';
import type { AiFeature, AiFeatureToggle } from '../../../types/companies';

type Props = {
  companyId?: string;
  onSaved?: (featureToggles: AiFeatureToggle[]) => void;
  onChange?: (featureToggles: AiFeatureToggle[]) => void;
  embedded?: boolean;
};

type CompanyShape = {
  _id: string;
  name?: string | { en?: string; ar?: string };
  settings?: {
    _id?: string;
    company?: string;
    aiSettings?: {
      featureToggles?: Partial<Record<AiFeature, boolean>>;
    };
  };
};

const ALL_FEATURES: AiFeature[] = [
  'matchScore',
  'nlFilters',
  'cvParse',
  'jobFieldGenerator',
  'candidateSummary',
  'emailDrafting',
  'interviewQuestionGen',
  'interviewScoring',
];

const TOGGLEABLE_FEATURES: AiFeature[] = [
  'matchScore',
  'nlFilters',
  'cvParse',
];

const FEATURE_ICONS: Record<AiFeature, typeof Sparkles> = {
  jobFieldGenerator: Bot,
  matchScore: FileSearch,
  candidateSummary: UserRound,
  emailDrafting: Mail,
  nlFilters: Filter,
  interviewQuestionGen: ListChecks,
  interviewScoring: ClipboardCheck,
  cvParse: FileText,
};

const normalizeFeatureToggles = (
  toggles: unknown
): AiFeatureToggle[] => {
  if (!toggles || typeof toggles !== 'object') return [];

  const fromMap = (map: Record<string, unknown>): AiFeatureToggle[] =>
    ALL_FEATURES.map((feature) => ({
      feature,
      enabled: Boolean(map[feature]),
    }));

  if (Array.isArray(toggles)) {
    const enabled = new Set<AiFeature>();
    const normalized = toggles
      .filter(
        (t): t is AiFeatureToggle =>
          !!t &&
          typeof t === 'object' &&
          ALL_FEATURES.includes((t as AiFeatureToggle).feature) &&
          typeof (t as AiFeatureToggle).enabled === 'boolean'
      )
      .map((t) => {
        enabled.add(t.feature);
        return { feature: t.feature, enabled: t.enabled };
      });

    return [
      ...ALL_FEATURES.filter((f) => !enabled.has(f)).map((f) => ({
        feature: f,
        enabled: false,
      })),
      ...normalized,
    ];
  }

  return fromMap(toggles as Record<string, unknown>);
};

const getCompanyName = (
  company: CompanyShape | undefined,
  t: (key: string, ns: string) => string,
  locale?: string
): string => {
  if (!company) return t('aiFeatures.noCompany', 'settings');
  if (typeof company.name === 'string') return company.name;
  if (locale === 'ar')
    return (
      company.name?.ar ||
      company.name?.en ||
      t('aiFeatures.unnamedCompany', 'settings')
    );
  return (
    company.name?.en ||
    company.name?.ar ||
    t('aiFeatures.unnamedCompany', 'settings')
  );
};

export default function AiFeaturesTab({
  companyId: _companyId,
  onChange,
  embedded = false,
}: Props) {
  const { hasPermission } = useAuth();
  const { t, locale } = useLocale();
  const { data: companies = [], isLoading: isCompaniesLoading } = useCompanies();

  const { selectedCompanyId } = useCompanyFilter();

  const canRead =
    hasPermission('Company Management', 'read') ||
    hasPermission('Settings Management', 'read');

  const [featureToggles, setFeatureToggles] = useState<AiFeatureToggle[]>([]);

  const effectiveCompanyId =
    selectedCompanyId ?? (companies as CompanyShape[])[0]?._id;
  const selectedCompany = useMemo(
    () =>
      (companies as CompanyShape[]).find(
        (company) => company._id === effectiveCompanyId
      ),
    [companies, effectiveCompanyId]
  );

  const updateAiFeaturesMutation = useUpdateCompanyAiFeatures();

  const derivedFeatureToggles = useMemo(
    () =>
      normalizeFeatureToggles(
        selectedCompany?.settings?.aiSettings?.featureToggles
      ),
    [selectedCompany]
  );

  const isLoading = isCompaniesLoading;

  useEffect(() => {
    setFeatureToggles(
      derivedFeatureToggles.map((f) => ({
        feature: f.feature,
        enabled: f.enabled,
      }))
    );
  }, [derivedFeatureToggles]);

  useEffect(() => {
    onChange?.(featureToggles);
  }, [onChange, featureToggles]);

  const enabledCount = featureToggles.filter((f) => f.enabled).length;

  const toggleFeature = (feature: AiFeature, enabled: boolean) => {
    if (!TOGGLEABLE_FEATURES.includes(feature)) return;

    const previous = featureToggles;
    const next = previous.map((f) =>
      f.feature === feature ? { ...f, enabled } : f
    );
    setFeatureToggles(next);

    const settingsId = selectedCompany?.settings?._id;
    if (!settingsId) {
      Swal.fire(
        t('aiFeatures.validationSelectCompany', 'settings'),
        t('aiFeatures.validationSelectCompany', 'settings'),
        'warning'
      );
      setFeatureToggles(previous);
      return;
    }

    updateAiFeaturesMutation
      .mutateAsync({ settingsId, featureToggles: next })
      .catch(() => setFeatureToggles(previous));
  };

  if (!canRead) {
    return (
      <div
        className={
          embedded ? '' : 'min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950'
        }
      >
        <div
          className={`${
            embedded ? '' : 'mx-auto max-w-lg'
          } rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900`}
        >
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <ShieldCheck className="size-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t('aiFeatures.noPermissionTitle', 'settings')}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {t('aiFeatures.noPermissionDesc', 'settings')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        embedded
          ? 'space-y-6'
          : 'min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-8'
      }
    >
      {!embedded && (
        <PageMeta
          title={t('aiFeatures.pageMetaTitle', 'settings')}
          description={t('aiFeatures.pageMetaDesc', 'settings')}
        />
      )}

      <div className={embedded ? 'space-y-6' : 'mx-auto max-w-7xl space-y-6'}>
        {!embedded && (
          <PageBreadCrumb pageTitle={t('aiFeatures.pageBreadcrumb', 'settings')} />
        )}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-5 border-b border-slate-200 px-6 py-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Sparkles className="size-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600/80 dark:text-violet-300">
                  {t('aiFeatures.sectionSubtitle', 'settings')}
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                  {t('aiFeatures.title', 'settings')}
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t('aiFeatures.description', 'settings')}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {t('aiFeatures.statCompany', 'settings')}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {getCompanyName(selectedCompany, t, locale)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {t('aiFeatures.statEnabled', 'settings')}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {enabledCount} / {featureToggles.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {t('aiFeatures.statSaveStatus', 'settings')}
              </p>
              <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                <CircleCheckBig className="size-4" /> {t('aiFeatures.statReady', 'settings')}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-12">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-6 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <Sparkles className="size-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">
                      {t('aiFeatures.featuresTitle', 'settings')}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {t('aiFeatures.featuresDesc', 'settings')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-6">
                {isLoading && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                    {t('aiFeatures.loading', 'settings')}
                  </div>
                )}

                {!isLoading &&
                  featureToggles.map((item) => {
                    const Icon = FEATURE_ICONS[item.feature];
                    return (
                      <div
                        key={item.feature}
                        className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 transition-all duration-200 hover:border-violet-200 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-violet-700 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                              item.enabled
                                ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
                                : 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                            }`}
                          >
                            <Icon className="size-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {t(`aiFeatures.${item.feature}.title`, 'settings')}
                            </p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              {t(`aiFeatures.${item.feature}.desc`, 'settings')}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <Switch
                            label=""
                            checked={item.enabled}
                            disabled={!TOGGLEABLE_FEATURES.includes(item.feature)}
                            onChange={(checked) =>
                              toggleFeature(item.feature, checked)
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}