/* Uji end-to-end Fase 1 MVP melawan dev server (http://127.0.0.1:3000).
   Alur: register -> login -> workspace -> world -> artikel dari template
   -> auto-linking -> relasi -> media -> publikasi -> export/import -> Arunika.
   Jalankan: node scripts/e2e-test.mjs  (dev server harus sudah jalan) */
const BASE = process.env.E2E_BASE || "http://127.0.0.1:3000";
let cookie = "";
let passed = 0;
let failed = 0;
const stamp = Date.now().toString(36);

async function call(method, path, body, isForm) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  let payload;
  if (isForm) {
    payload = body; // FormData
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* HTML page */ }
  return { status: res.status, json, text };
}

function check(name, cond, extra = "") {
  if (cond) { passed++; console.log(`PASS  ${name}`); }
  else { failed++; console.log(`FAIL  ${name} ${extra}`); }
}

const email = `e2e-${stamp}@test.local`;

// 1. Landing
let r = await call("GET", "/");
check("landing 200", r.status === 200 && r.text.includes("Worldbuilding"));

// 2. Register
r = await call("POST", "/api/auth/register", { name: "Penguji E2E", email, password: "rahasia123" });
check("register 201/200", r.status < 300 && r.json?.ok === true, JSON.stringify(r.json)?.slice(0, 200));

// 3. Login
r = await call("POST", "/api/auth/login", { email, password: "rahasia123" });
check("login ok + cookie", r.status === 200 && r.json?.ok === true && cookie.includes("wb_session"), `cookie=${cookie.slice(0, 20)}`);

// 4. Me
r = await call("GET", "/api/auth/me");
check("me = email terdaftar", r.json?.ok === true && r.json?.data?.email === email);

// 5. Workspace
r = await call("POST", "/api/workspaces", { name: "Workspace E2E" });
check("workspace dibuat", r.status < 300 && !!r.json?.data?.id, JSON.stringify(r.json)?.slice(0, 200));
const wsId = r.json?.data?.id;

// 6. World
r = await call("POST", "/api/worlds", { workspaceId: wsId, name: "Dunia E2E", description: "Dunia uji otomatis" });
check("world dibuat", r.status < 300 && !!r.json?.data?.id, JSON.stringify(r.json)?.slice(0, 200));
const worldId = r.json?.data?.id;

// 7. Template bawaan Karakter
r = await call("GET", `/api/templates?worldId=${worldId}`);
const templates = r.json?.data ?? [];
const karakter = templates.find((t) => t.name === "Character");
check("26 template tersedia & Character ada", templates.length === 26 && !!karakter, `jumlah=${templates.length}`);

// 8. Artikel 1 dari template Karakter
r = await call("POST", `/api/worlds/${worldId}/articles`, {
  title: "Aelindra",
  templateId: karakter?.id ?? null,
  content: "Aelindra adalah penjaga hutan terakhir.",
  status: "PUBLISHED",
  fieldValues: { fullName: "Aelindra", occupation: "Penjaga Hutan" },
});
check("artikel Aelindra dibuat", r.status < 300 && !!r.json?.data?.id, JSON.stringify(r.json)?.slice(0, 200));
const art1 = r.json?.data?.id;

// 9. Artikel 2 menyebut Aelindra (teks polos)
r = await call("POST", `/api/worlds/${worldId}/articles`, {
  title: "Kota Arunika",
  content: "Kota Arunika dijaga oleh Aelindra sejak lama.",
  status: "DRAFT",
});
check("artikel Kota Arunika dibuat", r.status < 300 && !!r.json?.data?.id);
const art2 = r.json?.data?.id;

// 10. Suggest-links
r = await call("GET", `/api/articles/${art2}/suggest-links`);
const suggestions = r.json?.data?.suggestions ?? r.json?.data ?? [];
const sugTitles = JSON.stringify(suggestions);
check("suggest-links menemukan Aelindra", sugTitles.includes("Aelindra"), sugTitles.slice(0, 200));

// 11. Terima saran -> konten berubah jadi [[Aelindra]]
r = await call("POST", `/api/articles/${art2}/suggest-links`, { acceptedTitles: ["Aelindra"] });
check("terima saran ok", r.status < 300 && r.json?.ok === true, JSON.stringify(r.json)?.slice(0, 200));
r = await call("GET", `/api/articles/${art2}`);
check("konten kini berisi [[Aelindra]]", (r.json?.data?.content ?? "").includes("[[Aelindra]]"), (r.json?.data?.content ?? "").slice(0, 120));

// 12. Relasi berjenis
r = await call("POST", `/api/worlds/${worldId}/relationships`, { fromArticleId: art2, toArticleId: art1, type: "dijaga oleh" });
check("relasi dibuat", r.status < 300 && !!r.json?.data?.id, JSON.stringify(r.json)?.slice(0, 200));

// 13. Pencarian global
r = await call("GET", `/api/worlds/${worldId}/search?q=Aelindra`);
check("search menemukan artikel", (r.json?.data?.articles?.length ?? r.json?.data?.length ?? 0) >= 1, JSON.stringify(r.json)?.slice(0, 200));

// 14. Media upload (PNG 1x1)
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const form = new FormData();
form.append("file", new Blob([png], { type: "image/png" }), "uji.png");
r = await call("POST", `/api/worlds/${worldId}/media`, form, true);
check("media upload ok", r.status < 300 && !!r.json?.data?.item?.id, JSON.stringify(r.json)?.slice(0, 200));
const mediaId = r.json?.data?.item?.id;
if (mediaId) {
  r = await call("GET", `/api/worlds/${worldId}/media/${mediaId}/file`);
  check("media file tersaji", r.status === 200 && r.text.length > 0, `status=${r.status}`);
}

// 15. Publikasi world + halaman publik
r = await call("PATCH", `/api/worlds/${worldId}`, { isPublic: true });
check("world dipublikasi", r.status === 200 && r.json?.data?.isPublic === true, JSON.stringify(r.json)?.slice(0, 200));
r = await call("GET", `/publik/${worldId}`);
check("halaman publik 200 + nama dunia", r.status === 200 && r.text.includes("Dunia E2E"), `status=${r.status}`);

// 16. Export world JSON
r = await call("GET", `/api/worlds/${worldId}/export`);
const exported = r.json;
check("export JSON format benar", r.status === 200 && exported?.format === "worldbuilding-platform-export" && (exported?.articles?.length ?? 0) >= 2, `articles=${exported?.articles?.length}`);

// 17. Import ke world baru (roundtrip; import selalu membuat world baru)
r = await call("POST", `/api/worlds/${worldId}/import`, { workspaceId: wsId, data: exported });
check("import ok", r.status === 201 && r.json?.ok === true && (r.json?.data?.imported?.articles ?? 0) >= 2, JSON.stringify(r.json)?.slice(0, 300));
const world2 = r.json?.data?.world?.id;
r = await call("GET", `/api/worlds/${world2}/articles`);
check("artikel hasil impor >= 2", (r.json?.data?.length ?? 0) >= 2, `jumlah=${r.json?.data?.length}`);

// 18. Example world Arunika
r = await call("POST", `/api/worlds/${worldId}/example`, { workspaceId: wsId });
check("example Arunika ok", r.status < 300 && !!r.json?.data?.world?.id, JSON.stringify(r.json)?.slice(0, 300));
const arunikaId = r.json?.data?.world?.id;
if (arunikaId) {
  r = await call("GET", `/api/worlds/${arunikaId}/articles`);
  check("Arunika punya 7 artikel", (r.json?.data?.length ?? 0) === 7, `jumlah=${r.json?.data?.length}`);
  r = await call("GET", `/api/worlds/${arunikaId}/relationships`);
  check("Arunika punya 6 relasi", (r.json?.data?.length ?? 0) === 6, `jumlah=${r.json?.data?.length}`);
}

// 19. Dashboard HTML
r = await call("GET", "/dashboard");
check("dashboard 200", r.status === 200, `status=${r.status}`);

// 20. Riwayat versi artikel 2 (>= 2 versi: dibuat + tautan)
r = await call("GET", `/api/articles/${art2}/versions`);
check("versi artikel >= 2", (r.json?.data?.length ?? 0) >= 2, `jumlah=${r.json?.data?.length}`);

console.log(`\nHASIL: ${passed} lolos, ${failed} gagal`);
process.exit(failed ? 1 : 0);
