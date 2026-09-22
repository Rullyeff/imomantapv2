/**
 * Builds a full database backup and uploads it to Google Drive,
 * organised as: IMO MANTAP Backup / <YYYY> / <YYYY-MM> / imomantap-backup-<ts>.json
 *
 * Google Drive is reached through the Lovable connector gateway (server-only).
 */
import { BACKUP_TABLES } from "./backup-tables";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const ROOT_FOLDER_NAME = "IMO MANTAP Backup";
const FOLDER_MIME = "application/vnd.google-apps.folder";

function driveHeaders(): Record<string, string> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const driveKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lovableKey || !driveKey) {
    throw new Error("Koneksi Google Drive belum tersedia.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": driveKey,
  };
}

async function driveFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...driveHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Drive [${res.status}]: ${body}`);
  }
  return res.json() as Promise<any>;
}

async function ensureFolder(name: string, parentId?: string): Promise<string> {
  const escaped = name.replace(/'/g, "\\'");
  const q = [
    `name='${escaped}'`,
    `mimeType='${FOLDER_MIME}'`,
    "trashed=false",
    parentId ? `'${parentId}' in parents` : null,
  ]
    .filter(Boolean)
    .join(" and ");

  const found = await driveFetch(
    `/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent("files(id,name)")}&pageSize=10`,
  );
  const existing = found?.files?.[0]?.id as string | undefined;
  if (existing) return existing;

  const created = await driveFetch(`/drive/v3/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  return created.id as string;
}

async function uploadJson(fileName: string, parentId: string, content: string) {
  const boundary = `imomantap${Date.now()}`;
  const meta = JSON.stringify({ name: fileName, parents: [parentId] });
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    `https://connector-gateway.lovable.dev/google_drive/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size`,
    {
      method: "POST",
      headers: {
        ...driveHeaders(),
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(`Google Drive [${res.status}]: ${await res.text()}`);
  }
  return (await res.json()) as { id: string; name: string; webViewLink?: string; size?: string };
}

function jakartaParts(now = new Date()) {
  const j = new Date(now.getTime() + 7 * 3600 * 1000);
  const yyyy = j.getUTCFullYear();
  const mm = String(j.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(j.getUTCDate()).padStart(2, "0");
  const hh = String(j.getUTCHours()).padStart(2, "0");
  const mi = String(j.getUTCMinutes()).padStart(2, "0");
  return { yyyy: String(yyyy), mm, dd, hh, mi };
}

export async function runDriveBackup(triggeredBy: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const tables: Record<string, any[]> = {};
  for (const t of BACKUP_TABLES) {
    const rows: any[] = [];
    const size = 1000;
    for (let from = 0; ; from += size) {
      const { data: chunk, error } = await supabaseAdmin
        .from(t as never)
        .select("*")
        .range(from, from + size - 1);
      if (error) throw new Error(`${t}: ${error.message}`);
      rows.push(...((chunk as any[]) ?? []));
      if (!chunk || (chunk as any[]).length < size) break;
    }
    tables[t] = rows;
  }

  const accounts: { id: string; email: string | null; created_at: string }[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data: u, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    accounts.push(
      ...(u?.users ?? []).map((x) => ({
        id: x.id,
        email: x.email ?? null,
        created_at: x.created_at,
      })),
    );
    if (!u || u.users.length < 200) break;
  }

  const generated_at = new Date().toISOString();
  const payload = {
    generated_at,
    triggered_by: triggeredBy,
    tables,
    accounts,
    counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
  };
  const content = JSON.stringify(payload, null, 2);

  const { yyyy, mm, dd, hh, mi } = jakartaParts();
  const rootId = await ensureFolder(ROOT_FOLDER_NAME);
  const yearId = await ensureFolder(yyyy, rootId);
  const monthId = await ensureFolder(`${yyyy}-${mm}`, yearId);
  const fileName = `imomantap-backup-${yyyy}-${mm}-${dd}_${hh}${mi}.json`;
  const file = await uploadJson(fileName, monthId, content);

  await supabaseAdmin.from("system_audit_logs").insert({
    action: "backup_google_drive",
    table_name: "all",
    new_data: {
      file_id: file.id,
      file_name: file.name,
      link: file.webViewLink ?? null,
      folder: `${ROOT_FOLDER_NAME}/${yyyy}/${yyyy}-${mm}`,
      triggered_by: triggeredBy,
      counts: payload.counts,
      bytes: content.length,
    },
  } as never);

  return {
    ok: true as const,
    file_name: file.name,
    file_id: file.id,
    link: file.webViewLink ?? null,
    folder: `${ROOT_FOLDER_NAME}/${yyyy}/${yyyy}-${mm}`,
    counts: payload.counts,
    generated_at,
  };
}

export type DriveBackupFile = {
  id: string;
  name: string;
  size: number | null;
  modifiedTime: string | null;
  link: string | null;
};

/** Daftar berkas cadangan JSON di dalam folder "IMO MANTAP Backup" (termasuk subfolder). */
export async function listDriveBackups(limit = 50): Promise<DriveBackupFile[]> {
  const q = [
    `name='${ROOT_FOLDER_NAME.replace(/'/g, "\\'")}'`,
    `mimeType='${FOLDER_MIME}'`,
    "trashed=false",
  ].join(" and ");
  const root = await driveFetch(
    `/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent("files(id)")}&pageSize=5`,
  );
  const rootId = root?.files?.[0]?.id as string | undefined;
  if (!rootId) return [];

  // Telusuri folder tahun -> bulan, kumpulkan berkas JSON.
  const files: DriveBackupFile[] = [];
  async function children(parentId: string) {
    const res = await driveFetch(
      `/drive/v3/files?q=${encodeURIComponent(`'${parentId}' in parents and trashed=false`)}` +
        `&fields=${encodeURIComponent("files(id,name,mimeType,size,modifiedTime,webViewLink)")}` +
        `&orderBy=${encodeURIComponent("modifiedTime desc")}&pageSize=200`,
    );
    return (res?.files ?? []) as any[];
  }

  const queue: string[] = [rootId];
  while (queue.length && files.length < limit * 4) {
    const current = queue.shift()!;
    for (const f of await children(current)) {
      if (f.mimeType === FOLDER_MIME) queue.push(f.id);
      else if (typeof f.name === "string" && f.name.toLowerCase().endsWith(".json")) {
        files.push({
          id: f.id,
          name: f.name,
          size: f.size ? Number(f.size) : null,
          modifiedTime: f.modifiedTime ?? null,
          link: f.webViewLink ?? null,
        });
      }
    }
  }

  files.sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""));
  return files.slice(0, limit);
}

/** Unduh isi satu berkas cadangan dari Google Drive. */
export async function readDriveBackup(fileId: string) {
  const res = await fetch(`${GATEWAY}/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: driveHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Google Drive [${res.status}]: ${await res.text()}`);
  }
  const text = await res.text();
  return JSON.parse(text) as {
    generated_at?: string;
    tables?: Record<string, any[]>;
    accounts?: any[];
    counts?: Record<string, number>;
  };
}
