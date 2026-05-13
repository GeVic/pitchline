import { z } from "zod";

export const PublisherPickSchema = z.object({
  publisher_id: z.string(),
  score: z.number().min(0).max(1),
  reason: z.string(),
});

export const PublisherRejectionSchema = z.object({
  publisher_id: z.string(),
  reason: z.string(),
});

/**
 * Stage 2 output. Publishers selected + considered-and-rejected, both with reasoning.
 */
export const MatchSchema = z.object({
  picked: z.array(PublisherPickSchema).min(1),
  rejected: z.array(PublisherRejectionSchema),
});

export type PublisherPick = z.infer<typeof PublisherPickSchema>;
export type PublisherRejection = z.infer<typeof PublisherRejectionSchema>;
export type Match = z.infer<typeof MatchSchema>;
