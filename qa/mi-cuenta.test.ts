// Tests unitarios de la validación del perfil y del cambio de clave (T3).
// Correr: bun qa/mi-cuenta.test.ts
import { validateProfile, validatePasswordChange } from "../src/lib/validate-profile";

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

const base = { name: "Ana Pérez", phone: "", city: "", address: "" };

console.log("— (a) nombre —");
ok("1 char → error", validateProfile({ ...base, name: "A" }).ok === false);
ok("2 chars → ok", validateProfile({ ...base, name: "An" }).ok === true);
ok("80 chars → ok", validateProfile({ ...base, name: "a".repeat(80) }).ok === true);
ok("81 chars → error", validateProfile({ ...base, name: "a".repeat(81) }).ok === false);
ok("vacío → error", validateProfile({ ...base, name: "" }).ok === false);
const trimName = validateProfile({ ...base, name: "  Ana Pérez  " });
ok("aplica trim al nombre", trimName.ok === true && trimName.data.name === "Ana Pérez");

console.log("— (b) teléfono —");
ok("vacío → ok", validateProfile({ ...base, phone: "" }).ok === true);
ok("20 chars → ok", validateProfile({ ...base, phone: "1".repeat(20) }).ok === true);
ok("21 chars → error", validateProfile({ ...base, phone: "1".repeat(21) }).ok === false);
const trimPhone = validateProfile({ ...base, phone: "  +57 300 123 4567  " });
ok("aplica trim al teléfono", trimPhone.ok === true && trimPhone.data.phone === "+57 300 123 4567");

console.log("— (c) ciudad —");
ok("vacía → ok", validateProfile({ ...base, city: "" }).ok === true);
ok("60 chars → ok", validateProfile({ ...base, city: "c".repeat(60) }).ok === true);
ok("61 chars → error", validateProfile({ ...base, city: "c".repeat(61) }).ok === false);

console.log("— (d) dirección —");
ok("vacía → ok", validateProfile({ ...base, address: "" }).ok === true);
ok("160 chars → ok", validateProfile({ ...base, address: "d".repeat(160) }).ok === true);
ok("161 chars → error", validateProfile({ ...base, address: "d".repeat(161) }).ok === false);

console.log("— (e) tipos no string —");
ok("name numérico → error", validateProfile({ ...base, name: 123 }).ok === false);
const nonString = validateProfile({ name: "Ana", phone: 5, city: null, address: undefined });
ok("campos no string quedan vacíos", nonString.ok === true && nonString.data.phone === "" && nonString.data.city === "" && nonString.data.address === "");

console.log("— (f) normalización completa —");
const good = validateProfile({ name: "  Ana Pérez ", phone: " +57 300 123 4567 ", city: " Cartagena ", address: " Calle 1 #2-3 " });
ok("válido → ok:true", good.ok === true);
if (good.ok) {
  ok(
    "todos los campos con trim",
    good.data.name === "Ana Pérez" &&
      good.data.phone === "+57 300 123 4567" &&
      good.data.city === "Cartagena" &&
      good.data.address === "Calle 1 #2-3",
  );
}

console.log("— (g) cambio de contraseña —");
ok("actual vacía → error", validatePasswordChange({ currentPassword: "", newPassword: "12345678" }).ok === false);
ok("nueva 7 chars → error", validatePasswordChange({ currentPassword: "vieja-123", newPassword: "1234567" }).ok === false);
ok("nueva 129 chars → error", validatePasswordChange({ currentPassword: "vieja-123", newPassword: "x".repeat(129) }).ok === false);
ok("nueva 8 chars → ok", validatePasswordChange({ currentPassword: "vieja-123", newPassword: "12345678" }).ok === true);
ok("nueva 128 chars → ok", validatePasswordChange({ currentPassword: "vieja-123", newPassword: "x".repeat(128) }).ok === true);
ok("nueva no string → error", validatePasswordChange({ currentPassword: "vieja-123", newPassword: 12345678 }).ok === false);
const keepCase = validatePasswordChange({ currentPassword: "  Clave Actual  ", newPassword: " nueva-123 " });
ok("no recorta la actual", keepCase.ok === true && keepCase.data.currentPassword === "  Clave Actual  ");
ok("no recorta la nueva", keepCase.ok === true && keepCase.data.newPassword === " nueva-123 ");

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) process.exitCode = 1;
