"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import { formatSayi, formatKisa, formatTarih } from "@/lib/format";

// dataviz palet rolleri
export const RENK = {
  seri1: "#2a78d6", // mavi
  seri2: "#1baf7a", // aqua
  grid: "#e1e0d9",
  eksen: "#c3c2b7",
  etiket: "#898781",
};

const EKSEN_YAZI = { fill: RENK.etiket, fontSize: 11 };

function IpucuKutusu({
  baslik,
  satirlar,
}: {
  baslik: string;
  satirlar: { ad: string; deger: string; renk?: string }[];
}) {
  return (
    <div className="rounded-lg border border-hairline bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-ink">{baslik}</p>
      {satirlar.map((s) => (
        <p key={s.ad} className="flex items-center gap-1.5 text-ink-2">
          {s.renk && (
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.renk }} />
          )}
          {s.ad}: <span className="tabular font-medium text-ink">{s.deger}</span>
        </p>
      ))}
    </div>
  );
}

/** Yatay tek serili çubuk grafik (kategori adları solda) */
export function YatayBarGrafik({
  veri,
  renk = RENK.seri1,
  birim = "ton",
  etiketGenislik = 180,
}: {
  veri: { ad: string; deger: number }[];
  renk?: string;
  birim?: string;
  etiketGenislik?: number;
}) {
  const yukseklik = Math.max(veri.length * 30 + 40, 120);
  return (
    <ResponsiveContainer width="100%" height={yukseklik}>
      <BarChart data={veri} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={RENK.grid} />
        <XAxis
          type="number"
          tick={EKSEN_YAZI}
          tickLine={false}
          axisLine={{ stroke: RENK.eksen }}
          tickFormatter={(v: number) => formatKisa(v)}
        />
        <YAxis
          type="category"
          dataKey="ad"
          width={etiketGenislik}
          tick={{ ...EKSEN_YAZI, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: RENK.eksen }}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: "rgba(11,11,11,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0];
            return (
              <IpucuKutusu
                baslik={String(p.payload.ad)}
                satirlar={[{ ad: "Tonaj", deger: `${formatSayi(Number(p.value))} ${birim}`, renk }]}
              />
            );
          }}
        />
        <Bar dataKey="deger" fill={renk} barSize={14} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** İki serili dikey çubuk grafik (ör. depo bazında giriş / çıkış) */
export function GirisCikisBar({
  veri,
}: {
  veri: { ad: string; giris: number; cikis: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={veri} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke={RENK.grid} />
        <XAxis
          dataKey="ad"
          tick={{ ...EKSEN_YAZI, fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: RENK.eksen }}
          interval={0}
          angle={-38}
          textAnchor="end"
          height={90}
        />
        <YAxis
          tick={EKSEN_YAZI}
          tickLine={false}
          axisLine={{ stroke: RENK.eksen }}
          tickFormatter={(v: number) => formatKisa(v)}
        />
        <Tooltip
          cursor={{ fill: "rgba(11,11,11,0.04)" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <IpucuKutusu
                baslik={String(label)}
                satirlar={payload.map((p) => ({
                  ad: p.name === "giris" ? "Giriş" : "Çıkış",
                  deger: `${formatSayi(Number(p.value))} ton`,
                  renk: p.color,
                }))}
              />
            );
          }}
        />
        <Legend
          formatter={(v: string) => (
            <span style={{ color: "#52514e", fontSize: 12 }}>
              {v === "giris" ? "Giriş" : "Çıkış"}
            </span>
          )}
        />
        <Bar dataKey="giris" fill={RENK.seri1} barSize={10} radius={[4, 4, 0, 0]} />
        <Bar dataKey="cikis" fill={RENK.seri2} barSize={10} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Günlük sevkiyat trendi (alan grafiği) */
export function GunlukTrend({ veri }: { veri: { tarih: string; tonaj: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={veri} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="trendDolgu" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={RENK.seri1} stopOpacity={0.22} />
            <stop offset="100%" stopColor={RENK.seri1} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={RENK.grid} />
        <XAxis
          dataKey="tarih"
          tick={EKSEN_YAZI}
          tickLine={false}
          axisLine={{ stroke: RENK.eksen }}
          tickFormatter={(v: string) => formatTarih(v).slice(0, 5)}
          minTickGap={24}
        />
        <YAxis
          tick={EKSEN_YAZI}
          tickLine={false}
          axisLine={{ stroke: RENK.eksen }}
          tickFormatter={(v: number) => formatKisa(v)}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <IpucuKutusu
                baslik={formatTarih(String(label))}
                satirlar={[
                  {
                    ad: "Sevkiyat",
                    deger: `${formatSayi(Number(payload[0].value))} ton`,
                    renk: RENK.seri1,
                  },
                ]}
              />
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="tonaj"
          stroke={RENK.seri1}
          strokeWidth={2}
          fill="url(#trendDolgu)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
