#!/usr/bin/env node
// Script interno para reindexar todos los apuntes publicados en Meilisearch.
//
// Reusa la única fuente de verdad (el módulo TS server-side) llamando al
// endpoint admin protegido `POST /api/admin/search/reindex { action: "reindex-all" }`
// con el secret `MEILISEARCH_ADMIN_SECRET`. Requiere que el server esté corriendo.
//
// Uso:
//   npm run search:reindex                         # usa NEXT_PUBLIC_APP_URL o localhost:3000
//   npm run search:reindex -- --url https://...     # base URL explícita
//
// No imprime contenido sensible: solo conteos.

import process from "node:process";
import { loadEnvFiles } from "./lib/hls-conversion.mjs";

function parseArgs(argv) {
  const args = { url: "", help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--url") args.url = argv[++i] ?? "";
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      "Uso: npm run search:reindex [-- --url https://tu-app]\n" +
        "Requiere MEILISEARCH_ADMIN_SECRET y el server corriendo."
    );
    return;
  }

  await loadEnvFiles();

  const secret = process.env.MEILISEARCH_ADMIN_SECRET;
  if (!secret) {
    console.error("Falta configurar MEILISEARCH_ADMIN_SECRET");
    process.exit(1);
  }

  const base =
    args.url ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const endpoint = `${base.replace(/\/$/, "")}/api/admin/search/reindex`;

  console.log(`Reindexando publicados vía ${endpoint} ...`);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ action: "reindex-all" }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Reindex falló:", res.status, data?.error ?? "");
    process.exit(1);
  }

  console.log("Reindex OK:", {
    total: data.total,
    indexed: data.indexed,
    batches: data.batches,
  });
}

main().catch((err) => {
  console.error("Error inesperado:", err?.message ?? String(err));
  process.exit(1);
});
