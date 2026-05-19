import { type ApiEnvelope, type Blueprint, blueprintSchema, envelopeSchema, err } from "@ava/shared-types";
import { config } from "../config";

export async function generateBlueprint(transcript: string): Promise<ApiEnvelope<Blueprint>> {
  try {
    const response = await fetch(`${config.avaBrainUrl.replace(/\/+$/, "")}/generate-blueprint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript })
    });

    const payload: unknown = await response.json();
    const parsed = envelopeSchema(blueprintSchema).safeParse(payload);

    if (!parsed.success) {
      return err("invalid_brain_envelope", "Ava Brain returned an unexpected response.", parsed.error.flatten());
    }

    return parsed.data;
  } catch (error) {
    return err("brain_network_error", "Unable to reach Ava Brain.", error);
  }
}
