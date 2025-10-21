// Minimal Microsoft Graph SharePoint workbook connectivity test
// Usage (PowerShell example):
//   $env:AZURE_TENANT_ID="..."
//   $env:AZURE_CLIENT_ID="..."
//   $env:AZURE_CLIENT_SECRET="..."
//   $env:GRAPH_SITE_ID="ncpcoth.sharepoint.com,xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx,yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
//   $env:GRAPH_WORKBOOK_PATH="Shared Documents/Attendance.xlsx"
//   $env:GRAPH_TBL_USERS="Users"
//   node test-graph.mjs

const TENANT = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const SITE_ID = process.env.GRAPH_SITE_ID;
const WORKBOOK_PATH = process.env.GRAPH_WORKBOOK_PATH;
const TEST_TABLE = process.env.GRAPH_TBL_USERS || "Users";

if (!TENANT || !CLIENT_ID || !CLIENT_SECRET || !SITE_ID || !WORKBOOK_PATH) {
  console.error("Missing envs. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, GRAPH_SITE_ID, GRAPH_WORKBOOK_PATH");
  process.exit(1);
}

async function getToken() {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });
  const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Token error ${r.status}: ${txt}`);
  }
  const data = await r.json();
  return data.access_token;
}

async function graph(path, token) {
  const url = path.startsWith("http") ? path : `https://graph.microsoft.com/v1.0${path}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Graph ${r.status} for ${path}: ${txt}`);
  }
  return r.json();
}

function encodePath(p) {
  return p.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

async function main() {
  console.log("Getting token…");
  const token = await getToken();
  console.log("Token OK");

  console.log("\nListing site drive root children…");
  const root = await graph(`/sites/${SITE_ID}/drive/root/children`, token);
  console.log(root.value.slice(0, 10).map(i => ({ name: i.name, folder: !!i.folder, file: !!i.file })));

  console.log("\nGetting workbook item meta…");
  const meta = await graph(`/sites/${SITE_ID}/drive/root:/${encodePath(WORKBOOK_PATH)}`, token);
  console.log({ name: meta.name, id: meta.id, webUrl: meta.webUrl });

  console.log(`\nReading table header for \"${TEST_TABLE}\"…`);
  const hdr = await graph(`/sites/${SITE_ID}/drive/root:/${encodePath(WORKBOOK_PATH)}:/workbook/tables/${encodeURIComponent(TEST_TABLE)}/headerRowRange`, token);
  console.log({ headers: hdr.values?.[0] });

  console.log("\nAll checks passed.");
}

main().catch(err => {
  console.error("FAILED:", err.message);
  process.exit(1);
});

