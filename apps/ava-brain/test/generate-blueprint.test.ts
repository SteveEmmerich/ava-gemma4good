import { describe, expect, test } from "bun:test";
import worker, { handleGenerateBlueprint } from "../src";

const validBlueprint = {
  name: "Launch Helper",
  description: "Helps plan and launch a small product.",
  persona: {
    tone: "calm and direct",
    boundaries: ["No legal advice"]
  },
  triggers: ["User asks about launch planning"],
  actions: [
    {
      id: "draft-plan",
      label: "Draft launch plan",
      type: "workflow",
      config: { steps: ["position", "ship", "review"] }
    }
  ],
  metadata: {
    source: "transcript",
    generatedAt: "2026-05-13T13:00:00.000Z"
  }
};

const request = (body: unknown) =>
  new Request("https://ava-brain.example/generate-blueprint", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" }
  });

describe("ava-brain", () => {
  test("transforms a transcript into valid blueprint JSON", async () => {
    const response = await handleGenerateBlueprint(request({ transcript: "Build me a launch planning agent." }), {
      BLUEPRINT_MODEL: "@cf/test/model",
      MOCK_BLUEPRINTS: "false",
      AI: {
        run: async () => ({ response: JSON.stringify(validBlueprint) })
      }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: validBlueprint });
  });

  test("returns structured errors for malformed model output", async () => {
    const response = await handleGenerateBlueprint(request({ transcript: "hello" }), {
      BLUEPRINT_MODEL: "@cf/test/model",
      MOCK_BLUEPRINTS: "false",
      AI: {
        run: async () => ({ response: JSON.stringify({ name: "" }) })
      }
    });

    expect(response.status).toBe(502);
    const payload = await response.json();
    expect(payload).toMatchObject({
      success: false,
      error: { code: "invalid_blueprint" }
    });
  });

  test("accepts fenced JSON from the model before schema validation", async () => {
    const response = await handleGenerateBlueprint(request({ transcript: "hello" }), {
      BLUEPRINT_MODEL: "@cf/test/model",
      MOCK_BLUEPRINTS: "false",
      AI: {
        run: async () => ({ response: `Here is the blueprint:\n\`\`\`json\n${JSON.stringify(validBlueprint)}\n\`\`\`` })
      }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: validBlueprint });
  });

  test("accepts response objects from Workers AI JSON mode", async () => {
    const response = await handleGenerateBlueprint(request({ transcript: "hello" }), {
      BLUEPRINT_MODEL: "@cf/test/model",
      MOCK_BLUEPRINTS: "false",
      AI: {
        run: async () => ({ response: validBlueprint })
      }
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: validBlueprint });
  });

  test("has no persistence dependency in the request path", async () => {
    const envKeys: string[] = [];

    const response = await handleGenerateBlueprint(request({ transcript: "Make an agent." }), {
      get BLUEPRINT_MODEL() {
        envKeys.push("BLUEPRINT_MODEL");
        return "@cf/test/model";
      },
      MOCK_BLUEPRINTS: "false",
      get AI() {
        envKeys.push("AI");
        return {
          run: async () => validBlueprint
        };
      }
    });

    expect(response.status).toBe(200);
    expect(envKeys.sort()).toEqual(["AI", "BLUEPRINT_MODEL"]);
  });

  test("only exposes POST /generate-blueprint", async () => {
    const response = await worker.fetch(new Request("https://ava-brain.example/health"), {
      BLUEPRINT_MODEL: "@cf/test/model",
      MOCK_BLUEPRINTS: "false",
      AI: { run: async () => validBlueprint }
    });

    expect(response.status).toBe(404);
  });

  test("answers browser CORS preflight for blueprint generation", async () => {
    const response = await worker.fetch(
      new Request("https://ava-brain.example/generate-blueprint", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:8082",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type"
        }
      }),
      {
        BLUEPRINT_MODEL: "@cf/test/model",
        MOCK_BLUEPRINTS: "false",
        AI: { run: async () => validBlueprint }
      }
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  test("can generate a local mock blueprint for development", async () => {
    const response = await handleGenerateBlueprint(request({ transcript: "Summarize customer emails." }), {
      BLUEPRINT_MODEL: "@cf/test/model",
      MOCK_BLUEPRINTS: "true",
      AI: {
        run: async () => {
          throw new Error("should not call AI in mock mode");
        }
      }
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      success: true,
      data: {
        name: "Drafted Ava Agent",
        metadata: { source: "transcript" }
      }
    });
  });
});
