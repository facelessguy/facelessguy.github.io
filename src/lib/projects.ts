import { getCollection } from "astro:content";
import { slugSchema } from "./content-schema";

export async function getPublicProjects() {
  const entries = await getCollection(
    "projects",
    ({ data }) => data.status !== "draft",
  );
  return entries
    .map(({ id, data }) => ({ slug: slugSchema.parse(id), ...data }))
    .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}
export async function getPublishedDemos() {
  const [demos, projects] = await Promise.all([
    getCollection("demos", ({ data }) => data.status === "published"),
    getCollection("projects"),
  ]);
  const published = new Set(
    projects.filter((p) => p.data.status === "published").map((p) => p.id),
  );
  for (const demo of demos) {
    slugSchema.parse(demo.id);
    if (!published.has(demo.data.project))
      throw new Error(`Demo ${demo.id} must reference a published project.`);
  }
  return demos.sort(
    (a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id),
  );
}

export async function getAllDemos() {
  const demos = await getCollection("demos");
  return demos
    .map(({ id, data }) => ({ id: slugSchema.parse(id), data }))
    .sort(
      (a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id),
    );
}
