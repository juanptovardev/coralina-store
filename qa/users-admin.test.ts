// Tests unitarios de la validación de gestión de usuarios del panel (T4).
// Correr: bun qa/users-admin.test.ts
import {
  validateCreateUser,
  validateUpdateUser,
  generateTemporaryPassword,
} from "../src/lib/validate-user-admin";

export {};

let pass = 0;
let fail = 0;
const ok = (name: string, cond: boolean) => {
  if (cond) {
    pass++;
    console.log(`  ok - ${name}`);
  } else {
    fail++;
    console.log(`  FAIL - ${name}`);
  }
};

console.log("— (a) email inválido —");
ok("sin @ → error", validateCreateUser({ email: "no-es-email", name: "Ana Pérez", role: "cliente" }).ok === false);
ok("vacío → error", validateCreateUser({ email: "", name: "Ana Pérez", role: "cliente" }).ok === false);
ok("sin punto en dominio → error", validateCreateUser({ email: "ana@coralina", name: "Ana Pérez", role: "cliente" }).ok === false);
ok(">254 → error", validateCreateUser({ email: `${"a".repeat(250)}@x.io`, name: "Ana Pérez", role: "cliente" }).ok === false);

console.log("— (b) name fuera de rango —");
ok("1 char → error", validateCreateUser({ email: "ana@coralina.com", name: "A", role: "cliente" }).ok === false);
ok("81 chars → error", validateCreateUser({ email: "ana@coralina.com", name: "a".repeat(81), role: "cliente" }).ok === false);
ok("2 chars → ok", validateCreateUser({ email: "ana@coralina.com", name: "An", role: "cliente" }).ok === true);

console.log("— (c) role inválido —");
ok("role desconocido → error", validateCreateUser({ email: "ana@coralina.com", name: "Ana Pérez", role: "superadmin" }).ok === false);
ok("role ausente → error", validateCreateUser({ email: "ana@coralina.com", name: "Ana Pérez" }).ok === false);
ok("role admin → ok", validateCreateUser({ email: "ana@coralina.com", name: "Ana Pérez", role: "admin" }).ok === true);

console.log("— (d) password —");
ok("password corta (7) → error", validateCreateUser({ email: "ana@coralina.com", name: "Ana Pérez", role: "cliente", password: "1234567" }).ok === false);
ok("password larga (129) → error", validateCreateUser({ email: "ana@coralina.com", name: "Ana Pérez", role: "cliente", password: "x".repeat(129) }).ok === false);
ok("password 8 → ok", validateCreateUser({ email: "ana@coralina.com", name: "Ana Pérez", role: "cliente", password: "12345678" }).ok === true);
ok("sin password → ok (se genera)", validateCreateUser({ email: "ana@coralina.com", name: "Ana Pérez", role: "cliente" }).ok === true);

console.log("— (e) generateTemporaryPassword —");
const p1 = generateTemporaryPassword();
const p2 = generateTemporaryPassword();
ok(`longitud 16 (fue ${p1.length})`, p1.length === 16);
ok("alfabeto base64url (A-Z a-z 0-9 - _)", /^[A-Za-z0-9_-]{16}$/.test(p1));
ok("dos llamadas difieren", p1 !== p2);

console.log("— (f) update vacío —");
ok("update sin campos → error", validateUpdateUser({}).ok === false);
ok("update solo name válido → ok", validateUpdateUser({ name: "Ana Pérez" }).ok === true);
ok("update role inválido → error", validateUpdateUser({ role: "root" }).ok === false);

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) process.exitCode = 1;
