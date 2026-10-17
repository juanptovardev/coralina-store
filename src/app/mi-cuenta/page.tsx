import { redirect } from "next/navigation";
import { LogoMark } from "@/components/store/svgs";
import { getSessionRole } from "@/lib/session-role";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export default async function MiCuentaPage() {
  const role = await getSessionRole();
  if (role === null) redirect("/login");
  if (role === "admin" || role === "asesor") redirect("/admin");

  // Rama reservada para roles futuros (p.j. "cliente"). Hoy getSessionRole sólo
  // expone admin|asesor|null, así que este bloque es a futuro. La cookie guarda
  // sólo el rol (no el email), así que mostramos el rol.
  const raw = role as string;
  const roleLabel = raw === "admin" ? "Administrador" : raw === "asesor" ? "Asesor" : "Cliente";

  return (
    <div className="flex min-h-screen items-center justify-center bg-linen p-6">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-white/70 p-8">
        <div className="flex items-center gap-3">
          <LogoMark className="h-9 w-9" />
          <div>
            <p className="font-display text-xl italic">Coralina</p>
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-ink/50">Tu cuenta</p>
          </div>
        </div>

        <h1 className="mt-6 font-display text-3xl italic">Tu cuenta</h1>
        <p className="mt-1 text-sm text-ink/55">panel en construcción</p>

        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex items-center justify-between rounded-lg bg-ink/5 px-3 py-2">
            <dt className="text-ink/55">Rol</dt>
            <dd className="font-medium">{roleLabel}</dd>
          </div>
        </dl>

        <ul className="mt-4 space-y-2 text-sm">
          <li className="flex items-center justify-between rounded-lg border border-ink/10 px-3 py-2">
            <span>Mis pedidos</span>
            <span className="text-xs text-ink/45">Próximamente</span>
          </li>
          <li className="flex items-center justify-between rounded-lg border border-ink/10 px-3 py-2">
            <span>Mis datos</span>
            <span className="text-xs text-ink/45">Próximamente</span>
          </li>
        </ul>

        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
