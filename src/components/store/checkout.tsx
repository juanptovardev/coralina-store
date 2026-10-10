"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { fmtCLP } from "@/lib/utils";
import { useStore } from "./shop";
import { WaveIcon, StarfishIcon, ArrowIcon, ShellIcon } from "./svgs";

export function Checkout() {
  const { items, subtotal, discount, total, promoCode, setPromoCode, appliedPromo, clear } = useStore();
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: "", address: "", notes: "" });
  const [payMethod, setPayMethod] = useState("Transferencia bancaria (referencia)");
  const [payRef, setPayRef] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string; total: number } | null>(null);
  // Clave estable por intento de checkout: los reintentos de la MISMA compra
  // reutilizan la key (el server es idempotente). Se renueva tras un éxito.
  const idempotencyKeyRef = useRef<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const placeOrder = async () => {
    setPlacing(true);
    setError(null);
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
    try {
      const res = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: form,
          items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
          promoCode: promoCode || null,
          payment: { method: payMethod, ref: payRef || "sin referencia" },
          notes: form.notes || null,
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No pudimos procesar tu pedido");
      clear();
      idempotencyKeyRef.current = null;
      setDone({ code: data.code, total: data.total });
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPlacing(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-5 py-20 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sea/15">
          <WaveIcon className="h-10 w-10 text-sea" />
        </div>
        <h1 className="mt-6 font-display text-4xl italic">¡Pedido en el agua!</h1>
        <p className="mt-3 text-sm font-light text-ink/70">
          Tu orden <span className="font-bold text-terracotta">#{done.code}</span> por {fmtCLP(done.total)} fue creada.
          El equipo ya la tiene en <strong>Revisión</strong> y te confirmaremos el despacho por email.
        </p>
        <div className="mt-8 flex w-full max-w-md items-center justify-between rounded-2xl border border-ink/10 bg-white/70 px-5 py-4">
          {["Revisión", "Despacho", "Reparto", "Completado"].map((s, i) => (
            <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
              <div className={`h-3 w-3 rounded-full ${i === 0 ? "bg-terracotta ring-4 ring-terracotta/20" : "bg-ink/15"}`} />
              <span className={`text-[0.62rem] font-semibold uppercase tracking-wider ${i === 0 ? "text-terracotta" : "text-ink/40"}`}>{s}</span>
            </div>
          ))}
        </div>
        <Link href="/coleccion" className="btn-primary mt-10">Seguir comprando</Link>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-5 py-24 text-center">
        <StarfishIcon className="h-12 w-12 text-terracotta/40 float-slow" />
        <h1 className="mt-5 font-display text-3xl italic">Tu carrito está vacío</h1>
        <p className="mt-2 text-sm text-ink/60">Agrega tus piezas favoritas y vuelve para el pago.</p>
        <Link href="/coleccion" className="btn-primary mt-6">Ir a la colección</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
      <h1 className="font-display text-4xl italic">Pago y envío</h1>
      <p className="mt-1 text-sm text-ink/60">Hoy el pago es por referencia segura. La pasarela Bold llega pronto.</p>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        {/* Formulario */}
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-display text-xl italic">1 · Tus datos</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className="label">Nombre completo</label><input className="input" required value={form.name} onChange={set("name")} placeholder="María González" /></div>
              <div><label className="label">Email</label><input className="input" type="email" required value={form.email} onChange={set("email")} placeholder="maria@correo.cl" /></div>
              <div><label className="label">Teléfono</label><input className="input" value={form.phone} onChange={set("phone")} placeholder="+56 9 ..." /></div>
              <div><label className="label">Ciudad</label><input className="input" required value={form.city} onChange={set("city")} placeholder="Valparaíso" /></div>
              <div><label className="label">Dirección</label><input className="input" required value={form.address} onChange={set("address")} placeholder="Calle 123 #45" /></div>
              <div className="sm:col-span-2"><label className="label">Notas para el equipo (opcional)</label><textarea className="input min-h-16" value={form.notes} onChange={set("notes")} placeholder="Punto de referencia, horarios..." /></div>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="font-display text-xl italic">2 · Método de pago</h2>
            <div className="mt-4 space-y-2">
              {["Transferencia bancaria (referencia)", "Efectivo al retirar", "Tarjeta en bodega"].map((m) => (
                <label key={m} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${payMethod === m ? "border-terracotta bg-terracotta/8" : "border-ink/12 hover:border-ink/25"}`}>
                  <input type="radio" name="pay" className="accent-[var(--ct-primary)]" checked={payMethod === m} onChange={() => setPayMethod(m)} />
                  {m}
                </label>
              ))}
            </div>
            <div className="mt-4">
              <label className="label">Referencia / monto a depositar</label>
              <input className="input" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder={`Ej. DEP-${new Date().getFullYear()} (por ${fmtCLP(total)})`} />
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink/50"><ShellIcon className="h-3.5 w-3.5" /> Confirmamos tu pago antes del despacho. Sin cargo por anticipado.</p>
            </div>
          </section>
        </div>

        {/* Resumen */}
        <aside className="card h-fit p-6">
          <h2 className="font-display text-xl italic">Tu pedido</h2>
          <div className="mt-4 space-y-3">
            {items.map((i) => (
              <div key={i.variantId} className="flex items-center gap-3">
                <img src={i.image} alt="" className="h-14 w-11 rounded-lg object-cover" />
                <div className="flex-1 text-sm">
                  <p className="font-medium">{i.name} <span className="text-ink/50">· {i.size}</span></p>
                  <p className="text-xs text-ink/50">{i.qty} × {fmtCLP(i.price)}</p>
                </div>
                <p className="text-sm font-semibold">{fmtCLP(i.qty * i.price)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-sand/30 p-3">
            <div className="flex gap-2">
              <input className="input uppercase" placeholder="Código promo" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} />
              {promoCode && <button className="btn-quiet" onClick={() => setPromoCode("")}>×</button>}
            </div>
            {appliedPromo && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-sea">
                <StarfishIcon className="h-3.5 w-3.5 text-amber-brand" /> {appliedPromo.name}: −{fmtCLP(discount)}
              </p>
            )}
          </div>

          <div className="mt-4 space-y-1.5 border-t border-ink/10 pt-4 text-sm">
            <div className="flex justify-between text-ink/65"><span>Subtotal</span><span>{fmtCLP(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between font-medium text-sea"><span>Descuento</span><span>−{fmtCLP(discount)}</span></div>}
            <div className="flex justify-between pt-1 text-lg font-bold"><span>Total</span><span>{fmtCLP(total)}</span></div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-terracotta/40 bg-terracotta/10 px-4 py-3 text-xs font-medium text-terracotta">
              {error}
            </div>
          )}

          <button onClick={placeOrder} disabled={placing || !form.name || !form.email || !form.city || !form.address} className="btn-primary mt-5 w-full">
            {placing ? "Confirmando…" : `Confirmar pedido · ${fmtCLP(total)}`}
            {!placing && <ArrowIcon className="h-4 w-4" />}
          </button>
          <p className="mt-3 text-center text-[0.68rem] text-ink/45">
            Al confirmar, tu stock queda reservado y el pedido entra al flujo del equipo.
          </p>
        </aside>
      </div>
    </div>
  );
}
