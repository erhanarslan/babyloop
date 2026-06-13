"use client";

import {
  type RealtimeClientToServerEvents,
  type RealtimeServerToClientEvents
} from "@babyloop/shared";
import { io, type Socket } from "socket.io-client";
import { AUTH_SESSION_ENDED_EVENT } from "./auth-client";

export type BabyloopRealtimeSocket = Socket<
  RealtimeServerToClientEvents,
  RealtimeClientToServerEvents
>;

let activeSocket: BabyloopRealtimeSocket | null = null;
let activeApiBaseUrl: string | null = null;
let activeAccessToken: string | null = null;

export function getRealtimeSocket(
  apiBaseUrl: string,
  accessToken: string | null
): BabyloopRealtimeSocket {
  if (
    activeSocket &&
    activeApiBaseUrl === apiBaseUrl &&
    activeAccessToken === accessToken
  ) {
    return activeSocket;
  }

  disconnectRealtimeSocket();

  activeSocket = io(apiBaseUrl, {
    ...(accessToken
      ? {
          auth: {
            token: accessToken
          }
        }
      : {}),
    reconnection: true,
    transports: ["websocket", "polling"],
    withCredentials: true
  });
  activeApiBaseUrl = apiBaseUrl;
  activeAccessToken = accessToken;

  activeSocket.on("connect_error", () => {
    // REST remains the source of truth; socket failures should not interrupt the UI.
  });

  return activeSocket;
}

export function disconnectRealtimeSocket(): void {
  if (activeSocket) {
    activeSocket.disconnect();
  }

  activeSocket = null;
  activeApiBaseUrl = null;
  activeAccessToken = null;
}

if (typeof window !== "undefined") {
  window.addEventListener(AUTH_SESSION_ENDED_EVENT, disconnectRealtimeSocket);
}
