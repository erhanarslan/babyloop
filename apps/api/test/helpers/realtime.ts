import {
  REALTIME_EVENTS,
  type RealtimeClientToServerEvents,
  type RealtimeErrorPayload,
  type RealtimeServerToClientEvents,
  realtimeConversationRoom
} from "@babyloop/shared";
import type { AddressInfo } from "node:net";
import { io as createSocket, type Socket as ClientSocket } from "socket.io-client";
import type { TestApp } from "./app.js";

export type TestRealtimeSocket = ClientSocket<
  RealtimeServerToClientEvents,
  RealtimeClientToServerEvents
>;

export function getListeningBaseUrl(app: TestApp): string {
  const address = app.server.address();

  if (!address || typeof address === "string") {
    throw new Error("Test app did not listen on a TCP address.");
  }

  return `http://127.0.0.1:${(address as AddressInfo).port}`;
}

export async function connectRealtimeSocket(
  apiBaseUrl: string,
  accessToken: string
): Promise<TestRealtimeSocket> {
  const socket: TestRealtimeSocket = createSocket(apiBaseUrl, {
    auth: {
      token: accessToken
    },
    forceNew: true,
    reconnection: false,
    transports: ["websocket"],
    withCredentials: true
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Socket connection timed out."));
    }, 2_000);

    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timeout);
      socket.disconnect();
      reject(error);
    });
  });

  return socket;
}

export async function expectUnauthenticatedSocketRejected(apiBaseUrl: string): Promise<void> {
  const socket: TestRealtimeSocket = createSocket(apiBaseUrl, {
    forceNew: true,
    reconnection: false,
    transports: ["websocket"],
    withCredentials: true
  });

  const error = await new Promise<Error & { data?: RealtimeErrorPayload }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Unauthenticated socket was not rejected."));
    }, 2_000);

    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.disconnect();
      reject(new Error("Unauthenticated socket connected."));
    });
    socket.once("connect_error", (connectError) => {
      clearTimeout(timeout);
      socket.disconnect();
      resolve(connectError as Error & { data?: RealtimeErrorPayload });
    });
  });

  if (error.data?.code !== "AUTH_REQUIRED") {
    throw new Error(`Expected AUTH_REQUIRED socket error, got ${error.data?.code ?? "unknown"}.`);
  }
}

export function onceSocketEvent<TPayload>(
  socket: TestRealtimeSocket,
  eventName: keyof RealtimeServerToClientEvents,
  timeoutMilliseconds = 2_000
): Promise<TPayload> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timed out waiting for realtime event ${String(eventName)}.`));
    }, timeoutMilliseconds);
    const handler = (payload: unknown) => {
      clearTimeout(timeout);
      resolve(payload as TPayload);
    };

    socket.once(eventName, handler);
  });
}

export async function waitForConversationRoomSize(
  app: TestApp,
  conversationId: string,
  expectedSize: number
): Promise<void> {
  const roomName = realtimeConversationRoom(conversationId);
  const deadline = Date.now() + 2_000;

  while (Date.now() < deadline) {
    const roomSize = app.realtime?.io.sockets.adapter.rooms.get(roomName)?.size ?? 0;

    if (roomSize >= expectedSize) {
      return;
    }

    await delay(20);
  }

  throw new Error(`Conversation room ${roomName} did not reach size ${expectedSize}.`);
}

export function disconnectSockets(...sockets: TestRealtimeSocket[]): void {
  for (const socket of sockets) {
    socket.disconnect();
  }
}

export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export { REALTIME_EVENTS };
