import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { createReadStream, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
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
const demoDir =
  process.env.PORTFOLIO_FIXTURES === "1"
    ? "tests/fixtures/demos"
    : "src/content/demos";
const hasLms = readdirSync(demoDir)
  .filter((file) => file.endsWith(".md"))
  .some((file) => {
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(
      readFileSync(`${demoDir}/${file}`, "utf8"),
    );
    const data = frontmatter ? parse(frontmatter[1]) : {};
    return data.status === "published" && data.format === "SCORM 1.2";
  });
const publishedScormDemos = new Set(
  readdirSync(demoDir)
    .filter((file) => file.endsWith(".md"))
    .filter((file) => {
      const source = readFileSync(`${demoDir}/${file}`, "utf8");
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
      const data = frontmatter ? parse(frontmatter[1]) : {};
      return data.status === "published" && data.format === "SCORM 1.2";
    })
    .map((file) => file.slice(0, -3)),
);
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
    {
      name: "copy-published-scorm-packages",
      hooks: {
        "astro:server:setup"({ server }) {
          const packageRoot = process.env.PORTFOLIO_FIXTURES === "1"
            ? resolve("tests/fixtures/scorm")
            : resolve("src/scorm");
          const types = {
            ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
            ".mp3": "audio/mpeg", ".png": "image/png", ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml",
            ".xml": "application/xml; charset=utf-8", ".xsd": "application/xml; charset=utf-8",
          };
          server.middlewares.use((request, response, next) => {
            if (!request.url?.startsWith("/demo-assets/scorm/")) return next();
            if (request.method !== "GET" && request.method !== "HEAD") {
              response.statusCode = 405;
              response.end("Method Not Allowed");
              return;
            }
            let pathname;
            try {
              pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
            } catch {
              response.statusCode = 400;
              response.end("Bad Request");
              return;
            }
            const match = /^\/demo-assets\/scorm\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(.+)$/.exec(pathname);
            if (!match || !publishedScormDemos.has(match[1])) return next();
            const asset = match[2];
            if (asset.split("/").some((part) => !part || part.startsWith("."))) return next();
            const root = resolve(packageRoot, match[1]);
            const file = resolve(root, asset);
            const fromRoot = relative(root, file);
            if (!fromRoot || fromRoot.startsWith(`..${sep}`) || !existsSync(file) || !statSync(file).isFile()) return next();
            response.statusCode = 200;
            response.setHeader("Content-Type", types[extname(file).toLowerCase()] ?? "application/octet-stream");
            response.setHeader("Content-Length", statSync(file).size);
            response.setHeader("Cache-Control", "no-store");
            if (request.method === "HEAD") response.end();
            else createReadStream(file).pipe(response);
          });
        },
        "astro:build:done"({ dir }) {
          const output = fileURLToPath(dir);
          for (const file of readdirSync(demoDir).filter((name) => name.endsWith(".md"))) {
            const source = readFileSync(`${demoDir}/${file}`, "utf8");
            const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
            const data = frontmatter ? parse(frontmatter[1]) : {};
            if (data.status !== "published" || data.format !== "SCORM 1.2") continue;
            const packageRoot = process.env.PORTFOLIO_FIXTURES === "1"
              ? `tests/fixtures/scorm/${file.slice(0, -3)}`
              : `src/scorm/${file.slice(0, -3)}`;
            if (!existsSync(`${packageRoot}/imsmanifest.xml`)) continue;
            const destination = `${output}demo-assets/scorm/${file.slice(0, -3)}`;
            mkdirSync(destination, { recursive: true });
            cpSync(packageRoot, destination, {
              recursive: true,
              filter: (path) => !path.endsWith(".DS_Store"),
            });
          }
        },
      },
    },
    ...(site
      ? [
          sitemap({
            filter: (page) =>
              (hasLab || !page.endsWith("/lab/")) &&
              (hasLms || !page.endsWith("/lms/")) &&
              !page.endsWith("/404/"),
          }),
        ]
      : []),
  ],
});
