import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { getPublishedDemos } from "./projects";

export async function getPublishedScormDemos() {
  return (await getPublishedDemos()).filter(
    ({ id, data }) =>
      data.format === "SCORM 1.2" &&
      Boolean(getScormPackageFile(id, "imsmanifest.xml")) &&
      Boolean(getScormPackageFile(id, getScormLaunchFile(id))),
  );
}

export function getScormPackageFile(courseId: string, filename: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(courseId)) return undefined;
  if (!filename || filename.startsWith("/") || filename.includes("\\")) return undefined;
  const root =
    process.env.PORTFOLIO_FIXTURES === "1"
      ? resolve("tests/fixtures/scorm", courseId)
      : resolve("src/scorm", courseId);
  const file = resolve(root, filename);
  const pathFromRoot = relative(root, file);
  return pathFromRoot && !pathFromRoot.startsWith(`..${sep}`) && existsSync(file) ? file : undefined;
}

export function getScormLaunchFile(courseId: string) {
  const manifest = getScormPackageFile(courseId, "imsmanifest.xml");
  if (!manifest) return "index.html";
  const xml = readFileSync(manifest, "utf8");
  const href = /<resource\b[^>]*\bhref=["']([^"']+)["']/i.exec(xml)?.[1];
  return href && !href.startsWith("/") && !href.includes("..") ? href : "index.html";
}

export function getScormPackageFiles(courseId: string) {
  const root = process.env.PORTFOLIO_FIXTURES === "1"
    ? resolve("tests/fixtures/scorm", courseId)
    : resolve("src/scorm", courseId);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(courseId) || !existsSync(root)) return [];
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === ".DS_Store") continue;
      const absolute = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else files.push(relative(root, absolute).split(sep).join("/"));
    }
  };
  walk(root);
  return files;
}
