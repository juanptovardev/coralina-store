import { redirect } from "next/navigation";

/** Alias cómodo: /dashboard → /admin */
export default function DashboardAlias() {
  redirect("/admin");
}
