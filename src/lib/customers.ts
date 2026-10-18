import { sql } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";

type DbClient = Pick<typeof db, "insert">;

export type CustomerContact = {
  name: string;
  email: string;
  phone?: string;
  city?: string;
  address?: string;
};

/**
 * Upsert atómico por email (índice único customers_email_uniq). Dos escrituras
 * concurrentes del mismo email no crean filas duplicadas.
 *
 * `clearEmpty` decide qué hacer con los campos opcionales vacíos:
 * - false (checkout): conserva el valor previo; un envío sin teléfono no borra
 *   el teléfono que el cliente ya había guardado.
 * - true (perfil): el usuario puede vaciar un campo de su propia ficha.
 */
export async function upsertCustomerByEmail(
  customer: CustomerContact,
  opts: { clearEmpty?: boolean } = {},
  client: DbClient = db,
): Promise<number> {
  const email = customer.email.trim().toLowerCase();
  const clearEmpty = opts.clearEmpty === true;
  const [row] = await client
    .insert(customers)
    .values({
      name: customer.name,
      email,
      phone: customer.phone ?? "",
      city: customer.city ?? "",
      address: customer.address ?? "",
    })
    .onConflictDoUpdate({
      target: customers.email,
      set: {
        name: customer.name,
        phone: clearEmpty ? (customer.phone ?? "") : customer.phone ? customer.phone : sql`${customers.phone}`,
        city: clearEmpty ? (customer.city ?? "") : customer.city ? customer.city : sql`${customers.city}`,
        address: clearEmpty
          ? (customer.address ?? "")
          : customer.address
            ? customer.address
            : sql`${customers.address}`,
      },
    })
    .returning({ id: customers.id });
  return row.id;
}
