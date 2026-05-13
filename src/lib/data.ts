import { z } from "zod";
import publishersJson from "../../data/publishers.json";
import personasJson from "../../data/shopper_personas.json";
import { PublisherSchema, type Publisher } from "@/schemas/publisher";
import { PersonaSchema, type Persona } from "@/schemas/persona";

/**
 * Reference data — validated at module load so a bad data file is a startup error,
 * not a confusing failure deep inside a pipeline stage.
 */
export const publishers: readonly Publisher[] = Object.freeze(
  z.array(PublisherSchema).parse(publishersJson),
);

export const personas: readonly Persona[] = Object.freeze(
  z.array(PersonaSchema).parse(personasJson),
);

export const publisherById = new Map(publishers.map((p) => [p.id, p]));
export const personaById = new Map(personas.map((p) => [p.id, p]));
