"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { formatCOP, FREE_SHIPPING_CENTS } from "@/lib/constants";
import { useStore } from "./shop";
import { ArrowIcon, ShellIcon, StarfishIcon, WaveIcon } from "./svgs";

const WHATSAPP_NUMBER = "573150000855";
const WHATSAPP_DISPLAY = "315 000 0855";

type Form = {
  name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  notes: string;
};

type Done = { code: string; total: number; wa: string };

const EMPTY_FORM: Form = {
  name: "",
  email: "",
  phone: "",
  city: "",
  address: "",
  notes: "",
};

export function Checkout() {
  const { items, subtotal, discount, total, promoCode, clear } = useStore();
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const idempotencyKeyRef = useRef("");

  function update(field: keyof Form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function placeOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (placing) return;
    if (!items.length) {
      setError("El carrito esta vacio.");
      return;
    }
    if (!form.name.trim() || !form.phone.trim() || !form.city.trim() || !form.address.trim()) {
      setError("Completa nombre, telefono, ciudad y direccion para poder enviar el pedido.");
      return;
    }
    setError("");
    setPlacing(true);
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = Date.now() + "-" + Math.random().toString(36).slice(2, 10);
    }

    try {
      const response = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: form,
          items: items.map((item) => ({ variantId: item.variantId, qty: item.qty })),
          promoCode: promoCode || undefined,
          notes: form.notes,
          payment: { method: "whatsapp", ref: "cliente-envia" },
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        setError(String(data?.error ?? "No pudimos registrar el pedido. Intenta de nuevo."));
        return;
      }

      const lines = items.map(
        (item, index) =>
          index + 1 + ". " + item.name + " (talla " + item.size + ") x" + item.qty + " = " + formatCOP(item.price * item.qty),
      );
      const text = [
        "Hola Coralina, este es mi pedido desde la pagina:",
        "",
        "Pedido " + data.code,
        "",
        lines.join("\n"),
        "",
        "Subtotal: " + formatCOP(subtotal),
        discount > 0 ? "Descuento: -" + formatCOP(discount) : "",
        "Envio: " + (subtotal >= FREE_SHIPPING_CENTS ? "gratis" : "por confirmar"),
        "Total: " + formatCOP(Number(data.total ?? total)),
        "",
        "Datos de envio:",
        "Nombre: " + form.name,
        "Telefono: " + form.phone,
        form.email ? "Correo: " + form.email : "",
        "Ciudad: " + form.city,
        "Direccion: " + form.address,
        form.notes ? "Notas: " + form.notes : "",
      ]
        .filter(Boolean)
        .join("\n");

      const wa = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text);
      clear();
      setDone({ code: String(data.code), total: Number(data.total ?? total), wa });
      window.open(wa, "_blank", "noopener,noreferrer");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("No pudimos enviar el pedido. Revisa la conexion e intenta de nuevo.");
    } finally {
      setPlacing(false);
    }
  }

  if (done) {
    return (
      <div className="fade-up mx-auto max-w-2xl">
        <div className="card p-8">
          <div className="flex items-center gap-3 text-sea">
            <WaveIcon className="h-6 w-6" />
            <p className="text-xs font-semibold uppercase tracking-widest">Pedido registrado</p>
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-ink">Ya casi esta</h1>
          <p className="mt-3 text-sm text-ink/70">
            Tu pedido <span className="font-semibold text-ink">{done.code}</span> quedo registrado por{" "}
            <span className="font-semibold text-ink">{formatCOP(done.total)}</span>. Abre WhatsApp y envialo para que el
            equipo confirme disponibilidad y despacho.
          </p>
          <a
            href={done.wa}
            target="_blank"
            rel="noreferrer"
            className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2"
          >
            Abrir WhatsApp y enviar el pedido
            <ArrowIcon className="h-4 w-4" />
          </a>
          <p className="mt-3 text-xs text-ink/60">
            Si WhatsApp no abre en este dispositivo, escribe al {WHATSAPP_DISPLAY} y manda el numero de pedido.
          </p>
          <div className="mt-6 rounded-xl bg-linen/40 p-4 text-xs text-ink/70">
            <p className="font-semibold text-ink">Estados del pedido</p>
            <p className="mt-1">Sin confirmar: lo acabamos de registrar.</p>
            <p>Por empacar: el equipo ya confirmo tu talla y tu pago.</p>
            <p>Por enviar: esta empacado y sale en la proxima ruta.</p>
            <p>Completado: lo recibiste y quedo cerrado.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <Link href="/" className="text-sea underline-offset-4 hover:underline">
              Volver a la tienda
            </Link>
            <Link href="/coleccion" className="text-sea underline-offset-4 hover:underline">
              Seguir comprando
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="fade-up mx-auto max-w-2xl">
        <div className="card p-8 text-center">
          <StarfishIcon className="mx-auto h-10 w-10 text-sea" />
          <h1 className="mt-3 text-2xl font-semibold text-ink">Tu carrito esta vacio</h1>
          <p className="mt-2 text-sm text-ink/70">Elige una pieza en la coleccion y vuelve para enviar el pedido.</p>
          <Link href="/coleccion" className="btn-primary mt-6 inline-flex items-center gap-2">
            Ver la coleccion
            <ArrowIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const envio = subtotal >= FREE_SHIPPING_CENTS ? "Gratis" : "Por confirmar";

  return (
    <div className="fade-up mx-auto max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink/60">Pedido y envio</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">Revisa tu carrito y escribenos</h1>
      <p className="mt-2 text-sm text-ink/70">
        No hay pasarela de pago. Al enviar, tu pedido queda registrado y se abre WhatsApp con el resumen escrito para que
        el equipo confirme tallas, disponibilidad y despacho.
      </p>

      <div className="card mt-6 p-5">
        <h2 className="text-sm font-semibold text-ink">Lo que llevas</h2>
        <ul className="mt-3 divide-y divide-ink/10">
          {items.map((item) => (
            <li key={item.variantId} className="flex items-center gap-3 py-3">
              {item.image ? (
                <img src={item.image} alt="" className="h-14 w-14 rounded-lg object-cover" />
              ) : (
                <span className="h-14 w-14 rounded-lg bg-linen/60" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                <p className="text-xs text-ink/60">
                  Talla {item.size} x {item.qty}
                </p>
              </div>
              <p className="text-sm text-ink">{formatCOP(item.price * item.qty)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-ink/10 pt-4 text-sm">
          <div className="flex justify-between text-ink/70">
            <dt>Subtotal</dt>
            <dd>{formatCOP(subtotal)}</dd>
          </div>
          {discount > 0 ? (
            <div className="flex justify-between text-terracotta">
              <dt>Descuento</dt>
              <dd>-{formatCOP(discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between text-ink/70">
            <dt>Envio</dt>
            <dd>{envio}</dd>
          </div>
          <div className="flex justify-between pt-2 text-base font-semibold text-ink">
            <dt>Total</dt>
            <dd>{formatCOP(total)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-ink/50">
          Envio gratis desde {formatCOP(FREE_SHIPPING_CENTS)}. El despacho tarda de 24 a 48 horas habiles en Colombia.
        </p>
      </div>

      <form className="mt-6 space-y-4" onSubmit={placeOrder}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-ink" htmlFor="name">
              Nombre completo
            </label>
            <input
              id="name"
              className="input mt-1"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Maria Fernanda Rojas"
              autoComplete="name"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink" htmlFor="phone">
              Telefono
            </label>
            <input
              id="phone"
              className="input mt-1"
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              placeholder="+57 300 000 0000"
              autoComplete="tel"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink" htmlFor="email">
              Correo (opcional)
            </label>
            <input
              id="email"
              type="email"
              className="input mt-1"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              placeholder="maria@correo.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink" htmlFor="city">
              Ciudad
            </label>
            <input
              id="city"
              className="input mt-1"
              value={form.city}
              onChange={(event) => update("city", event.target.value)}
              placeholder="Bogota"
              autoComplete="address-level2"
              required
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-ink" htmlFor="address">
            Direccion
          </label>
          <input
            id="address"
            className="input mt-1"
            value={form.address}
            onChange={(event) => update("address", event.target.value)}
            placeholder="Calle 45 #12-34, apto 502"
            autoComplete="street-address"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink" htmlFor="notes">
            Notas
          </label>
          <textarea
            id="notes"
            className="input mt-1 min-h-20"
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="Barrio, indicaciones, persona que recibe"
          />
        </div>

        {error ? <p className="text-sm text-terracotta">{error}</p> : null}

        <button type="submit" className="btn-primary w-full" disabled={placing}>
          {placing ? "Registrando pedido..." : "Enviar pedido por WhatsApp"}
        </button>
        <p className="text-center text-xs text-ink/50">
          Se abre WhatsApp con el pedido escrito. Alli acordamos disponibilidad, envio y forma de pago. No se cobra nada
          en la pagina.
        </p>
      </form>

      <Link href="/coleccion" className="mt-8 inline-flex items-center gap-1 text-sm text-sea hover:underline">
        <ShellIcon className="h-4 w-4" />
        Seguir comprando
      </Link>
    </div>
  );
}
