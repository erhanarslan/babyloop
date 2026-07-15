import { randomUUID } from "node:crypto";

export type PaymentProviderName = "mock_iyzico" | "iyzico";
export type PaymentProviderMode = "simulation" | "blocked_live";
export type PaymentAttemptStatus = "succeeded" | "failed";

export type BabyLoopCommission = {
  amount: string;
  currency: "TRY";
  rateBps: number;
  fixedAmount: string;
};

export type SellerPayout = {
  amount: string;
  currency: "TRY";
};

export type PaymentSimulationBoundary = {
  realPaymentEnabled: false;
  realMoneyMovement: false;
  legalEntityReady: false;
  providerLiveReady: false;
  reason: "company_legal_and_iyzico_live_not_ready";
  copy: string;
};

export type PaymentAttemptSimulation = {
  id: string;
  provider: PaymentProviderName;
  providerMode: PaymentProviderMode;
  status: PaymentAttemptStatus;
  livePayment: false;
  realMoneyMovement: false;
  capturedAmount: string;
  currency: "TRY";
  createdAt: string;
};

export type PaymentProviderReadiness = {
  provider: PaymentProviderName;
  providerMode: PaymentProviderMode;
  liveRequested: boolean;
  livePaymentEnabled: false;
  realMoneyMovement: false;
  readyForLive: false;
  blockedReasons: string[];
};

export type PaymentWebhookValidation =
  | {
      accepted: true;
      statusCode: 202;
      reason: "webhook_skeleton_accepted";
    }
  | {
      accepted: false;
      statusCode: 401 | 403;
      reason:
        | "missing_webhook_secret"
        | "invalid_webhook_secret"
        | "payment_live_disabled"
        | "iyzico_live_disabled";
    };

const DEFAULT_COMMISSION_RATE_BPS = 200;
const DEFAULT_COMMISSION_FIXED_AMOUNT = "0.00";

export function calculateBabyLoopCommission(input: {
  totalAmount: string;
  rateBps?: number;
  fixedAmount?: string;
}): {
  commission: BabyLoopCommission;
  sellerPayout: SellerPayout;
} {
  const totalMinor = parseMoneyToMinorUnits(input.totalAmount);
  const rateBps = clampRateBps(input.rateBps ?? DEFAULT_COMMISSION_RATE_BPS);
  const fixedMinor = parseMoneyToMinorUnits(input.fixedAmount ?? DEFAULT_COMMISSION_FIXED_AMOUNT);
  const commissionMinor = Math.min(totalMinor, Math.round((totalMinor * rateBps) / 10_000) + fixedMinor);
  const sellerPayoutMinor = Math.max(0, totalMinor - commissionMinor);

  return {
    commission: {
      amount: formatMinorUnits(commissionMinor),
      currency: "TRY",
      rateBps,
      fixedAmount: formatMinorUnits(fixedMinor)
    },
    sellerPayout: {
      amount: formatMinorUnits(sellerPayoutMinor),
      currency: "TRY"
    }
  };
}

export function buildPaymentSimulationBoundary(): PaymentSimulationBoundary {
  return {
    realPaymentEnabled: false,
    realMoneyMovement: false,
    legalEntityReady: false,
    providerLiveReady: false,
    reason: "company_legal_and_iyzico_live_not_ready",
    copy: "Bu checkout simülasyondur. Şirket/legal kurulum ve Iyzico canlı entegrasyon hazır olmadan gerçek ödeme tahsilatı açılamaz."
  };
}

export function buildMockIyzicoPaymentSimulation(input: {
  amount: string;
  status?: PaymentAttemptStatus;
  now?: Date;
  providerAttemptId?: string;
}): {
  provider: {
    name: "mock_iyzico";
    mode: "simulation";
    livePayment: false;
    realMoneyMovement: false;
  };
  paymentAttempt: PaymentAttemptSimulation;
  commission: BabyLoopCommission;
  sellerPayout: SellerPayout;
  boundary: PaymentSimulationBoundary;
} {
  const now = input.now ?? new Date();
  const { commission, sellerPayout } = calculateBabyLoopCommission({
    totalAmount: input.amount
  });

  return {
    provider: {
      name: "mock_iyzico",
      mode: "simulation",
      livePayment: false,
      realMoneyMovement: false
    },
    paymentAttempt: {
      id: input.providerAttemptId ?? `mock-iyzico-${randomUUID()}`,
      provider: "mock_iyzico",
      providerMode: "simulation",
      status: input.status ?? "succeeded",
      livePayment: false,
      realMoneyMovement: false,
      capturedAmount: normalizeMoney(input.amount),
      currency: "TRY",
      createdAt: now.toISOString()
    },
    commission,
    sellerPayout,
    boundary: buildPaymentSimulationBoundary()
  };
}

export function getPaymentProviderReadiness(env: NodeJS.ProcessEnv = process.env): PaymentProviderReadiness {
  const requestedProvider = normalizeProviderName(env.PAYMENT_PROVIDER);
  const liveRequested = readBoolean(env.PAYMENT_LIVE_ENABLED);
  const legalReady = readBoolean(env.PAYMENT_LEGAL_ENTITY_READY);
  const iyzicoConfigured = Boolean(
    env.IYZICO_API_KEY?.trim() &&
      env.IYZICO_SECRET_KEY?.trim() &&
      env.IYZICO_WEBHOOK_SECRET?.trim()
  );

  const blockedReasons = [
    "payment_live_disabled",
    "company_legal_entity_not_ready",
    "iyzico_live_activation_requires_manual_approval"
  ];

  if (liveRequested) {
    blockedReasons.push("live_payment_requested_but_guarded");
  }

  if (requestedProvider === "iyzico" && !iyzicoConfigured) {
    blockedReasons.push("iyzico_credentials_missing");
  }

  if (!legalReady) {
    blockedReasons.push("legal_entity_required");
  }

  return {
    provider: requestedProvider,
    providerMode: liveRequested ? "blocked_live" : "simulation",
    liveRequested,
    livePaymentEnabled: false,
    realMoneyMovement: false,
    readyForLive: false,
    blockedReasons: [...new Set(blockedReasons)]
  };
}

export function validatePaymentWebhookRequest(input: {
  receivedSecret: string | string[] | undefined;
  env?: NodeJS.ProcessEnv;
}): PaymentWebhookValidation {
  const env = input.env ?? process.env;
  const configuredSecret = env.IYZICO_WEBHOOK_SECRET?.trim();

  if (!configuredSecret) {
    return {
      accepted: false,
      statusCode: 401,
      reason: "missing_webhook_secret"
    };
  }

  const receivedSecret = Array.isArray(input.receivedSecret)
    ? input.receivedSecret[0]
    : input.receivedSecret;

  if (!receivedSecret || receivedSecret !== configuredSecret) {
    return {
      accepted: false,
      statusCode: 401,
      reason: "invalid_webhook_secret"
    };
  }

  const readiness = getPaymentProviderReadiness(env);

  if (readiness.provider !== "iyzico") {
    return {
      accepted: false,
      statusCode: 403,
      reason: "iyzico_live_disabled"
    };
  }

  if (!readiness.livePaymentEnabled) {
    return {
      accepted: false,
      statusCode: 403,
      reason: "payment_live_disabled"
    };
  }

  return {
    accepted: true,
    statusCode: 202,
    reason: "webhook_skeleton_accepted"
  };
}

function normalizeProviderName(value: string | undefined): PaymentProviderName {
  const normalized = value?.trim().toLowerCase();

  return normalized === "iyzico" ? "iyzico" : "mock_iyzico";
}

function readBoolean(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function clampRateBps(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_COMMISSION_RATE_BPS;
  }

  return Math.max(0, Math.min(10_000, Math.round(value)));
}

function normalizeMoney(value: string): string {
  return formatMinorUnits(parseMoneyToMinorUnits(value));
}

function parseMoneyToMinorUnits(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.round(parsed * 100);
}

function formatMinorUnits(value: number): string {
  return (Math.max(0, value) / 100).toFixed(2);
}
