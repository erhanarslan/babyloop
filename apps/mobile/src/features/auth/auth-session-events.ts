import { DeviceEventEmitter } from "react-native";

const MOBILE_AUTH_SESSIONS_REFRESH_REQUESTED = "babyloop:auth-sessions-refresh-requested";

export function requestMobileAuthSessionsRefresh(): void {
  DeviceEventEmitter.emit(MOBILE_AUTH_SESSIONS_REFRESH_REQUESTED);
}

export function addMobileAuthSessionsRefreshListener(listener: () => void): () => void {
  const subscription = DeviceEventEmitter.addListener(MOBILE_AUTH_SESSIONS_REFRESH_REQUESTED, listener);

  return () => {
    subscription.remove();
  };
}
