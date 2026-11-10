// qa-preparar.mjs - Prepara la base de PRUEBAS para la Fase E (Metodo pBravoT).
// Lo ejecuta qa-entorno.ps1 con DATABASE_URL ya apuntando a TEST_DATABASE_URL.
// Crea/actualiza cuentas sinteticas qa-admin y qa-operador (idempotente) y las escribe en
// %PBRAVOT_QA_DIR%\cuentas.json. Se niega a correr si DATABASE_URL es la de produccion.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";
import { neon } from "@neondatabase/serverless";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const qaDir = process.env.PBRAVOT_QA_DIR;
if (!qaDir) throw new Error("Falta PBRAVOT_QA_DIR (ejecutar via qa-entorno.ps1)");

// Valores originales de los archivos .env (para comparar con produccion)
const orig = {};
for (const f of [".env.local", ".env"]) {
  const p = path.join(repo, f);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const i = l.indexOf("=");
    if (i < 1 || l.trim().startsWith("#")) continue;
    const k = l.slice(0, i).trim();
    if (!(k in orig)) orig[k] = l.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
const host = (u) => new URL(u).host;
const actual = process.env.DATABASE_URL;
if (!actual) throw new Error("Falta DATABASE_URL");
if (orig.DATABASE_URL && host(actual) === host(orig.DATABASE_URL)) {
  throw new Error("ABORTA: DATABASE_URL apunta a produccion");
}
if (orig.TEST_DATABASE_URL && host(actual) !== host(orig.TEST_DATABASE_URL)) {
  throw new Error("ABORTA: DATABASE_URL no es TEST_DATABASE_URL");
}

const sql = neon(actual);
const cuentas = {};
for (const [username, role] of [["qa-admin", "admin"], ["qa-operador", "operador"]]) {
  const password = "QA-" + crypto.randomBytes(9).toString("base64url");
  const hash = await bcrypt.hash(password, 10);
  await sql`INSERT INTO users (username, password_hash, role) VALUES (${username}, ${hash}, ${role})
            ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`;
  cuentas[username] = { role, password };
}
fs.writeFileSync(path.join(qaDir, "cuentas.json"), JSON.stringify(cuentas, null, 2));
console.log("cuentas qa listas en base de pruebas:", host(actual));
