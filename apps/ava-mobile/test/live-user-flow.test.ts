import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const liveTest = process.env.LIVE_AVA_TESTS === "true" ? test : test.skip;
const appUrl = process.env.AVA_WEB_URL ?? "http://localhost:8081";

describe("live user-facing flow", () => {
  liveTest("uses the public mobile/web input to create a fresh Ava", async () => {
    const pageResponse = await fetch(appUrl);
    expect(pageResponse.ok).toBe(true);

    const window = new Window({
      url: appUrl,
      settings: {
        disableJavaScriptEvaluation: false,
        fetch: {
          virtualServers: []
        }
      }
    });

    window.fetch = (((input: unknown, init: unknown) => {
      const url = typeof input === "string" ? new URL(input, appUrl).toString() : input;
      return fetch(url as Parameters<typeof fetch>[0], init as Parameters<typeof fetch>[1]);
    }) as unknown) as typeof window.fetch;
    window.document.write(await pageResponse.text());
    window.document.close();
    for (const script of Array.from(window.document.getElementsByTagName("script"))) {
      new Function("window", "document", "fetch", script.textContent ?? "").call(
        window,
        window,
        window.document,
        window.fetch
      );
    }

    const transcript = window.document.getElementById("transcript") as HTMLTextAreaElement | null;
    const create = window.document.getElementById("create") as HTMLButtonElement | null;
    const result = window.document.getElementById("result") as HTMLElement | null;

    expect(transcript).toBeTruthy();
    expect(create).toBeTruthy();
    expect(result).toBeTruthy();

    transcript!.value =
      "Build an assistant for a neighborhood food pantry that summarizes intake notes, drafts follow-up texts, tracks dietary preferences, and asks staff before sending.";
    transcript!.dispatchEvent(new window.Event("input", { bubbles: true }) as unknown as Event);
    create!.click();

    await waitFor(
      () =>
        result!.textContent?.includes("Staging agent") === true ||
        result!.textContent?.includes("Try again") === true,
      120_000,
      () => result!.textContent ?? ""
    );

    const text = result!.textContent ?? "";
    expect(text).toContain("Staging agent");
    expect(text).toContain("Tier");
    expect(text).toContain("Token");
    expect(text).toContain("Claim URL");
    expect(text).not.toContain("Try again");

    window.close();
  }, 150_000);
});

async function waitFor(assertion: () => boolean, timeoutMs: number, debugText: () => string): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (assertion()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for live user flow to complete. Last UI text: ${debugText().slice(0, 500)}`);
}
