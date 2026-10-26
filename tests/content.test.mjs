import { test } from "node:test";
import assert from "node:assert/strict";
import {
  projectSchema,
  publicLink,
  demoSchema,
} from "../src/lib/content-schema.ts";
const base = {
  title: "Курс",
  summary: "Учебная задача",
  disciplines: ["E-learning"],
  year: 2026,
};
test("new content defaults to draft", () =>
  assert.equal(projectSchema.parse(base).status, "draft"));
test("publication requires real cover and author role", () => {
  assert.equal(
    projectSchema.safeParse({ ...base, status: "published" }).success,
    false,
  );
  assert.equal(
    projectSchema.safeParse({
      ...base,
      status: "published",
      role: "Разработчик",
      cover: {
        src: "/media/course.png",
        alt: "Экран курса",
        width: 1200,
        height: 750,
      },
    }).success,
    true,
  );
});
test("rejects dangerous and ambiguous links", () => {
  for (const value of [
    "javascript:alert(1)",
    "//evil.test",
    "/foo/../secret",
    "/foo\\bar",
    "http://example.com",
    "https://user:password@example.com",
  ])
    assert.equal(publicLink.safeParse(value).success, false, value);
  for (const value of [
    "/demo-assets/course/index.html",
    "https://demo.test/course/",
  ])
    assert.equal(publicLink.safeParse(value).success, true, value);
});
test("demo ids cannot escape routes", () =>
  assert.equal(
    demoSchema.safeParse({
      title: "Demo",
      summary: "Demo",
      project: "../private",
      launch: "/course/",
      format: "HTML5",
    }).success,
    false,
  ));
test("SCORM 1.2 is an accepted demo format", () =>
  assert.equal(
    demoSchema.safeParse({
      title: "Курс",
      summary: "SCORM демо",
      project: "course",
      launch: "/demo-assets/scorm/course/index.html",
      format: "SCORM 1.2",
    }).success,
    true,
  ));
test("cover requires an accessible description and positive dimensions", () =>
  assert.equal(
    projectSchema.safeParse({
      ...base,
      cover: { src: "/a.png", alt: "", width: 0, height: 20 },
    }).success,
    false,
  ));
