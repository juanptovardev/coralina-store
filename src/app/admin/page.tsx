import Link from "next/link";
import { db } from "@/db";
import { orders, shipments } from "@/db/schema";
import { desc } from "drizzle-orm";
import { categoryStockSummary, getActiveLayout, listProducts } from "@/lib/queries";
import { buildOrderMetrics } from "@/lib/metrics";
import { formatCOP, LAYOUT_PLANE, OPERATIONAL_TAGS, type LayoutMode } from "@/lib/constants";
import { readBanner } from "@/lib/design";
import { getActor } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [layout, products, stock, allOrders, metrics, board, actor] = await Promise.all([
    getActiveLayout(),
    listProducts(),
    categoryStockSummary(),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(300),
    // Métricas (KPIs + byTag + barras 14 días): fuente única compartida con
    // /api/admin/orders — agregados SQL con cortes de día de Bogotá (UTC-5).
    buildOrderMetrics(),
    db.select().from(shipments),
    getActor(),
  ]);

  // server component async: corre una vez por request; "hoy" lo usa hourAgo (envíos +24h)
  const now = Date.now();
  const hourAgo = (h: number) => new Date(now - h * 3600 * 1000);
  const lowStock = stock.reduce((a, s) => a + s.lowCount, 0);
  // Sin filas en home_layouts (base recién vaciada) getActiveLayout devuelve
  // undefined: todo acceso a layout.* debe tolerarlo o el dashboard revienta
  // con el error boundary ("La consola tuvo un problema").
  const hasLayout = Boolean(layout);
  const plane = LAYOUT_PLANE[layout?.mode as LayoutMode] ?? LAYOUT_PLANE.preset_left;
  const inRevision = board.filter((s) => s.status === "revision").length;
  const activeBoard = board.filter((s) => s.status !== "archivado").length;
  const byTag = metrics.byTag;
  const maxTag = Math.max(1, ...Object.values(byTag));
  const recent = allOrders.slice(0, 6);

  /* Necesita atención (estilo v4) */
  const porRevisar = metrics.byTag.por_revisar ?? 0;
  const staleShipments = board.filter(
    (s) => s.status === "revision" && new Date(s.createdAt) < hourAgo(24),
  );
  const staleCodes = staleShipments
    .map((s) => allOrders.find((o) => o.id === s.orderId)?.displayId)
    .filter((x): x is string => Boolean(x))
    .slice(0, 3);

  /* Barras de los últimos 14 días naturales de Bogotá (fuente única: lib/metrics) */
  const byDay = metrics.byDay;
  const maxDay = Math.max(1, ...byDay.map((d) => d.count));

  /* Encabezado: fecha real de Bogotá y la carga pendiente del día */
  const fecha = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Bogota",
  }).format(new Date(now));
  const firstName = actor.name?.trim().split(/\s+/)[0] || "equipo";
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const pendientesHoy = [
    porRevisar > 0 ? plural(porRevisar, "pedido sin confirmar", "pedidos sin confirmar") : null,
    lowStock > 0 ? plural(lowStock, "talla bajo umbral", "tallas bajo umbral") : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      {/* ---------- encabezado ---------- */}
      <div className="relative overflow-hidden rounded-xl bg-[var(--d-bg)] px-6 py-6 text-white">
        <svg viewBox="0 0 800 200" className="absolute inset-0 h-full w-full text-white/10" fill="none" aria-hidden>
          <path d="M-20 140c120-40 200 40 320 10s180-90 300-70 220 80 220 80" stroke="currentColor" strokeWidth="1.5" />
          <path d="M-20 170c120-40 200 40 320 10s180-90 300-70 220 80 220 80" stroke="currentColor" strokeWidth="1.5" opacity=".6" />
          <circle cx="680" cy="52" r="34" stroke="currentColor" strokeWidth="1.2" opacity=".5" />
        </svg>
        <div className="relative">
          <p className="text-[0.6rem] font-bold tracking-[0.24em] text-[var(--d-gold)] uppercase">
            {fecha} · Bogotá
          </p>
          <h1 className="d-title mt-1.5 text-3xl text-white">Hola, {firstName}</h1>
          <p className="mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-white/65">
            {pendientesHoy.length
              ? `Hoy tienes ${pendientesHoy.join(" y ")}.`
              : "Hoy no hay pedidos sin confirmar ni tallas bajo umbral."}{" "}
            Las cifras se cortan a medianoche de Bogotá.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/admin/pedidos" className="dash-btn dash-btn-primary">
              Ver pedidos
            </Link>
            <Link href="/admin/envios" className="dash-btn border-white/25 bg-white/10 text-white hover:!text-white">
              Tablero de envíos
            </Link>
          </div>
        </div>
      </div>

      {/* ---------- KPIs ---------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPI
          label="Pedidos hoy"
          value={String(metrics.today)}
          hint={`Ayer: ${metrics.prevDay}`}
          trend={metrics.today >= metrics.prevDay ? "up" : "down"}
        />
        <KPI
          label="Pedidos del mes"
          value={String(metrics.month)}
          hint={`${formatCOP(metrics.revenueMonth)} vendidos desde el día 1`}
        />
        <KPI
          label="Ticket promedio"
          value={formatCOP(metrics.avgTicket)}
          hint="Histórico de la tienda, sin cancelados"
        />
        <KPI
          label="Tallas bajo umbral"
          value={String(lowStock)}
          hint={lowStock ? "Necesitan reposición" : "Todas por encima del umbral"}
          trend={lowStock > 0 ? "down" : "up"}
        />
      </div>

      {/* ---------- lo que pide acción ahora ---------- */}
      <div className="dash-panel p-5">
        <div className="flex items-center justify-between">
          <p className="dash-label">Para resolver hoy</p>
          <span className="text-[0.68rem] text-[var(--d-ink-soft)]">Abre la lista ya filtrada</span>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Link
            href="/admin/pedidos?tag=por_revisar"
            className="group rounded-lg border border-[var(--d-line)] bg-[var(--d-panel-2)] p-4 transition hover:border-[var(--d-accent)]"
          >
            <p className="text-[0.7rem] font-semibold text-[var(--d-ink-soft)]">Sin confirmar</p>
            <p className="d-title mt-1 text-3xl text-[var(--d-accent)]">{porRevisar}</p>
            <p className="mt-1 text-[0.68rem] text-[var(--d-ink-soft)]">
              {porRevisar === 0
                ? "Ninguno espera confirmación"
                : "Pedidos que esperan tu confirmación"}
            </p>
          </Link>
          <Link
            href="/admin/envios"
            className="group rounded-lg border border-[var(--d-line)] bg-[var(--d-panel-2)] p-4 transition hover:border-[var(--d-accent)]"
          >
            <p className="text-[0.7rem] font-semibold text-[var(--d-ink-soft)]">En revisión hace más de 24 h</p>
            <p className="d-title mt-1 text-3xl text-[var(--d-warn)]">{staleShipments.length}</p>
            <p className="mono mt-1 truncate text-[0.68rem] text-[var(--d-ink-soft)]">
              {staleCodes.length ? staleCodes.join(" · ") : "Ninguno atrasado"}
            </p>
          </Link>
          <Link
            href="/admin/inventario"
            className="group rounded-lg border border-[var(--d-line)] bg-[var(--d-panel-2)] p-4 transition hover:border-[var(--d-accent)]"
          >
            <p className="text-[0.7rem] font-semibold text-[var(--d-ink-soft)]">Tallas por reponer</p>
            <p className="d-title mt-1 text-3xl" style={{ color: "#2f6b5e" }}>
              {lowStock}
            </p>
            <p className="mt-1 text-[0.68rem] text-[var(--d-ink-soft)]">
              {lowStock === 0 ? "Todo por encima del umbral" : "Variantes por debajo del umbral"}
            </p>
          </Link>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* ---------- capas de estado ---------- */}
        <div className="dash-panel p-5 xl:col-span-2">
          <p className="dash-label">Tres estados distintos de un pedido</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <StateCard
              title="Estado comercial"
              subtitle="Pago y orden"
              owner="Sistema"
              items={["pending", "completed", "canceled"]}
              accent="#5a4a38"
            />
            <StateCard
              title="Estado del equipo"
              subtitle="Tag operativo"
              owner="Humano"
              items={OPERATIONAL_TAGS.slice(0, 5).map((t) => t.label)}
              accent="#8a5a12"
            />
            <StateCard
              title="Estado del paquete"
              subtitle="Kanban de envíos"
              owner="Arrastrar y soltar"
              items={["Revisión", "Despacho", "Reparto", "Completado"]}
              accent="#2f6b5e"
            />
          </div>
          <p className="mt-4 rounded-lg bg-[var(--d-panel-2)] p-3 text-[0.76rem] leading-relaxed text-[var(--d-ink-soft)]">
            Un pedido que entra por la web llega como enviar, con la etiqueta por revisar y una tarjeta
            en Revisión. Si lo registras a mano como no enviar, no aparece en el tablero de envíos.
          </p>
        </div>

        {/* ---------- home activo ---------- */}
        <div className="dash-panel overflow-hidden">
          {hasLayout ? (
            <>
              <div className="border-b border-[var(--d-line)] px-4 py-3">
                <p className="dash-label">Home publicado</p>
                <p className="mt-1 text-sm font-semibold">{layout!.name}</p>
                <p className="text-[0.7rem] text-[var(--d-ink-soft)]">
                  Layout {plane.label} · versión {layout!.version}
                </p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={readBanner(layout!.banner).image}
                alt="Banner activo"
                className="h-32 w-full object-cover"
              />
              <div className="space-y-2 p-4">
                <MiniRow label="Proporción" value={`${readBanner(layout!.banner).aspect.toFixed(2)}:1`} />
                <MiniRow label="Overlay" value={`${Math.round(readBanner(layout!.banner).overlay * 100)}%`} />
                <MiniRow label="Widgets activos" value={Array.isArray(layout!.widgets) ? String(layout!.widgets.filter((w) => w.enabled).length) : "—"} />
              </div>
            </>
          ) : (
            <div className="p-4">
              <p className="dash-label">Home publicado</p>
              <p className="mt-2 text-sm font-semibold">Todavía no hay un home</p>
              <p className="mt-1 text-[0.74rem] leading-relaxed text-[var(--d-ink-soft)]">
                La tienda arranca vacía. Publica el primer diseño para elegir banner, secciones y
                widgets; mientras tanto la portada usa la vista por defecto.
              </p>
              <Link
                href="/admin/diseno"
                className="dash-btn dash-btn-primary mt-3 inline-flex items-center gap-2"
              >
                Configurar diseño →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ---------- barras 14 días (v4) ---------- */}
      <div className="dash-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="dash-label">Pedidos por día · últimos 14 días (Bogotá)</p>
          <p className="text-[0.7rem] text-[var(--d-ink-soft)]">
            total {byDay.reduce((a, d) => a + d.count, 0)} ·{" "}
            {formatCOP(byDay.reduce((a, d) => a + d.revenueCents, 0))}
          </p>
        </div>
        <div className="mt-4 flex h-44 items-end gap-1.5">
          {byDay.map((d) => (
            <div key={d.date} className="group flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="mono text-[0.6rem] font-semibold opacity-0 transition group-hover:opacity-100">
                {d.count}
              </span>
              <div
                className="w-full rounded-t bg-[var(--d-accent)]/80 transition group-hover:bg-[var(--d-accent)]"
                style={{ height: `${Math.max(3, (d.count / maxDay) * 130)}px` }}
                title={`${d.date}: ${d.count} pedido(s) · ${formatCOP(d.revenueCents)}`}
              />
              <span className="text-[0.58rem] text-[var(--d-ink-soft)]">
                {d.date.slice(8)}/{d.date.slice(5, 7)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* ---------- distribución por tag ---------- */}
        <div className="dash-panel p-5">
          <p className="dash-label">Carga por estado del equipo</p>
          <div className="mt-4 space-y-2.5">
            {OPERATIONAL_TAGS.map((t) => {
              const n = byTag[t.value] ?? 0;
              return (
                <div key={t.value} className="flex items-center gap-3">
                  <span className="w-[5.5rem] shrink-0 text-[0.72rem] text-[var(--d-ink-soft)]">{t.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--d-panel-2)]">
                    <div
                      className="h-full rounded-full bg-[var(--d-accent)] transition-all"
                      style={{ width: `${(n / maxTag) * 100}%` }}
                    />
                  </div>
                  <span className="mono w-6 text-right text-[0.72rem] font-semibold">{n}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------- últimos pedidos ---------- */}
        <div className="dash-panel overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-[var(--d-line)] px-4 py-2.5">
            <p className="dash-label">Últimos pedidos</p>
            <Link href="/admin/pedidos" className="text-[0.72rem] font-semibold text-[var(--d-accent)]">
              Ver todos →
            </Link>
          </div>
          <div className="overflow-x-auto scroll-thin">
            <table className="dash-table min-w-[540px]">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Estado equipo</th>
                  <th>Clase</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td className="mono font-semibold">{o.displayId}</td>
                    <td>
                      <span className="dash-pill bg-[#fdf0d8] text-[#8a5a12]">{o.operationalTag}</span>
                    </td>
                    <td className="text-[0.75rem] text-[var(--d-ink-soft)]">{o.fulfillmentClass}</td>
                    <td className="mono text-right font-semibold">{formatCOP(o.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ---------- accesos ---------- */}
      <div className="grid gap-4 md:grid-cols-3">
        <QuickCard
          href="/admin/envios"
          title={`${inRevision} en revisión · ${activeBoard} en el tablero`}
          text="Arrastra las tarjetas entre columnas. Los completados se archivan solos a las 24 horas."
        />
        <QuickCard
          href="/admin/productos"
          title={`${products.length} productos · ${products.filter((p) => p.status === "published").length} publicados`}
          text="Al crear uno se generan sus variantes, el SKU y el inventario."
        />
        <QuickCard
          href="/admin/auditoria"
          title="Bitácora al día"
          text="Cada cambio queda con autor, fecha y motivo. Se filtra y se exporta a CSV."
        />
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  hint,
  trend,
}: {
  label: string;
  value: string;
  hint: string;
  trend?: "up" | "down";
}) {
  return (
    <div className="dash-panel relative overflow-hidden p-4">
      <span
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{
          background:
            trend === "down" ? "var(--d-danger)" : trend === "up" ? "var(--d-ok)" : "var(--d-accent)",
        }}
      />
      <p className="dash-label">{label}</p>
      <p className="mono mt-1.5 text-[1.75rem] leading-none font-semibold">{value}</p>
      <p className="mt-1.5 text-[0.7rem] text-[var(--d-ink-soft)]">{hint}</p>
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[0.75rem]">
      <span className="text-[var(--d-ink-soft)]">{label}</span>
      <span className="mono font-semibold">{value}</span>
    </div>
  );
}

function StateCard({
  title,
  subtitle,
  owner,
  items,
  accent,
}: {
  title: string;
  subtitle: string;
  owner: string;
  items: string[];
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--d-line)] bg-[var(--d-panel-2)] p-3">
      <span className="block h-1 w-8 rounded-full" style={{ background: accent }} />
      <p className="mt-2 text-[0.78rem] font-semibold">{title}</p>
      <p className="text-[0.66rem] text-[var(--d-ink-soft)]">
        {subtitle} · lo mueve: {owner}
      </p>
      <ul className="mono mt-2 space-y-0.5 text-[0.68rem] text-[var(--d-ink-soft)]">
        {items.map((i) => (
          <li key={i}>› {i}</li>
        ))}
      </ul>
    </div>
  );
}

function QuickCard({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link
      href={href}
      className="dash-panel group flex items-start gap-3 p-4 transition hover:border-[var(--d-accent)]"
    >
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--d-accent)]" aria-hidden />
      <span>
        <span className="block text-[0.82rem] font-semibold">{title}</span>
        <span className="mt-1 block text-[0.74rem] leading-relaxed text-[var(--d-ink-soft)]">{text}</span>
      </span>
    </Link>
  );
}
