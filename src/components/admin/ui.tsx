"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--d-line)] pb-4">
      <div className="min-w-0">
        <h1 className="d-title text-[1.6rem] leading-tight">{title}</h1>
        {subtitle && (
          <p className="mt-1 max-w-3xl text-[0.82rem] leading-relaxed text-[var(--d-ink-soft)]">{subtitle}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`dash-panel p-4 ${className}`}>{children}</div>;
}

export function Stat({
  label,
  value,
  hint,
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: "up" | "down" | "flat";
}) {
  return (
    <div className="dash-panel relative overflow-hidden p-4">
      <span
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{
          background:
            trend === "down"
              ? "var(--d-danger)"
              : trend === "up"
                ? "var(--d-ok)"
                : "var(--d-accent)",
        }}
      />
      <p className="dash-label">{label}</p>
      <p className="mono mt-1.5 text-[1.7rem] leading-none font-semibold">{value}</p>
      {hint && <p className="mt-1.5 text-[0.7rem] text-[var(--d-ink-soft)]">{hint}</p>}
    </div>
  );
}

const TONES: Record<string, string> = {
  neutral: "bg-[#f4ecdc] text-[#5a4a38]",
  slate: "bg-[#eae1cf] text-[#4a3c2c]",
  coral: "bg-[#f6e0cf] text-[#a94e2b]",
  amber: "bg-[#fdf0d8] text-[#8a5a12]",
  green: "bg-[#dcece7] text-[#1f5c50]",
  blue: "bg-[#e6f0ed] text-[#2f6b5e]",
  red: "bg-[#fde8e6] text-[#b3261e]",
};

export function Badge({
  children,
  tone = "neutral",
  title,
  dot,
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
  title?: string;
  dot?: boolean;
}) {
  return (
    <span className={`dash-pill ${TONES[tone] ?? TONES.neutral}`} title={title}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="dash-panel space-y-2.5 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-4" style={{ width: `${95 - i * 9}%` }} />
      ))}
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="dash fixed inset-0 z-[60] flex justify-end bg-[#241a10]/55 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="h-full w-full max-w-xl overflow-y-auto bg-[var(--d-panel-2)] shadow-2xl scroll-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--d-line)] bg-white px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="d-title truncate text-lg">{title}</h2>
            {subtitle && <p className="text-[0.72rem] text-[var(--d-ink-soft)]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="dash-btn px-2 py-1" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5">{children}</div>
      </aside>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="dash fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-[#241a10]/55 p-4 py-10 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full overflow-hidden rounded-xl bg-[var(--d-panel-2)] shadow-2xl ${wide ? "max-w-4xl" : "max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--d-line)] bg-white px-5 py-3.5">
          <div>
            <h2 className="d-title text-lg">{title}</h2>
            {subtitle && <p className="text-[0.72rem] text-[var(--d-ink-soft)]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="dash-btn px-2 py-1" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

type ToastItem = { id: number; message: string; tone: "ok" | "error" };

const toastQueue: ToastItem[] = [];
const toastListeners = new Set<(items: ToastItem[]) => void>();
let toastSeq = 0;

function emitToasts() {
  const snapshot = [...toastQueue];
  for (const l of toastListeners) l(snapshot);
}

function pushToast(message: string, tone: "ok" | "error") {
  const item: ToastItem = { id: ++toastSeq, message, tone };
  toastQueue.push(item);
  if (toastQueue.length > 3) toastQueue.shift();
  emitToasts();
  setTimeout(() => {
    const i = toastQueue.indexOf(item);
    if (i !== -1) toastQueue.splice(i, 1);
    emitToasts();
  }, 4200);
}

/** Feedback con cola (máx 3, autodescarte). Sin dedupe: dos acciones idénticas
 *  consecutivas producen dos toasts. Uso: <Toast /> en la página + notify() en handlers. */
export function notify(message: string, tone: "ok" | "error" = "ok") {
  if (!message) return;
  pushToast(message, tone);
}

export function Toast() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    toastListeners.add(setItems);
    return () => {
      toastListeners.delete(setItems);
    };
  }, []);

  if (items.length === 0) return null;
  return (
    <div className="fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-[0.8rem] font-medium text-white shadow-xl ${
            t.tone === "ok" ? "bg-[var(--d-bg)]" : "bg-[var(--d-danger)]"
          }`}
        >
          <span>{t.tone === "ok" ? "✓" : "!"}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

/** Única frontera de red POST del panel: nunca lanza; normaliza {ok,error}+json. */
export async function postJson<T = Record<string, unknown>>(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; error?: string; json: T }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
    const ok = Boolean(res.ok && json.ok);
    return { ok, error: ok ? undefined : String(json.error ?? `HTTP ${res.status}`), json };
  } catch {
    return { ok: false, error: "Error de red.", json: {} as T };
  }
}

/** Celda CSV segura: implementación compartida con las rutas de export (lib/csv). */
export { csvCell } from "@/lib/csv";

/** Confirmación propia (reemplaza confirm() nativo) para acciones destructivas suaves. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  subtitle = "Queda auditado en la bitácora",
  confirmLabel = "Confirmar",
  danger,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  subtitle?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle}>
      <div className="space-y-4 text-[0.85rem]">
        <p>{message}</p>
        <div className="flex justify-end gap-2">
          <button className="dash-btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className={danger ? "dash-btn dash-btn-danger" : "dash-btn dash-btn-primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Hard delete a prueba de errores: escribir el nombre + reautenticación + audit previo. */
export function HardDeleteDialog({
  open,
  onClose,
  entityLabel,
  expectedText,
  description,
  onConfirm,
  canHardDelete,
}: {
  open: boolean;
  onClose: () => void;
  entityLabel: string;
  expectedText: string;
  description: string;
  canHardDelete: boolean;
  onConfirm: (confirmText: string, password: string) => Promise<string | null>;
}) {
  const [text, setText] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setText("");
      setPassword("");
      setError(null);
    }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={`Eliminar ${entityLabel}`} subtitle="Acción irreversible">
      {!canHardDelete ? (
        <div className="rounded-lg border border-[#b3261e]/35 bg-[#fdf0ee] p-4 text-[0.82rem] text-[var(--d-danger)]">
          Tu rol no permite borrar definitivamente. Puedes archivar o cancelar. La API responde{" "}
          <code className="mono">403</code> aunque se intente por fuera de la interfaz.
        </div>
      ) : (
        <div className="space-y-4 text-[0.85rem]">
          <p className="rounded-lg border border-[#b3261e]/35 bg-[#fdf0ee] p-3 text-[0.8rem] text-[var(--d-danger)]">
            {description}
          </p>
          <Step n={1} label={<>Escribe exactamente <span className="mono font-semibold">{expectedText}</span></>}>
            <input className="dash-input" value={text} onChange={(e) => setText(e.target.value)} />
            {text && text !== expectedText && (
              <p className="mt-1 text-[0.7rem] text-[var(--d-danger)]">Todavía no coincide.</p>
            )}
          </Step>
          <Step n={2} label="Reautenticación (clave del admin)">
            <input
              type="password"
              className="dash-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Step>
          <Step n={3} label="El sistema escribe la bitácora antes del borrado físico">
            <p className="text-[0.72rem] text-[var(--d-ink-soft)]">Automático · no requiere acción.</p>
          </Step>
          {error && <p className="text-[0.75rem] text-[var(--d-danger)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className="dash-btn" onClick={onClose}>
              Cancelar
            </button>
            <button
              disabled={busy || text !== expectedText || !password}
              className="dash-btn bg-[var(--d-danger)] text-white hover:!text-white"
              style={{ borderColor: "var(--d-danger)" }}
              onClick={async () => {
                setBusy(true);
                try {
                  const err = await onConfirm(text, password);
                  if (err) setError(err);
                  else onClose();
                } catch {
                  setError("Error de red. Intenta de nuevo.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Eliminando…" : "Eliminar definitivamente"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Step({ n, label, children }: { n: number; label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mono mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--d-accent-soft)] text-[0.65rem] font-bold text-[var(--d-accent)]">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[0.78rem] font-medium">{label}</p>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string;
  hint: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="dash-panel flex flex-col items-center gap-3 px-6 py-14 text-center">
      <svg viewBox="0 0 64 30" className="h-10 w-28 text-[var(--d-accent)]/45" fill="none" aria-hidden>
        <path
          d="M1 20c6-8 12-8 18 0s12 8 18 0 12-8 18 0"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path d="M1 26c6-8 12-8 18 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".5" />
      </svg>
      <p className="d-title text-lg">{title}</p>
      <p className="max-w-sm text-[0.82rem] text-[var(--d-ink-soft)]">{hint}</p>
      {actionLabel && onAction && (
        <button className="dash-btn dash-btn-primary mt-1" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function TableWrap({ children, minWidth = 900 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="dash-panel overflow-hidden">
      <div className="dash-scroll scroll-thin overflow-auto">
        <div style={{ minWidth }}>{children}</div>
      </div>
    </div>
  );
}

export function useJson<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  // Estable entre renders: los intervalos/effects que dependen de reload no se recrean.
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!alive) return;
        setData(d as T);
        setError(null);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [url, nonce]);

  return { data, loading, error, reload };
}

/** Estado "ocupado" + guardia anti doble-submit para botones de mutación. */
export function useBusy(): { busy: boolean; run: <T>(fn: () => Promise<T>) => Promise<T | undefined> } {
  const [busy, setBusy] = useState(false);
  const inflight = useRef(false);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (inflight.current) return undefined;
    inflight.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }

  return { busy, run };
}

/** Debounce genérico para inputs de búsqueda/filtros client-side. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
