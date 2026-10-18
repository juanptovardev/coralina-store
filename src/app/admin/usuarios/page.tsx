"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Card,
  ConfirmDialog,
  Modal,
  notify,
  PageHeader,
  postJson,
  Toast,
  useBusy,
  useDebouncedValue,
  useJson,
} from "@/components/admin/ui";

type Role = "admin" | "asesor" | "cliente";

type UserRow = {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  phone: string | null;
  city: string | null;
  address: string | null;
  orderCount: number;
};

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", asesor: "Asesor", cliente: "Cliente" };
const ROLE_TONE: Record<Role, "coral" | "amber" | "slate"> = {
  admin: "coral",
  asesor: "amber",
  cliente: "slate",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

export default function PersonasPage() {
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 300);
  const { data, loading, reload } = useJson<{ users: UserRow[] }>(
    `/api/admin/users?q=${encodeURIComponent(debounced.trim())}`,
  );
  const { data: actor } = useJson<{ role: Role }>("/api/admin/session");
  const isAdmin = actor?.role === "admin";
  const soloAdmin = isAdmin ? undefined : "Solo admin";

  const rows = data?.users ?? [];
  const { busy, run } = useBusy();

  // Modales
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", name: "", role: "cliente" as Role, password: "" });
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "cliente" as Role });
  const [confirm, setConfirm] = useState<{ kind: "reset" | "delete"; user: UserRow } | null>(null);
  const [revealed, setRevealed] = useState<{ label: string; password: string } | null>(null);

  useEffect(() => {
    if (createOpen) setCreateForm({ email: "", name: "", role: "cliente", password: "" });
  }, [createOpen]);

  function openEdit(u: UserRow) {
    setEditUser(u);
    setEditForm({ name: u.name, role: u.role });
  }

  async function copyPassword(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify("Contraseña copiada");
    } catch {
      notify("No se pudo copiar automáticamente", "error");
    }
  }

  async function submitCreate() {
    await run(async () => {
      const { ok, error, json } = await postJson<{ id?: number; passwordGenerada?: string }>(
        "/api/admin/users",
        {
          action: "create",
          email: createForm.email,
          name: createForm.name,
          role: createForm.role,
          password: createForm.password || undefined,
        },
      );
      if (!ok) {
        notify(error ?? "No se pudo crear el usuario", "error");
        return;
      }
      notify("Usuario creado");
      const email = createForm.email;
      setCreateOpen(false);
      if (json.passwordGenerada) {
        setRevealed({ label: `Contraseña temporal de ${email}`, password: json.passwordGenerada });
      }
      reload();
    });
  }

  async function submitEdit() {
    if (!editUser) return;
    const id = editUser.id;
    await run(async () => {
      const { ok, error } = await postJson("/api/admin/users", {
        action: "update",
        id,
        name: editForm.name,
        role: editForm.role,
      });
      if (!ok) {
        notify(error ?? "No se pudo actualizar", "error");
        return;
      }
      notify("Usuario actualizado");
      setEditUser(null);
      reload();
    });
  }

  async function doReset(u: UserRow) {
    await run(async () => {
      const { ok, error, json } = await postJson<{ password?: string }>("/api/admin/users", {
        action: "reset_password",
        id: u.id,
      });
      if (!ok) {
        notify(error ?? "No se pudo resetear la contraseña", "error");
        return;
      }
      notify("Contraseña restablecida");
      if (json.password) {
        setRevealed({ label: `Contraseña temporal de ${u.email}`, password: json.password });
      }
      reload();
    });
  }

  async function toggleActive(u: UserRow) {
    await run(async () => {
      const { ok, error } = await postJson("/api/admin/users", {
        action: "set_active",
        id: u.id,
        active: !u.active,
      });
      if (!ok) {
        notify(error ?? "No se pudo cambiar el estado", "error");
        return;
      }
      notify(u.active ? "Cuenta desactivada" : "Cuenta activada");
      reload();
    });
  }

  async function doDelete(u: UserRow) {
    await run(async () => {
      const { ok, error } = await postJson("/api/admin/users", { action: "delete", id: u.id });
      if (!ok) {
        notify(error ?? "No se pudo eliminar", "error");
        return;
      }
      notify("Cuenta eliminada");
      reload();
    });
  }

  return (
    <div>
      <PageHeader
        title="Personas"
        subtitle="Cuentas del panel y de la tienda. Solo un administrador puede crear, editar, resetear claves, activar/desactivar o eliminar."
        actions={
          <button
            className="dash-btn dash-btn-primary"
            disabled={!isAdmin || busy}
            title={soloAdmin}
            onClick={() => setCreateOpen(true)}
          >
            Nuevo usuario
          </button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 py-3">
        <input
          className="dash-input max-w-sm"
          placeholder="Buscar por nombre o email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="text-xs opacity-60">{rows.length} cuenta(s)</span>
      </Card>

      <div className="dash-panel dash-scroll overflow-auto scroll-thin">
        <table className="dash-table min-w-[1080px]">
          <thead>
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Envío</th>
              <th className="px-4 py-3">Pedidos</th>
              <th className="px-4 py-3">Último login</th>
              <th className="px-4 py-3">Creado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-6 text-sm opacity-60" colSpan={9}>
                  Cargando…
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-[0.78rem] opacity-75">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.active ? "green" : "red"} dot>
                      {u.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[0.75rem] opacity-70">
                    {u.phone || u.city ? (
                      <>
                        {u.phone || "—"}
                        <br />
                        {u.city || "—"}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">{u.orderCount}</td>
                  <td className="px-4 py-3 text-xs opacity-65">{fmtDate(u.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-xs opacity-65">{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button
                        className="dash-btn"
                        disabled={!isAdmin || busy}
                        title={soloAdmin}
                        onClick={() => openEdit(u)}
                      >
                        Editar
                      </button>
                      <button
                        className="dash-btn"
                        disabled={!isAdmin || busy}
                        title={soloAdmin}
                        onClick={() => setConfirm({ kind: "reset", user: u })}
                      >
                        Resetear clave
                      </button>
                      <button
                        className="dash-btn"
                        disabled={!isAdmin || busy}
                        title={soloAdmin}
                        onClick={() => toggleActive(u)}
                      >
                        {u.active ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        className="dash-btn dash-btn-danger"
                        disabled={!isAdmin || busy}
                        title={soloAdmin}
                        onClick={() => setConfirm({ kind: "delete", user: u })}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-sm opacity-60" colSpan={9}>
                  Sin cuentas con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- Nuevo usuario ---------- */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo usuario"
        subtitle="Si dejas la contraseña vacía, generamos una temporal."
      >
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="admin-label">Email</span>
            <input
              type="email"
              className="dash-input mt-1 w-full"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="persona@coralina.com"
            />
          </label>
          <label className="block">
            <span className="admin-label">Nombre</span>
            <input
              className="dash-input mt-1 w-full"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="Nombre y apellido"
            />
          </label>
          <label className="block">
            <span className="admin-label">Rol</span>
            <select
              className="dash-input mt-1 w-full"
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as Role })}
            >
              <option value="cliente">Cliente</option>
              <option value="asesor">Asesor</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="block">
            <span className="admin-label">Contraseña (opcional)</span>
            <input
              className="dash-input mt-1 w-full"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              placeholder="8 a 128 caracteres o vacío para generar"
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button className="dash-btn" onClick={() => setCreateOpen(false)}>
              Cancelar
            </button>
            <button className="dash-btn dash-btn-primary" disabled={busy} onClick={submitCreate}>
              {busy ? "Creando…" : "Crear usuario"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ---------- Editar usuario ---------- */}
      <Modal
        open={Boolean(editUser)}
        onClose={() => setEditUser(null)}
        title="Editar usuario"
        subtitle={editUser?.email}
      >
        {editUser && (
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="admin-label">Nombre</span>
              <input
                className="dash-input mt-1 w-full"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="admin-label">Rol</span>
              <select
                className="dash-input mt-1 w-full"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
              >
                <option value="cliente">Cliente</option>
                <option value="asesor">Asesor</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button className="dash-btn" onClick={() => setEditUser(null)}>
                Cancelar
              </button>
              <button className="dash-btn dash-btn-primary" disabled={busy} onClick={submitEdit}>
                {busy ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------- Confirmaciones ---------- */}
      <ConfirmDialog
        open={confirm?.kind === "reset"}
        onClose={() => setConfirm(null)}
        title="Resetear contraseña"
        message={
          confirm
            ? `Se generará una contraseña temporal para ${confirm.user.email}. La verás una sola vez.`
            : ""
        }
        confirmLabel="Resetear"
        onConfirm={() => {
          if (confirm) doReset(confirm.user);
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === "delete"}
        onClose={() => setConfirm(null)}
        title="Eliminar cuenta"
        subtitle="Acción irreversible"
        message={
          confirm
            ? `Se eliminará la cuenta de ${confirm.user.name} (${confirm.user.email}) de forma permanente.`
            : ""
        }
        confirmLabel="Eliminar"
        danger
        onConfirm={() => {
          if (confirm) doDelete(confirm.user);
        }}
      />

      {/* ---------- Contraseña generada (una sola vez) ---------- */}
      <Modal
        open={Boolean(revealed)}
        onClose={() => setRevealed(null)}
        title="Contraseña generada"
        subtitle="Cópiala ahora: no se vuelve a mostrar."
      >
        {revealed && (
          <div className="space-y-4 text-sm">
            <p className="text-[var(--d-ink-soft)]">{revealed.label}</p>
            <div className="flex items-center gap-2">
              <code className="mono flex-1 rounded-lg border border-[var(--d-line)] bg-[var(--d-panel-2)] px-3 py-2 text-[0.9rem]">
                {revealed.password}
              </code>
              <button className="dash-btn dash-btn-primary" onClick={() => copyPassword(revealed.password)}>
                Copiar
              </button>
            </div>
            <div className="flex justify-end">
              <button className="dash-btn" onClick={() => setRevealed(null)}>
                Listo
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Toast />
    </div>
  );
}
