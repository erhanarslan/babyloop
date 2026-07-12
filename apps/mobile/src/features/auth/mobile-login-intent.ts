export type MobilePostLoginAction = "favorite" | "message" | "cart";

export type MobilePendingLoginIntent = {
  action: MobilePostLoginAction;
  listingId: string;
};

type BabyLoopGlobal = typeof globalThis & {
  __BABYLOOP_MOBILE_PENDING_LOGIN_INTENT__?: MobilePendingLoginIntent | null;
};

const MOBILE_LOGIN_INTENT_STORAGE_KEY = "babyloop.mobile.pendingLoginIntent.v1";

let pendingMobileLoginIntent: MobilePendingLoginIntent | null = null;

export function setPendingMobileLoginIntent(intent: MobilePendingLoginIntent): void {
  const normalizedIntent = normalizeMobileLoginIntent(intent);

  pendingMobileLoginIntent = normalizedIntent;
  getBabyLoopGlobal().__BABYLOOP_MOBILE_PENDING_LOGIN_INTENT__ = normalizedIntent;

  void writeStoredMobileLoginIntent(normalizedIntent);
}

export function peekPendingMobileLoginIntent(): MobilePendingLoginIntent | null {
  return pendingMobileLoginIntent ?? getBabyLoopGlobal().__BABYLOOP_MOBILE_PENDING_LOGIN_INTENT__ ?? null;
}

export async function getPendingMobileLoginIntent(): Promise<MobilePendingLoginIntent | null> {
  const runtimeIntent = peekPendingMobileLoginIntent();

  if (runtimeIntent) {
    return runtimeIntent;
  }

  const storedIntent = await readStoredMobileLoginIntent();

  if (storedIntent) {
    pendingMobileLoginIntent = storedIntent;
    getBabyLoopGlobal().__BABYLOOP_MOBILE_PENDING_LOGIN_INTENT__ = storedIntent;
  }

  return storedIntent;
}

export async function claimPendingMobileLoginIntent(): Promise<MobilePendingLoginIntent | null> {
  const intent = await getPendingMobileLoginIntent();

  pendingMobileLoginIntent = null;
  getBabyLoopGlobal().__BABYLOOP_MOBILE_PENDING_LOGIN_INTENT__ = null;
  await removeStoredMobileLoginIntent();

  return intent;
}

export function clearPendingMobileLoginIntent(): void {
  pendingMobileLoginIntent = null;
  getBabyLoopGlobal().__BABYLOOP_MOBILE_PENDING_LOGIN_INTENT__ = null;
  void removeStoredMobileLoginIntent();
}

export function buildMobileListingIntentRedirectPath(intent: MobilePendingLoginIntent): string {
  return `/listing/${encodeURIComponent(intent.listingId)}?postLoginAction=${encodeURIComponent(intent.action)}`;
}

function getBabyLoopGlobal(): BabyLoopGlobal {
  return globalThis as BabyLoopGlobal;
}

function normalizeMobileLoginIntent(intent: MobilePendingLoginIntent): MobilePendingLoginIntent {
  return {
    action: intent.action,
    listingId: intent.listingId
  };
}

function isMobilePostLoginAction(value: unknown): value is MobilePostLoginAction {
  return value === "favorite" || value === "message" || value === "cart";
}

function isStoredMobileLoginIntent(value: unknown): value is MobilePendingLoginIntent {
  return (
    typeof value === "object" &&
    value !== null &&
    isMobilePostLoginAction((value as { action?: unknown }).action) &&
    typeof (value as { listingId?: unknown }).listingId === "string" &&
    (value as { listingId: string }).listingId.trim().length > 0
  );
}

async function loadSecureStore(): Promise<typeof import("expo-secure-store") | null> {
  try {
    return await import("expo-secure-store");
  } catch {
    return null;
  }
}

async function readStoredMobileLoginIntent(): Promise<MobilePendingLoginIntent | null> {
  const secureStore = await loadSecureStore();

  if (!secureStore) {
    return null;
  }

  const raw = await secureStore.getItemAsync(MOBILE_LOGIN_INTENT_STORAGE_KEY).catch(() => null);

  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return isStoredMobileLoginIntent(parsed) ? normalizeMobileLoginIntent(parsed) : null;
  } catch {
    return null;
  }
}

async function writeStoredMobileLoginIntent(intent: MobilePendingLoginIntent): Promise<void> {
  const secureStore = await loadSecureStore();

  if (!secureStore) {
    return;
  }

  await secureStore.setItemAsync(
    MOBILE_LOGIN_INTENT_STORAGE_KEY,
    JSON.stringify(normalizeMobileLoginIntent(intent))
  ).catch(() => undefined);
}

async function removeStoredMobileLoginIntent(): Promise<void> {
  const secureStore = await loadSecureStore();

  if (!secureStore) {
    return;
  }

  await secureStore.deleteItemAsync(MOBILE_LOGIN_INTENT_STORAGE_KEY).catch(() => undefined);
}
