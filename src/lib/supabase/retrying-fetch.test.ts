import { describe, expect, it, vi } from "vitest";
import { createRetryingFetch } from "./retrying-fetch";

describe("createRetryingFetch", () => {
  it("retries temporary TypeError fetch failures with bounded backoff", async () => {
    const fetchImplementation = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Load failed"))
      .mockResolvedValueOnce(new Response("ok"));
    const wait = vi.fn().mockResolvedValue(undefined);
    const fetchWithRetry = createRetryingFetch(fetchImplementation, wait);

    const response = await fetchWithRetry("https://example.test/tasks");

    expect(await response.text()).toBe("ok");
    expect(fetchImplementation).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[250], [500]]);
  });

  it("does not retry a successful HTTP response or a non-network exception", async () => {
    const response = new Response("server error", { status: 500 });
    const fetchImplementation = vi.fn().mockResolvedValue(response);
    const wait = vi.fn();
    await expect(createRetryingFetch(fetchImplementation, wait)("https://example.test"))
      .resolves.toBe(response);
    expect(fetchImplementation).toHaveBeenCalledOnce();
    expect(wait).not.toHaveBeenCalled();

    const invalidRequest = vi.fn().mockRejectedValue(new TypeError("Invalid URL"));
    await expect(createRetryingFetch(invalidRequest, wait)("bad url")).rejects.toThrow("Invalid URL");
    expect(invalidRequest).toHaveBeenCalledOnce();
  });

  it("rethrows after the final failed attempt", async () => {
    const failure = new TypeError("Failed to fetch");
    const fetchImplementation = vi.fn().mockRejectedValue(failure);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(createRetryingFetch(fetchImplementation, wait)("https://example.test"))
      .rejects.toBe(failure);
    expect(fetchImplementation).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[250], [500]]);
  });
});
