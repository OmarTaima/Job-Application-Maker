import { Suspense, lazy, useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { useRejectionInsights } from "../../hooks/queries/useApplicants";

const Chart = lazy(() => import("react-apexcharts"));

type RejectionInsightsChartProps = {
  companyId?: string[];
};

function formatReason(reason: string): string {
  const normalized = reason.trim();
  return normalized.length > 34 ? `${normalized.slice(0, 31)}...` : normalized;
}

export default function RejectionInsightsChart({ companyId }: RejectionInsightsChartProps) {
  const { data, isLoading, isFetching } = useRejectionInsights({ companyId });

  const rows = useMemo(() => {
    const items = Array.isArray(data) ? data : (data as any)?.data ?? [];
    const normalizedReason = (reason: string) => reason.replace(/\s+/g, ' ').trim();

    const sorted = [...items]
      .map((item) => ({
        reason: normalizedReason(String(item.reason ?? "Unknown")) || "Unknown",
        count: Number(item.count ?? 0),
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);

    return sorted;
  }, [data]);

  const totalRejected = useMemo(
    () => rows.reduce((sum, item) => sum + item.count, 0),
    [rows]
  );

  const topReason = rows[0];
  const topReasonShare = totalRejected > 0 && topReason ? Math.round((topReason.count / totalRejected) * 100) : 0;

  const chartHeight = Math.max(330, rows.length * 50);

  const options: ApexOptions = {
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      height: chartHeight,
      toolbar: { show: false },
      animations: {
        enabled: true,
        speed: 650,
      },
    },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: "58%",
        borderRadius: 8,
        borderRadiusApplication: "end",
      },
    },
    colors: ["#e42e2b"],
    dataLabels: {
      enabled: false,
    },
    grid: {
      borderColor: "#E5E7EB",
      strokeDashArray: 4,
      xaxis: {
        lines: { show: true },
      },
      yaxis: {
        lines: { show: false },
      },
    },
    xaxis: {
      categories: rows.map((item) => formatReason(item.reason)),
      labels: {
        style: {
          fontSize: "12px",
          colors: ["#e42e2b"],
        },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: {
          fontSize: "12px",
          colors: ["#e42e2b"],
        },
      },
    },
    tooltip: {
      theme: "light",
      y: {
        formatter: (val: number) => `${val} rejected applicant${val === 1 ? "" : "s"}`,
      },
    },
    stroke: {
      width: 0,
    },
    fill: {
      opacity: 1,
    },
    legend: {
      show: false,
    },
  };

  const series = [
    {
      name: "Rejected applicants",
      data: rows.map((item) => item.count),
    },
  ];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Rejection Reasons
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Shows how rejected applicants are distributed across reasons so you can spot the biggest friction points.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/70">
            <div className="text-xs uppercase tracking-wide text-gray-400">Total rejected</div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white/90">
              {isLoading ? '—' : totalRejected}
            </div>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-500/30 dark:bg-brand-500/10">
            <div className="text-xs uppercase tracking-wide text-brand-500/80 dark:text-brand-300">Top reason share</div>
            <div className="mt-1 text-2xl font-bold text-brand-600 dark:text-brand-300">
              {isLoading ? '—' : `${topReasonShare}%`}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[220px_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 via-white to-brand-50/50 p-5 dark:border-gray-800 dark:from-gray-900 dark:via-gray-900 dark:to-brand-500/10">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Main driver</div>
          <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white/90">
            {isLoading ? 'Loading...' : topReason?.reason ?? 'No data yet'}
          </div>
          <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {isLoading
              ? 'Waiting for rejected applicant insights.'
              : topReason
                ? `${topReason.count} rejection${topReason.count === 1 ? '' : 's'} recorded under this reason.`
                : 'No rejection data available for the current company scope.'}
          </div>

          <div className="mt-5 max-h-96 space-y-2 overflow-y-auto">
            {rows.slice(0, 5).map((item, index) => {
              const share = totalRejected > 0 ? Math.round((item.count / totalRejected) * 100) : 0;
              return (
                <div key={item.reason} className="rounded-xl bg-white/80 p-3 shadow-sm dark:bg-gray-900/70">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-gray-700 dark:text-gray-300">
                      {index + 1}. {formatReason(item.reason)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">{share}%</span>
                  </div>
                </div>
              );
            })}
            {rows.length > 5 && (
              <div className="rounded-xl bg-gray-100/50 p-3 text-center dark:bg-gray-800/50">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  +{rows.length - 5} more reason{rows.length - 5 !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="min-h-[330px] rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/50 sm:p-4">
          {isLoading ? (
            <div className="flex h-[310px] items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-800/60">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
            </div>
          ) : rows.length > 0 ? (
            <div className={`${isFetching ? 'opacity-70' : ''} transition-opacity`}>
              <Suspense fallback={<div style={{ height: `${chartHeight}px` }} className="rounded-xl bg-gray-50 dark:bg-gray-800/60" />}>
                <Chart options={options} series={series} type="bar" height={chartHeight} />
              </Suspense>
            </div>
          ) : (
            <div className="flex h-[310px] flex-col items-center justify-center rounded-xl bg-gray-50 text-center dark:bg-gray-800/60">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">No rejection insights yet</div>
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Once applicants are rejected with reasons, the chart will appear here.
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}