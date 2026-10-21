import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { parse } from "yaml";
if (existsSync(".env")) process.loadEnvFile(".env");
const contentDir =
  process.env.PORTFOLIO_FIXTURES === "1"
    ? "tests/fixtures/projects"
    : "src/content/projects";
const hasLab = readdirSync(contentDir)
  .filter((file) => file.endsWith(".md"))
  .some((file) => {
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(
      readFileSync(`${contentDir}/${file}`, "utf8"),
    );
    const data = frontmatter ? parse(frontmatter[1]) : {};
    return data.kind === "experiment" && data.status === "published";
  });
const site = process.env.SITE_URL || undefined;
if (
  site &&
  (new URL(site).protocol !== "https:" ||
    new URL(site).pathname !== "/" ||
    new URL(site).username ||
    new URL(site).password ||
    new URL(site).search ||
    new URL(site).hash)
)
  throw new Error("SITE_URL must be an HTTPS origin without a path.");
export default defineConfig({
  site,
  output: "static",
  trailingSlash: "always",
  devToolbar: { enabled: false },
  ...(process.env.PORTFOLIO_FIXTURES === "1"
    ? {
        outDir: "./.test-dist",
        cacheDir: "./.astro-test",
        publicDir: "./tests/fixtures/public",
      }
    : {}),
  integrations: [
    react(),
    ...(site
      ? [
          sitemap({
            filter: (page) =>
              (hasLab || !page.endsWith("/lab/")) && !page.endsWith("/404/"),
          }),
        ]
      : []),
  ],
});
