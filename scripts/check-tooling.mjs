import { execFileSync } from "node:child_process";

const REQUIRED_NODE_MAJOR = 22;
const REQUIRED_PNPM_VERSION = "10.33.0";

function detectPnpmVersion() {
  const userAgent = process.env.npm_config_user_agent ?? "";
  const userAgentMatch = userAgent.match(/pnpm\/([^\s]+)/);

  if (userAgentMatch?.[1]) {
    return userAgentMatch[1];
  }

  try {
    return execFileSync("pnpm", ["-v"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return null;
  }
}

const nodeVersion = process.versions.node;
const nodeMajor = Number(nodeVersion.split(".")[0]);
const pnpmVersion = detectPnpmVersion();
const errors = [];

if (!Number.isInteger(nodeMajor) || nodeMajor < REQUIRED_NODE_MAJOR) {
  errors.push(
    `Node.js ${nodeVersion} is unsupported. BabyLoop requires Node.js >=${REQUIRED_NODE_MAJOR}.`
  );
}

if (pnpmVersion !== REQUIRED_PNPM_VERSION) {
  errors.push(
    pnpmVersion
      ? `pnpm ${pnpmVersion} is unsupported. BabyLoop expects pnpm ${REQUIRED_PNPM_VERSION}.`
      : `pnpm version could not be detected. BabyLoop expects pnpm ${REQUIRED_PNPM_VERSION}.`
  );
}

console.log(`Node.js: ${nodeVersion}`);
console.log(`pnpm: ${pnpmVersion ?? "not detected"}`);

if (errors.length > 0) {
  console.error("\nBabyLoop tooling preflight failed:");

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  console.error("\nUse the documented toolchain before running validation:");
  console.error("- nvm use");
  console.error("- or install/use Node.js 22.13.1");
  console.error("- then run pnpm -v and pnpm preflight again");

  process.exit(1);
}

console.log("BabyLoop tooling preflight passed.");
