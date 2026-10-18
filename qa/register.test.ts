// Tests unitarios de la validación de auto-registro (T2). Correr: bun qa/register.test.ts
import { validateRegistration } from "../src/lib/validate-register";

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
ok("sin @ → error", validateRegistration({ name: "Ana Pérez", email: "no-es-email", password: "clave12345" }).ok === false);
ok("vacío → error", validateRegistration({ name: "Ana Pérez", email: "", password: "clave12345" }).ok === false);
ok("sin punto en dominio → error", validateRegistration({ name: "Ana Pérez", email: "ana@coralina", password: "clave12345" }).ok === false);
ok(">254 → error", validateRegistration({ name: "Ana Pérez", email: `${"a".repeat(250)}@x.io`, password: "clave12345" }).ok === false);

console.log("— (b) password fuera de rango —");
ok("7 chars → error", validateRegistration({ name: "Ana Pérez", email: "ana@coralina.com", password: "1234567" }).ok === false);
ok("129 chars → error", validateRegistration({ name: "Ana Pérez", email: "ana@coralina.com", password: "x".repeat(129) }).ok === false);
ok("8 chars → ok", validateRegistration({ name: "Ana Pérez", email: "ana@coralina.com", password: "12345678" }).ok === true);

console.log("— (c) name fuera de rango —");
ok("1 char → error", validateRegistration({ name: "A", email: "ana@coralina.com", password: "clave12345" }).ok === false);
ok("81 chars → error", validateRegistration({ name: "a".repeat(81), email: "ana@coralina.com", password: "clave12345" }).ok === false);
ok("2 chars → ok", validateRegistration({ name: "An", email: "ana@coralina.com", password: "clave12345" }).ok === true);

console.log("— (d) normalización de mayúsculas/espacios —");
const norm = validateRegistration({ name: "  Ana Pérez  ", email: "  Ana@Ejemplo.COM ", password: "clave12345" });
ok("entrada con espacios/mayúsculas → ok", norm.ok === true);
if (norm.ok) {
  ok("email en minúsculas y sin espacios", norm.data.email === "ana@ejemplo.com");
  ok("name con trim", norm.data.name === "Ana Pérez");
}

console.log("— (e) input válido —");
const good = validateRegistration({ name: "Ana Pérez", email: "ana@ejemplo.com", password: "secreta-123" });
ok("válido → ok:true", good.ok === true);
if (good.ok) {
  ok(
    "data con valores ya normalizados",
    good.data.name === "Ana Pérez" &&
      good.data.email === "ana@ejemplo.com" &&
      good.data.password === "secreta-123",
  );
}

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) process.exitCode = 1;
