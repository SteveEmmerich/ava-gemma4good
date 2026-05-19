import { z } from "zod";

export const blueprintActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["message", "workflow", "integration", "memory", "notification"]),
  config: z.record(z.string(), z.unknown()).default({})
});

export const blueprintSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(600),
  persona: z.object({
    tone: z.string().min(1),
    boundaries: z.array(z.string()).default([])
  }),
  triggers: z.array(z.string().min(1)).default([]),
  actions: z.array(blueprintActionSchema).min(1),
  metadata: z.object({
    source: z.literal("transcript"),
    generatedAt: z.string().datetime()
  })
});

export type Blueprint = z.infer<typeof blueprintSchema>;
export type BlueprintAction = z.infer<typeof blueprintActionSchema>;
