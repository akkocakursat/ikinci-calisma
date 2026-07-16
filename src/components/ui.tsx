"use client";

import { X } from "lucide-react";
import { ROL_ETIKETLERI, type Rol } from "@/lib/types";

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-hairline bg-surface p-5 shadow-kart ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-kart">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand-dark">
            {icon}
          </span>
        )}
      </div>
      <p className="font-baslik mt-2.5 text-[27px] font-bold leading-none text-ink">{value}</p>
      {sub && <p className="mt-2 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function Buton({
  children,
  onClick,
  tur = "birincil",
  tip = "button",
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tur?: "birincil" | "ikincil" | "tehlike";
  tip?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const stiller = {
    birincil: "bg-brand text-white hover:bg-brand-dark",
    ikincil: "border border-hairline bg-white text-ink hover:bg-page",
    tehlike: "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button
      type={tip}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 ${stiller[tur]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Modal({
  acik,
  baslik,
  kapat,
  children,
  genis = false,
}: {
  acik: boolean;
  baslik: string;
  kapat: () => void;
  children: React.ReactNode;
  genis?: boolean;
}) {
  if (!acik) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={kapat}
    >
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-hairline bg-surface p-6 shadow-xl ${
          genis ? "max-w-4xl" : "max-w-md"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">{baslik}</h3>
          <button
            onClick={kapat}
            className="rounded-lg p-1 text-muted transition hover:bg-page hover:text-ink"
            aria-label="Kapat"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function RolRozeti({ rol }: { rol: Rol }) {
  const stiller: Record<Rol, string> = {
    admin: "bg-accent text-brand-deep",
    editor: "bg-emerald-200 text-emerald-900",
    viewer: "bg-stone-200 text-stone-700",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${stiller[rol]}`}>
      {ROL_ETIKETLERI[rol]}
    </span>
  );
}

export function BosDurum({ mesaj }: { mesaj: string }) {
  return (
    <div className="rounded-xl border border-dashed border-hairline bg-page/60 py-10 text-center text-sm text-muted">
      {mesaj}
    </div>
  );
}

export function Yukleniyor() {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-muted">
      Veriler yükleniyor…
    </div>
  );
}
