import { z } from "zod";

export const tags = [
  "Product",
  "Development",
  "E-learning",
  "LMS",
  "Automation",
  "AI",
] as const;
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const publicLink = z.string().refine((value) => {
  if (/^\/(?!\/)[a-zA-Z0-9/_\-.]+$/.test(value))
    return !value.split("/").includes("..");
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Use an absolute site path or HTTPS URL.");
const cover = z.object({
  src: publicLink,
  alt: z.string().trim().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export const projectSchema = z
  .object({
    title: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    disciplines: z.array(z.enum(tags)).min(1),
    kind: z.enum(["case", "demo", "experiment"]).default("case"),
    status: z.enum(["draft", "coming-soon", "published"]).default("draft"),
    year: z.number().int().min(1990).max(2100),
    order: z.number().int().default(99),
    featured: z.boolean().default(false),
    role: z.string().default(""),
    technologies: z.array(z.string().min(1)).default([]),
    cover: cover.optional(),
    demo: slugSchema.optional(),
    links: z
      .object({
        live: publicLink.optional(),
        source: z.url({ protocol: /^https$/ }).optional(),
      })
      .default({}),
  })
  .superRefine((data, context) => {
    if (data.status === "published") {
      if (!data.role.trim())
        context.addIssue({
          code: "custom",
          message: "Published projects require an author role.",
          path: ["role"],
        });
      if (!data.cover)
        context.addIssue({
          code: "custom",
          message: "Published projects require a real cover.",
          path: ["cover"],
        });
    }
  });
export const demoSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  status: z.enum(["draft", "published"]).default("draft"),
  project: slugSchema,
  launch: publicLink,
  format: z.enum(["HTML5", "SCORM 1.2", "iSpring", "Web app", "API", "Video"]),
  duration: z.string().optional(),
  requirements: z
    .string()
    .default("Современный браузер. Прогресс между посещениями не сохраняется."),
  completionSupported: z.boolean().default(false),
  order: z.number().int().default(99),
});
export type ProjectData = z.infer<typeof projectSchema>;
export type ProjectCard = ProjectData & { slug: string };
export type DemoData = z.infer<typeof demoSchema>;
