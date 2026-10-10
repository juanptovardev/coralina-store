import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { getActor } from "@/lib/session";
import { decodeRole } from "@/lib/session-sign";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const raw = (await cookies()).get("coralina_role")?.value;
  const role = await decodeRole(raw);
  if (role !== "admin" && role !== "asesor") redirect("/");
  const actor = await getActor();
  return <AdminShell actor={actor}>{children}</AdminShell>;
}
