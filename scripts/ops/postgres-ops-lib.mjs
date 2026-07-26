import { createHash } from "node:crypto";
import { chmod, copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";

export const BACKUP_MANIFEST_SCHEMA_VERSION = 1;

export function parsePostgresUrl(rawValue, label = "database URL") {
  if (!rawValue) {
    throw new Error(`${label} is required.`);
  }

  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL connection URL.`);
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error(`${label} must use postgres:// or postgresql://.`);
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
  if (!databaseName) {
    throw new Error(`${label} must include a database name.`);
  }

  return {
    databaseName,
    host: parsed.hostname,
    password: decodeURIComponent(parsed.password),
    port: parsed.port || "5432",
    sslMode: parsed.searchParams.get("sslmode") || "",
    user: decodeURIComponent(parsed.username),
    url: parsed
  };
}

export function createPgEnvironment(rawUrl, baseEnv = process.env) {
  const parsed = parsePostgresUrl(rawUrl);
  const env = { ...baseEnv };

  const inheritedConnectionKeys = [
    "PGHOST",
    "PGHOSTADDR",
    "PGPORT",
    "PGDATABASE",
    "PGUSER",
    "PGPASSWORD",
    "PGPASSFILE",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSSLMODE",
    "PGREQUIRESSL",
    "PGSSLROOTCERT",
    "PGSSLCRL",
    "PGSSLCRLDIR",
    "PGSSLCERT",
    "PGSSLKEY",
    "PGSSLSNI",
    "PGCHANNELBINDING",
    "PGCONNECT_TIMEOUT",
    "PGAPPNAME",
    "PGOPTIONS",
    "PGTARGETSESSIONATTRS"
  ];

  for (const key of inheritedConnectionKeys) {
    delete env[key];
  }

  env.PGDATABASE = parsed.databaseName;
  env.PGHOST = parsed.host;
  env.PGPORT = parsed.port;
  env.PGUSER = parsed.user;

  if (parsed.password) {
    env.PGPASSWORD = parsed.password;
  }

  const connectionParameterEnvMap = [
    ["sslmode", "PGSSLMODE"],
    ["channel_binding", "PGCHANNELBINDING"],
    ["connect_timeout", "PGCONNECT_TIMEOUT"],
    ["sslrootcert", "PGSSLROOTCERT"],
    ["sslcert", "PGSSLCERT"],
    ["sslkey", "PGSSLKEY"],
    ["application_name", "PGAPPNAME"],
    ["options", "PGOPTIONS"]
  ];

  for (const [queryKey, envKey] of connectionParameterEnvMap) {
    const value = parsed.url.searchParams.get(queryKey);

    if (value) {
      env[envKey] = value;
    }
  }

  // node-postgres and libpq interpret sslrootcert=system differently.
  // Keep it out of DATABASE_URL, but use the operating system CA store
  // for psql/pg_dump when certificate and hostname verification is enabled.
  if (env.PGSSLMODE === "verify-full" && !env.PGSSLROOTCERT) {
    env.PGSSLROOTCERT = "system";
  }

  return env;
}

export function deriveDatabaseUrl(rawUrl, databaseName) {
  const parsed = parsePostgresUrl(rawUrl).url;
  parsed.pathname = `/${encodeURIComponent(databaseName)}`;
  return parsed.toString();
}

export function safeDatabaseLabel(rawUrl) {
  const parsed = parsePostgresUrl(rawUrl);
  return `${parsed.host}:${parsed.port}/${parsed.databaseName}`;
}

export function sanitizeFileSegment(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80) || "unknown";
}

export function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z");
}

export async function sha256File(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

export async function writeJsonAtomic(filePath, value, mode = 0o600) {
  await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode });
  await chmod(temporaryPath, mode);
  await rename(temporaryPath, filePath);
}

export async function copyAtomic(sourcePath, destinationPath, mode = 0o600) {
  await mkdir(dirname(destinationPath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${destinationPath}.tmp-${process.pid}`;
  await copyFile(sourcePath, temporaryPath);
  await chmod(temporaryPath, mode);
  await rename(temporaryPath, destinationPath);
}

export async function runCommand(command, args, options = {}) {
  const {
    cwd = process.cwd(),
    env = process.env,
    input,
    quiet = false
  } = options;

  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (!quiet) {
        process.stdout.write(chunk);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (!quiet) {
        process.stderr.write(chunk);
      }
    });
    child.on("error", () => {
      rejectPromise(new Error(`Required command is unavailable: ${command}`));
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }
      rejectPromise(new Error(`${command} failed with exit code ${code}.`));
    });

    if (input !== undefined) {
      child.stdin.end(input);
    }
  });
}

export async function queryScalar(databaseUrl, sql) {
  const result = await runCommand(
    "psql",
    ["--no-psqlrc", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--command", sql],
    { env: createPgEnvironment(databaseUrl), quiet: true }
  );
  return result.stdout.trim();
}

export async function collectDatabaseFingerprint(databaseUrl) {
  const [
    publicTableCount,
    publicColumnCount,
    migrationRelation,
    serverVersionNum
  ] = await Promise.all([
    queryScalar(
      databaseUrl,
      "select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE';"
    ),
    queryScalar(
      databaseUrl,
      "select count(*) from information_schema.columns where table_schema = 'public';"
    ),
    queryScalar(
      databaseUrl,
      `select case
        when to_regclass('drizzle.__drizzle_migrations') is not null then 'drizzle'
        when to_regclass('public.__drizzle_migrations') is not null then 'public'
        else ''
      end;`
    ),
    queryScalar(databaseUrl, "show server_version_num;")
  ]);

  let migrationCount = "0";

  if (migrationRelation === "drizzle") {
    migrationCount = await queryScalar(
      databaseUrl,
      "select count(*) from drizzle.__drizzle_migrations;"
    );
  } else if (migrationRelation === "public") {
    migrationCount = await queryScalar(
      databaseUrl,
      "select count(*) from public.__drizzle_migrations;"
    );
  }

  return {
    migrationCount: Number(migrationCount),
    publicColumnCount: Number(publicColumnCount),
    publicTableCount: Number(publicTableCount),
    serverVersionNum: Number(serverVersionNum)
  };
}

export function parsePostgresClientMajor(versionOutput) {
  const match = String(versionOutput).match(/(\d+)(?:\.\d+)?/u);
  if (!match) {
    throw new Error("Unable to determine PostgreSQL client version.");
  }
  return Number(match[1]);
}

export async function assertPgDumpCompatibility(databaseUrl) {
  const [client, serverVersionNum] = await Promise.all([
    runCommand("pg_dump", ["--version"], { quiet: true }),
    queryScalar(databaseUrl, "show server_version_num;")
  ]);
  const clientMajor = parsePostgresClientMajor(client.stdout);
  const serverMajor = Math.floor(Number(serverVersionNum) / 10000);

  if (clientMajor < serverMajor) {
    throw new Error(`pg_dump major ${clientMajor} cannot safely dump PostgreSQL server major ${serverMajor}.`);
  }

  return { clientVersion: client.stdout.trim(), serverVersionNum: Number(serverVersionNum) };
}

export function assertBackupManifest(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Backup manifest must be a JSON object.");
  }
  if (value.schemaVersion !== BACKUP_MANIFEST_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup manifest schema version: ${value.schemaVersion ?? "missing"}.`);
  }
  for (const key of ["artifact", "createdAt", "databaseName", "environment", "sha256"]) {
    if (typeof value[key] !== "string" || !value[key]) {
      throw new Error(`Backup manifest is missing ${key}.`);
    }
  }
  if (!/^[a-f0-9]{64}$/u.test(value.sha256)) {
    throw new Error("Backup manifest SHA-256 is invalid.");
  }
  if (!value.fingerprint || typeof value.fingerprint !== "object") {
    throw new Error("Backup manifest fingerprint is missing.");
  }
  return value;
}

export async function readBackupManifest(manifestPath) {
  const parsed = JSON.parse(await readFile(manifestPath, "utf8"));
  return assertBackupManifest(parsed);
}

export async function verifyBackupArtifact({ artifactPath, manifestPath }) {
  const manifest = await readBackupManifest(manifestPath);
  if (basename(artifactPath) !== manifest.artifact) {
    throw new Error("Backup artifact filename does not match the manifest.");
  }
  const checksum = await sha256File(artifactPath);
  if (checksum !== manifest.sha256) {
    throw new Error("Backup artifact checksum does not match the manifest.");
  }
  const artifactStat = await stat(artifactPath);
  if (Number(manifest.bytes) !== artifactStat.size) {
    throw new Error("Backup artifact size does not match the manifest.");
  }
  return manifest;
}

export function selectRetentionDeletions(entries, options) {
  const nowMs = options.nowMs ?? Date.now();
  const maxAgeMs = Math.max(0, Number(options.retentionDays || 0)) * 24 * 60 * 60 * 1000;
  const retentionCount = Math.max(1, Number(options.retentionCount || 1));
  const sorted = [...entries].sort((a, b) => b.createdAtMs - a.createdAtMs);
  const keepByCount = new Set(sorted.slice(0, retentionCount).map((entry) => entry.manifestPath));

  return sorted.filter((entry) => {
    if (keepByCount.has(entry.manifestPath)) {
      return false;
    }
    if (maxAgeMs === 0) {
      return true;
    }
    return nowMs - entry.createdAtMs > maxAgeMs;
  });
}

export async function enforceBackupRetention({ directory, environment, databaseName, retentionCount, retentionDays }) {
  const names = await readdir(directory).catch(() => []);
  const entries = [];

  for (const name of names.filter((item) => item.endsWith(".manifest.json"))) {
    const manifestPath = join(directory, name);
    try {
      const manifest = await readBackupManifest(manifestPath);
      if (manifest.environment !== environment || manifest.databaseName !== databaseName) {
        continue;
      }
      const artifactPath = join(directory, manifest.artifact);
      await verifyBackupArtifact({ artifactPath, manifestPath });
      entries.push({
        artifactPath,
        createdAtMs: Date.parse(manifest.createdAt),
        manifestPath
      });
    } catch {
      // Invalid or incomplete backup sets are never deleted automatically.
    }
  }

  const deletions = selectRetentionDeletions(entries, { retentionCount, retentionDays });
  for (const entry of deletions) {
    await rm(entry.artifactPath, { force: true });
    await rm(entry.manifestPath, { force: true });
  }
  return deletions.length;
}

export async function removeDirectorySafe(path) {
  await rm(resolve(path), { force: true, recursive: true });
}
