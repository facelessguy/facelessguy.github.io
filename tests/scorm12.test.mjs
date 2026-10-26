import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createScorm12Api,
  readScormSnapshot,
} from "../src/lib/scorm12.ts";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

test("SCORM runtime initializes, stores state, and resumes a course", () => {
  const storage = new MemoryStorage();
  const first = createScorm12Api(storage, "sample-course");
  assert.equal(first.api.LMSGetValue("cmi.core.lesson_status"), "");
  assert.equal(first.api.LMSGetLastError(), "301");
  assert.equal(first.api.LMSInitialize(""), "true");
  assert.equal(first.api.LMSGetValue("cmi.core.lesson_status"), "incomplete");
  assert.equal(first.api.LMSGetValue("cmi.core.entry"), "ab-initio");
  assert.equal(first.api.LMSSetValue("cmi.core.lesson_location", "6"), "true");
  assert.equal(first.api.LMSSetValue("cmi.suspend_data", '{"answers":["b"]}'), "true");
  assert.equal(first.api.LMSCommit(""), "true");

  const second = createScorm12Api(storage, "sample-course");
  assert.equal(second.api.LMSInitialize(""), "true");
  assert.equal(second.api.LMSGetValue("cmi.core.lesson_location"), "6");
  assert.equal(second.api.LMSGetValue("cmi.core.entry"), "resume");
  assert.equal(second.api.LMSGetValue("cmi.suspend_data"), '{"answers":["b"]}');
});

test("SCORM runtime rejects invalid calls and unsupported CMI fields", () => {
  const runtime = createScorm12Api(new MemoryStorage(), "sample-course");
  assert.equal(runtime.api.LMSSetValue("cmi.core.lesson_status", "passed"), "false");
  assert.equal(runtime.api.LMSGetLastError(), "301");
  assert.equal(runtime.api.LMSInitialize("bad"), "false");
  assert.equal(runtime.api.LMSGetLastError(), "201");
  assert.equal(runtime.api.LMSInitialize(""), "true");
  assert.equal(runtime.api.LMSSetValue("cmi.core.lesson_status", "unknown"), "false");
  assert.equal(runtime.api.LMSGetLastError(), "405");
  assert.equal(runtime.api.LMSSetValue("cmi.core.score.raw", "101"), "false");
  assert.equal(runtime.api.LMSGetLastError(), "405");
  assert.equal(runtime.api.LMSSetValue("cmi.private_data", "x"), "false");
  assert.equal(runtime.api.LMSGetLastError(), "401");
  assert.equal(runtime.api.LMSGetValue("cmi.private_data"), "");
  assert.equal(runtime.api.LMSGetLastError(), "401");
});

test("SCORM runtime commits the terminal result and accumulated session time", () => {
  const storage = new MemoryStorage();
  const runtime = createScorm12Api(storage, "sample-course");
  runtime.api.LMSInitialize("");
  runtime.api.LMSSetValue("cmi.core.score.raw", "67");
  runtime.api.LMSSetValue("cmi.core.lesson_status", "passed");
  runtime.api.LMSSetValue("cmi.core.session_time", "0000:00:02.30");
  assert.equal(runtime.api.LMSFinish(""), "true");
  assert.deepEqual(readScormSnapshot(storage, "portfolio:lms:scorm12:sample-course"), {
    status: "passed",
    location: "",
    score: "67",
    suspendData: "",
    totalTime: "0000:00:02.30",
  });
  assert.equal(runtime.api.LMSSetValue("cmi.core.lesson_status", "failed"), "false");
  assert.equal(runtime.api.LMSGetLastError(), "301");
});

test("reset clears only the selected course attempt", () => {
  const storage = new MemoryStorage();
  const runtime = createScorm12Api(storage, "sample-course");
  runtime.api.LMSInitialize("");
  runtime.api.LMSSetValue("cmi.core.lesson_location", "4");
  runtime.api.LMSCommit("");
  storage.setItem("portfolio:lms:scorm12:other-course", "retained");
  runtime.reset();
  assert.equal(runtime.getSnapshot().status, "not attempted");
  assert.equal(readScormSnapshot(storage, "portfolio:lms:scorm12:sample-course").status, "not attempted");
  assert.equal(storage.getItem("portfolio:lms:scorm12:other-course"), "retained");
});
