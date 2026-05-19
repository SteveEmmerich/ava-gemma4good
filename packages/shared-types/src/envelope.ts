import { z } from "zod";

export const errorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional()
});

export type ApiError = z.infer<typeof errorSchema>;

export const successEnvelopeSchema = <T extends z.ZodType>(data: T) =>
  z.object({
    success: z.literal(true),
    data
  });

export const errorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: errorSchema
});

export const envelopeSchema = <T extends z.ZodType>(data: T) =>
  z.discriminatedUnion("success", [successEnvelopeSchema(data), errorEnvelopeSchema]);

export type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

export const ok = <T>(data: T): ApiEnvelope<T> => ({ success: true, data });

export const err = (code: string, message: string, details?: unknown): ApiEnvelope<never> => ({
  success: false,
  error: details === undefined ? { code, message } : { code, message, details }
});
