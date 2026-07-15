import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["apps/mobile/app", "apps/mobile/src"];
const blockedTokens = ["√", "ƒ", "≈"];
const allowedExtensions = new Set([".ts", ".tsx", ".json"]);

function walk(dir) {
  const entries = [];

  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".expo" || name === "coverage" || name === "dist") {
      continue;
    }

    const path = join(dir, name);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      entries.push(...walk(path));
      continue;
    }

    if ([...allowedExtensions].some((extension) => path.endsWith(extension))) {
      entries.push(path);
    }
  }

  return entries;
}

const offenders = [];

for (const root of roots) {
  for (const file of walk(root)) {
    const content = readFileSync(file, "utf8");

    for (const token of blockedTokens) {
      if (content.includes(token)) {
        offenders.push(`${file}: contains ${token}`);
      }
    }
  }
}

if (offenders.length > 0) {
  console.error("Mobile copy encoding boundary failed:");
  for (const offender of offenders) {
    console.error(`- ${offender}`);
  }
  process.exit(1);
}

console.log("Mobile copy encoding boundary passed.");
