import { afterEach, describe, expect, it, vi } from "vitest";

import { requestPasswordReset, submitAuthRequest, verifyMfaLogin } from "./api";

afterEach(() => vi.restoreAllMocks());

describe("auth submit request lifecycle", () => {
  it("deduplicates the same in-flight register payload and allows a later retry", async () => {
    let resolveFirst!: (response: Response) => void;
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const fetchMock = vi.fn()
      .mockReturnValueOnce(firstResponse)
      .mockResolvedValueOnce(jsonResponse({ ok: false, error: { code: "INVALID_REQUEST", message: "invalid" } }, 400));
    vi.stubGlobal("fetch", fetchMock);
    const payload = { email: "same@example.com", password: "Password123!" };

    const first = submitAuthRequest("http://localhost:4000", "login", payload);
    const duplicate = submitAuthRequest("http://localhost:4000", "login", payload);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    resolveFirst(jsonResponse({ ok: false, error: { code: "RATE_LIMITED", message: "slow down" } }, 429, { "retry-after": "12" }));
    const [firstResult, duplicateResult] = await Promise.all([first, duplicate]);
    expect(firstResult).toBe(duplicateResult);
    expect(firstResult.retryAfterSeconds).toBe(12);

    await submitAuthRequest("http://localhost:4000", "login", payload);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps recovery requests single-flight across component remounts", async () => {
    let resolveRequest!: (response: Response) => void;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pendingResponse);
    vi.stubGlobal("fetch", fetchMock);

    const first = requestPasswordReset("http://localhost:4000", "same@example.com");
    const remountedDuplicate = requestPasswordReset("http://localhost:4000", "same@example.com");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    resolveRequest(jsonResponse({ ok: true, data: { requested: true } }, 200));
    await expect(Promise.all([first, remountedDuplicate])).resolves.toEqual([
      { ok: true, data: { requested: true } },
      { ok: true, data: { requested: true } },
    ]);
  });

  it("keeps concurrent login payloads isolated at the same endpoint", async () => {
    const pending = new Map([
      ["first@example.com", deferred<Response>()],
      ["second@example.com", deferred<Response>()],
    ]);
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { email: string };
      return pending.get(body.email)!.promise;
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = submitAuthRequest("http://localhost:4000", "login", {
      email: "first@example.com",
      password: "FirstPassword123!",
    });
    const second = submitAuthRequest("http://localhost:4000", "login", {
      email: "second@example.com",
      password: "SecondPassword123!",
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    pending.get("second@example.com")!.resolve(jsonResponse({
      ok: false,
      error: { code: "SECOND_RESULT", message: "second payload result" },
    }, 400));
    pending.get("first@example.com")!.resolve(jsonResponse({
      ok: false,
      error: { code: "FIRST_RESULT", message: "first payload result" },
    }, 401));

    await expect(Promise.all([first, second])).resolves.toMatchObject([
      { ok: false, error: { code: "FIRST_RESULT" }, httpStatus: 401 },
      { ok: false, error: { code: "SECOND_RESULT" }, httpStatus: 400 },
    ]);
  });

  it("does not merge different MFA challenge payloads", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { challengeId: string };
      return jsonResponse({
        ok: false,
        error: { code: body.challengeId, message: `${body.challengeId} result` },
      }, 400);
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await Promise.all([
      verifyMfaLogin("http://localhost:4000", "challenge-one", "111111"),
      verifyMfaLogin("http://localhost:4000", "challenge-two", "222222"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results).toEqual([
      { ok: false, error: { code: "challenge-one", message: "challenge-one result" } },
      { ok: false, error: { code: "challenge-two", message: "challenge-two result" } },
    ]);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function jsonResponse(payload: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}
