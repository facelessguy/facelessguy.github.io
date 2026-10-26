import { readFile } from "node:fs/promises";
import { getPublishedScormDemos, getScormPackageFile } from "../../../../lib/scorm-packages";

export async function getStaticPaths() {
  const demos = await getPublishedScormDemos();
  return demos
    .filter(({ id }) => getScormPackageFile(id, "index.html"))
    .map(({ id }) => ({ params: { course: id } }));
}

export async function GET({ params }: { params: { course?: string } }) {
  const file = params.course && getScormPackageFile(params.course, "index.html");
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(await readFile(file, "utf8"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
