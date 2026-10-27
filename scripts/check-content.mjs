import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import {
  projectSchema,
  demoSchema,
  slugSchema,
} from "../src/lib/content-schema.ts";
import { profile } from "../src/config/profile.ts";
if (fs.existsSync(".env")) process.loadEnvFile(".env");
const fixtures = process.env.PORTFOLIO_FIXTURES === "1";
const base = fixtures ? "tests/fixtures" : "src/content";
const publicDir = fixtures ? "tests/fixtures/public" : "public";
const release = process.argv.includes("--release");
const errors = [];
function readCollection(name, schema) {
  return fs
    .readdirSync(`${base}/${name}`)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const source = fs.readFileSync(`${base}/${name}/${file}`, "utf8");
      const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
      if (!match) throw new Error(`Missing frontmatter: ${file}`);
      return {
        slug: slugSchema.parse(file.slice(0, -3)),
        data: schema.parse(parse(match[1])),
        body: source.slice(match[0].length),
      };
    });
}
function localFile(url, label) {
  if (!url?.startsWith("/")) return;
  const scormPath = /^\/demo-assets\/scorm\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(.+)$/.exec(url);
  if (scormPath) {
    const scormRoot = fixtures ? "tests/fixtures/scorm" : "src/scorm";
    const file = path.join(scormRoot, scormPath[1], scormPath[2]);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile())
      errors.push(`${label}: missing SCORM package source ${url}`);
    return;
  }
  const candidate = path.join(publicDir, url);
  const file = url.endsWith("/")
    ? path.join(candidate, "index.html")
    : candidate;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile())
    errors.push(`${label}: missing local asset ${url}`);
}
function assetLinks(body, label) {
  for (const match of body.matchAll(/!\[[^\]]*\]\((\/[^\s)]+)(?:\s+[^)]*)?\)/g))
    localFile(match[1], label);
}
try {
  const projects = readCollection("projects", projectSchema);
  const demos = readCollection("demos", demoSchema);
  const published = projects.filter((p) => p.data.status === "published");
  const publishedDemos = demos.filter((d) => d.data.status === "published");
  for (const p of projects.filter((p) => p.data.status !== "draft")) {
    if (p.data.cover) localFile(p.data.cover.src, p.slug);
    if (p.data.status !== "published") continue;
    if (!p.body.trim()) errors.push(`${p.slug}: empty published case`);
    assetLinks(p.body, p.slug);
    if (
      p.data.demo &&
      !publishedDemos.some(
        (d) => d.slug === p.data.demo && d.data.project === p.slug,
      )
    )
      errors.push(
        `${p.slug}: demo missing, unpublished, or belongs to another project`,
      );
    // Local live links must point to a separately packaged demo/app, not a speculative route.
    localFile(p.data.links.live, p.slug);
    if (release) {
      for (const heading of [
        "Проблема",
        "Контекст",
        "Моя роль",
        "Решение",
        "Ключевые решения",
        "Реализация",
        "Результат",
      ]) {
        if (!p.body.includes(`## ${heading}`))
          errors.push(`${p.slug}: missing section ${heading}`);
      }
      if (
        /Здесь появ|TODO|ЗАПОЛНИТЬ|example\.com/i.test(
          p.body + JSON.stringify(p.data),
        )
      )
        errors.push(`${p.slug}: placeholder content`);
    }
  }
  for (const d of publishedDemos) {
    if (!published.some((p) => p.slug === d.data.project))
      errors.push(`${d.slug}: parent project is not published`);
    localFile(d.data.launch, d.slug);
    assetLinks(d.body, d.slug);
    if (d.data.format === "SCORM 1.2") {
      const root = path.join(fixtures ? "tests/fixtures/scorm" : "src/scorm", d.slug);
      const manifest = path.join(root, "imsmanifest.xml");
      if (fs.existsSync(manifest)) {
        const xml = fs.readFileSync(manifest, "utf8");
        const launch = /<resource\b[^>]*\bhref=["']([^"']+)["']/i.exec(xml)?.[1];
        if (!launch || !fs.existsSync(path.join(root, launch)))
          errors.push(`${d.slug}: SCORM manifest launch resource is missing`);
        for (const match of xml.matchAll(/<file\b[^>]*\bhref=["']([^"']+)["']/gi)) {
          const resource = path.resolve(root, match[1]);
          if (!resource.startsWith(`${path.resolve(root)}${path.sep}`) || !fs.existsSync(resource))
            errors.push(`${d.slug}: SCORM manifest references missing or unsafe file ${match[1]}`);
        }
      }
    }
    if (d.data.format === "Video") {
      if (!d.data.launch.endsWith(".m3u8")) {
        errors.push(`${d.slug}: Video demos must launch an HLS playlist`);
      } else {
        const playlistFile = path.join(publicDir, d.data.launch);
        if (fs.existsSync(playlistFile)) {
          const playlist = fs.readFileSync(playlistFile, "utf8");
          const playlistDir = path.dirname(playlistFile);
          const segments = playlist
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("#"));
          if (!segments.length) errors.push(`${d.slug}: HLS playlist has no segments`);
          for (const segment of segments) {
            const file = path.resolve(playlistDir, segment);
            if (!file.startsWith(`${path.resolve(playlistDir)}${path.sep}`) || !fs.existsSync(file)) {
              errors.push(`${d.slug}: missing or unsafe HLS segment ${segment}`);
              continue;
            }
            if (fs.statSync(file).size > 25 * 1024 * 1024)
              errors.push(`${d.slug}: HLS segment exceeds Cloudflare Pages 25 MiB limit`);
          }
        }
      }
    }
  }
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (fs.statSync(full).size > 25 * 1024 * 1024)
        errors.push(`${full}: exceeds Cloudflare Pages 25 MiB asset limit`);
    }
  }
  walk(publicDir);
  for (const link of profile.links) {
    if (!link.label.trim() || !/^https:\/\//.test(link.url))
      errors.push("Profile links require labels and HTTPS URLs.");
  }
  if (release) {
    if (fixtures) errors.push("Fixtures cannot be released.");
    let url;
    try {
      url = new URL(process.env.SITE_URL);
    } catch {}
    if (
      !url ||
      url.protocol !== "https:" ||
      url.pathname !== "/" ||
      /example\.|localhost|127\.0\.0\.1/.test(url.hostname)
    )
      errors.push("Set SITE_URL to the real HTTPS site origin.");
    if (!profile.name.trim()) errors.push("Fill profile.name.");
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email) ||
      /example\./.test(profile.email)
    )
      errors.push("Fill profile.email with a real contact.");
    if (!profile.bio.trim()) errors.push("Fill profile.bio.");
    if (published.length < 2)
      errors.push(
        `Two real published cases required; found ${published.length}.`,
      );
    if (!publishedDemos.length)
      errors.push("At least one real published demo required.");
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    `Content OK: ${published.length} published projects, ${publishedDemos.length} published demos${release ? " — ready for release" : ""}.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
