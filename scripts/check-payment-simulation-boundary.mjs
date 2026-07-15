import { readFileSync } from "node:fs";

const requiredFiles = [
  "apps/api/src/services/payment-simulation.service.ts",
  "apps/api/src/routes/payments.routes.ts",
  "apps/api/src/services/cart.service.ts",
  "apps/api/test/payment-simulation.service.test.ts",
  "apps/api/test/payments.routes.test.ts",
  "apps/api/test/cart-checkout.integration.test.ts"
];

const forbiddenProductionFiles = [
  "apps/api/src/services/payment-simulation.service.ts",
  "apps/api/src/routes/payments.routes.ts",
  "apps/api/src/services/cart.service.ts",
  "apps/api/src/routes/cart.routes.ts"
];

const requiredCorpus = requiredFiles.map((file) => `${file}\n${readFileSync(file, "utf8")}`).join("\n\n");
const forbiddenCorpus = forbiddenProductionFiles
  .map((file) => `${file}\n${readFileSync(file, "utf8")}`)
  .join("\n\n");

const requiredTokens = [
  "realPaymentEnabled: false",
  "realMoneyMovement: false",
  "company_legal_and_iyzico_live_not_ready",
  "livePaymentEnabled: false",
  "PAYMENT_WEBHOOK_DISABLED",
  "payment_live_disabled",
  "commission",
  "sellerPayout",
  "paymentAttempt"
];

for (const token of requiredTokens) {
  if (!requiredCorpus.includes(token)) {
    console.error(`Payment simulation boundary failed: missing ${token}`);
    process.exit(1);
  }
}

const forbiddenPatterns = [
  /iyzipay/iu,
  /card\s*number/iu,
  /cvv/iu,
  /console\.(?:log|debug|info|warn|error)\s*\([^)]*(?:IYZICO|SECRET|API_KEY|WEBHOOK)/iu,
  /livePaymentEnabled:\s*true/u,
  /realMoneyMovement:\s*true/u
];

for (const pattern of forbiddenPatterns) {
  if (pattern.test(forbiddenCorpus)) {
    console.error(`Payment simulation boundary failed: forbidden pattern ${pattern}`);
    process.exit(1);
  }
}

console.log("Payment simulation boundary passed.");
