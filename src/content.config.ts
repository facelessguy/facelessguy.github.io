import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { projectSchema, demoSchema } from "./lib/content-schema";
const fixtureMode = process.env.PORTFOLIO_FIXTURES === "1";
export const collections = {
  projects: defineCollection({
    loader: glob({
      pattern: "*.md",
      base: fixtureMode
        ? "./tests/fixtures/projects"
        : "./src/content/projects",
    }),
    schema: projectSchema,
  }),
  demos: defineCollection({
    loader: glob({
      pattern: "*.md",
      base: fixtureMode ? "./tests/fixtures/demos" : "./src/content/demos",
    }),
    schema: demoSchema,
  }),
};
