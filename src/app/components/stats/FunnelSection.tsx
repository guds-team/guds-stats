import { ExternalLink, Info } from "lucide-react";
import { DataTable, type Column } from "./DataTable";
import { MetricCard } from "./MetricCard";
import { Panel } from "./Panel";
import { EmptyState } from "./states";
import { apiUrl } from "../../lib/api";
import type { ApiParams } from "../../lib/filters";
import { formatNumber, formatPercent } from "../../lib/format";
import { CHANNEL_LABELS, STAGE_HINTS, STAGE_LABELS } from "../../lib/metrics";
import type { Funnel, FunnelStage, Overview } from "../../lib/types";

type ChannelRow = Funnel & { channel: string; delivery_confirmation: string };

const BASIS_LABELS: Record<string, string> = {
  otp_requested: "yuborilganlardan",
  otp_accepted: "qabul qilinganlardan",
  otp_delivered: "yetkazilganlardan",
  otp_verified: "kod kiritilganlardan",
  "otp_accepted on channels with delivery reports": "hisobot beradigan kanallarda qabul qilinganlardan",
};

function stageOf(funnel: Funnel, key: FunnelStage["stage"]): FunnelStage {
  return funnel.stages.find((s) => s.stage === key)!;
}

function Stage({ stage, first, base }: { stage: FunnelStage; first: boolean; base: number | null }) {
  const share = base && stage.value !== null ? Math.min(100, (stage.value / base) * 100) : 0;
  return (
    <li className="min-w-0 flex-1 rounded-lg border bg-background p-3" title={STAGE_HINTS[stage.stage]}>
      <p className="truncate text-xs text-muted-foreground">{STAGE_LABELS[stage.stage]}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(stage.value)}</p>
      <div className="mt-2 h-1.5 rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-[var(--series-1)] transition-[width] duration-500" style={{ width: `${share}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {first ? (
          "boshlang'ich bosqich"
        ) : (
          <>
            <span className="font-medium text-foreground">{formatPercent(stage.conversion)}</span>{" "}
            {stage.basis ? BASIS_LABELS[stage.basis] ?? "" : ""}
          </>
        )}
      </p>
    </li>
  );
}

export function FunnelSection({
  data,
  params,
  dimensionFiltersActive,
}: {
  data: Overview;
  params: ApiParams;
  dimensionFiltersActive: boolean;
}) {
  const auth = data.summary.authentication;
  const notRegistered = auth.sms_delivered_not_registered;
  const empty = stageOf(auth, "otp_requested").value === 0;
  const rows: ChannelRow[] = [{ ...auth, channel: "all", delivery_confirmation: "" }, ...data.breakdowns.channel];

  const columns: Column<ChannelRow>[] = [
    {
      key: "channel",
      header: "Kanal",
      cell: (r) => (r.channel === "all" ? <strong>Barcha kanallar</strong> : CHANNEL_LABELS[r.channel] ?? r.channel),
    },
    ...auth.stages.map(({ stage: key }, i) => ({
      key,
      header: STAGE_LABELS[key],
      numeric: true,
      cell: (r: ChannelRow) => {
        const stage = stageOf(r, key);
        if (stage.comparison === "unsupported") return <span title="Kanal yetkazish hisobotini bermaydi">n/a</span>;
        return (
          <>
            {formatNumber(stage.value)}
            {i > 0 && <span className="ml-1 text-xs text-muted-foreground">({formatPercent(stage.conversion)})</span>}
          </>
        );
      },
    })),
    { key: "overall", header: "Umumiy konversiya", numeric: true, cell: (r) => formatPercent(r.overall_conversion) },
  ];

  return (
    <section aria-labelledby="funnel-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="funnel-title" className="text-base font-semibold">
            Autentifikatsiya voronkasi
          </h2>
          <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">
            Ro'yxatdan o'tish kodlari, kod yaratilgan kun bo'yicha. Har bir kod har bosqichda bir marta hisoblanadi
            (qayta yuborish va takroriy yetkazish hisobotlari ikki marta sanalmaydi).
          </p>
        </div>
        {dimensionFiltersActive && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" aria-hidden />
            Davlat, usul va ilova filtrlari voronkaga ta'sir qilmaydi
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Panel
          title="OTP → ro'yxatdan o'tish"
          description={
            empty ? undefined : (
              <>
                Umumiy konversiya (yuborilgandan ro'yxatdan o'tishgacha):{" "}
                <strong className="text-foreground">{formatPercent(auth.overall_conversion)}</strong>
              </>
            )
          }
          exportTable="authentication"
          params={params}
          chart={
            empty ? (
              <EmptyState />
            ) : (
              <ol className="flex flex-col gap-2 sm:flex-row" aria-label="Voronka bosqichlari">
                {auth.stages.map((stage, i) => (
                  <Stage key={stage.stage} stage={stage} first={i === 0} base={auth.stages[0].value} />
                ))}
              </ol>
            )
          }
          table={<DataTable caption="Kanallar bo'yicha voronka" columns={columns} rows={rows} />}
        />

        <div className="flex flex-col gap-2">
          <MetricCard
            title="SMS yetkazildi, lekin ro'yxatdan o'tilmadi"
            metric={notRegistered}
            polarity="up_is_bad"
            hint="Yetkazilgan ro'yxatdan o'tish SMS'lari, ular bilan akkaunt yaratilmagan (SMS yaratilgan kun bo'yicha)"
          />
          {notRegistered.admin_url ? (
            <a
              href={apiUrl(notRegistered.admin_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 self-start rounded text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Ro'yxatni admin panelda ochish
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">(yangi oynada)</span>
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">Ro'yxatni ko'rish uchun SMS loglarini ko'rish huquqi kerak.</p>
          )}
          {auth.accepted_without_delivery_reports > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatNumber(auth.accepted_without_delivery_reports)} ta kod yetkazish hisoboti yo'q kanal (email)
              orqali yuborilgan: shuning uchun "kod kiritildi" qabul qilinganlarga nisbatan hisoblanadi.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
