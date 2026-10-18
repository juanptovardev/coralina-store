import { redirect } from "next/navigation";
import { getSessionEmail, getSessionRole } from "@/lib/session-role";
import { MiCuentaAccess } from "./access";
import { MiCuentaPanel } from "./panel";

export const dynamic = "force-dynamic";

export default async function MiCuentaPage() {
  const role = await getSessionRole();
  if (role === null) redirect("/login");
  if (role === "admin" || role === "asesor") redirect("/admin");

  // El rol viene de la cookie coralina_role; el email, de la cookie de identidad
  // que emite /api/mi-cuenta/session tras verificar la clave. Sin identidad se
  // pide una vez (activación) en lugar de devolver al login.
  const email = await getSessionEmail();
  if (!email) return <MiCuentaAccess />;

  return <MiCuentaPanel />;
}
