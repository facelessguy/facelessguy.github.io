import { spawnSync } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
const env = {
  ...process.env,
  PORTFOLIO_FIXTURES: "1",
  SITE_URL: "https://portfolio.test",
  ASTRO_TELEMETRY_DISABLED: "1",
};
function run(args) {
  const r = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status || 1);
}
run(["scripts/check-content.mjs"]);
run(["node_modules/astro/bin/astro.mjs", "build"]);
const root = ".test-dist";
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
for (const file of [
  "index.html",
  "projects/index.html",
  "projects/course/index.html",
  "projects/experiment/index.html",
  "demos/index.html",
  "demos/test-course/index.html",
  "lms/index.html",
  "lms/test-course/index.html",
  "demo-assets/scorm/test-course/index.html",
  "demo-assets/scorm/test-course/imsmanifest.xml",
  "demo-assets/scorm/test-course/runtime.js",
  "lab/index.html",
  "404.html",
  "robots.txt",
  "sitemap-index.xml",
])
  assert.ok(fs.existsSync(path.join(root, file)), file);
assert.equal(fs.existsSync(`${root}/projects/secret`), false);
assert.equal(fs.existsSync(`${root}/projects/coming`), false);
assert.equal(fs.existsSync(`${root}/lms/draft-scorm/index.html`), false);
assert.equal(fs.existsSync(`${root}/demo-assets/scorm/draft-scorm/index.html`), false);
assert.match(read("projects/course/index.html"), /Моя роль/);
assert.match(
  read("index.html"),
  /property="og:image" content="https:\/\/portfolio.test\/og.png"/,
);
assert.doesNotMatch(read("projects/course/index.html"), /property="og:image"/);
assert.match(read("sitemap-0.xml"), /https:\/\/portfolio.test\/lab\//);
assert.match(read("sitemap-0.xml"), /https:\/\/portfolio.test\/lms\//);
assert.match(
  read("projects/course/index.html"),
  /href="\/demos\/test-course\/"/,
);
assert.match(
  read("demos/test-course/index.html"),
  /href="\/lms\/test-course\/"/,
);
assert.match(read("projects/index.html"), /Черновой SCORM-курс для проверки списка/);
assert.match(read("projects/index.html"), /В подготовке/);
assert.match(read("projects/index.html"), /<h1 class="page-title">Каталог демо<\/h1>/);
assert.doesNotMatch(read("projects/index.html"), /href="\/demos\/draft-scorm\//);
assert.doesNotMatch(read("projects/index.html"), /href="\/lms\/draft-scorm\//);
assert.match(read("lms/test-course/index.html"), /data-course-frame/);
assert.match(read("lms/test-course/index.html"), /SCORM 1\.2/);
assert.doesNotMatch(read("lms/index.html"), /Учиться\.|Пробовать\./);
assert.match(read("demo-assets/scorm/test-course/imsmanifest.xml"), /adlcp:scormtype="sco"/);
assert.match(read("demo-assets/scorm/test-course/runtime.js"), /fixtureScormPackageAsset/);
assert.match(read("index.html"), /href="\/lab\/"/);
assert.match(read("index.html"), /href="\/projects\/" class="button">Смотреть демо/);
const mainNav = /<nav aria-label="Основная навигация">([\s\S]*?)<\/nav>/.exec(read("index.html"))?.[1] ?? "";
assert.doesNotMatch(mainNav, /Демо|Мини.?LMS|Обо мне/);
assert.doesNotMatch(read("index.html"), /О подходе|От вопроса к проверке/);
assert.doesNotMatch(read("index.html"), /Следующий шаг|Обсудить задачу|href="#contact"/);
assert.doesNotMatch(read("index.html"), /01 \/ Понять|02 \/ Спроектировать|03 \/ Собрать|04 \/ Проверить/);
assert.doesNotMatch(read("index.html"), /Избранные работы/);
assert.doesNotMatch(read("projects/index.html"), /От контекста|В каждом кейсе|Демонстрации|Попробовать/);
assert.match(read("projects/index.html"), /Тестовый учебный интерактив/);
assert.match(
  read("projects/course/index.html"),
  /https:\/\/portfolio.test\/projects\/course\//,
);
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
}
for (const file of walk(root).filter((f) => /\.(html|js|json|xml)$/.test(f)))
  assert.doesNotMatch(
    fs.readFileSync(file, "utf8"),
  /DRAFT_(TITLE|SUMMARY|BODY)_MUST_NOT_LEAK|COMING_BODY_MUST_NOT_LEAK|BODY_DRAFT_SCORM_MUST_NOT_LEAK/,
    file,
  );
for (const file of walk(root).filter((f) => f.endsWith(".html"))) {
  for (const match of fs
    .readFileSync(file, "utf8")
    .matchAll(/(?:href|src)="(\/(?!\/)[^"#?]*)(?:[?#][^"]*)?"/g)) {
    const target = path.join(root, decodeURI(match[1]));
    assert.ok(fs.existsSync(target), `${file}: broken local link ${match[1]}`);
  }
}
console.log(
  "Site integration checks passed: routes, project draft isolation, complete demo catalogue, SCORM package gating, assets, canonical URLs.",
);
