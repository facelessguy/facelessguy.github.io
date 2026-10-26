export type ScormStatus =
  | "not attempted"
  | "incomplete"
  | "completed"
  | "passed"
  | "failed"
  | "browsed";

export interface ScormSnapshot {
  status: ScormStatus;
  location: string;
  score: string;
  suspendData: string;
  totalTime: string;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const statuses = new Set<ScormStatus>([
  "not attempted",
  "incomplete",
  "completed",
  "passed",
  "failed",
  "browsed",
]);

const initialSnapshot = (): ScormSnapshot => ({
  status: "not attempted",
  location: "",
  score: "",
  suspendData: "",
  totalTime: "00:00:00.00",
});

const snapshotFrom = (value: unknown): ScormSnapshot => {
  if (!value || typeof value !== "object") return initialSnapshot();
  const data = value as Partial<ScormSnapshot>;
  return {
    status: statuses.has(data.status as ScormStatus)
      ? (data.status as ScormStatus)
      : "not attempted",
    location: typeof data.location === "string" ? data.location : "",
    score: typeof data.score === "string" ? data.score : "",
    suspendData:
      typeof data.suspendData === "string" ? data.suspendData : "",
    totalTime:
      typeof data.totalTime === "string" ? data.totalTime : "00:00:00.00",
  };
};

const timeToCentiseconds = (value: string) => {
  const match = /^(\d{2,4}):(\d{2}):(\d{2})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return 0;
  const [, hours, minutes, seconds, fraction = "0"] = match;
  return (
    ((Number(hours) * 60 + Number(minutes)) * 60 + Number(seconds)) * 100 +
    Number(fraction.padEnd(2, "0"))
  );
};

const centisecondsToTime = (value: number) => {
  const totalSeconds = Math.floor(value / 100);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = value % 100;
  return `${String(hours).padStart(4, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
};

export function readScormSnapshot(storage: StorageLike, key: string) {
  try {
    const stored = storage.getItem(key);
    return stored ? snapshotFrom(JSON.parse(stored)) : initialSnapshot();
  } catch {
    return initialSnapshot();
  }
}

export function createScorm12Api(
  storage: StorageLike,
  courseId: string,
  onCommit: (snapshot: ScormSnapshot) => void = () => {},
) {
  const key = `portfolio:lms:scorm12:${courseId}`;
  let data = readScormSnapshot(storage, key);
  let initialized = false;
  let finished = false;
  let lastError = "0";
  let sessionTime = "00:00:00.00";

  const fail = (code: string) => {
    lastError = code;
    return "false";
  };
  const success = () => {
    lastError = "0";
    return "true";
  };
  const persist = () => {
    storage.setItem(key, JSON.stringify(data));
    onCommit({ ...data });
  };
  const getValue = (element: string) => {
    if (!initialized || finished) {
      lastError = "301";
      return "";
    }
    const values: Record<string, string> = {
      "cmi.core.student_id": "portfolio-learner",
      "cmi.core.student_name": "Демонстрационный участник",
      "cmi.core.lesson_status": data.status,
      "cmi.core.lesson_location": data.location,
      "cmi.core.score.raw": data.score,
      "cmi.core.score.min": "0",
      "cmi.core.score.max": "100",
      "cmi.core.total_time": data.totalTime,
      "cmi.core.session_time": sessionTime,
      "cmi.core.entry": data.location || data.suspendData ? "resume" : "ab-initio",
      "cmi.core.credit": "credit",
      "cmi.core.lesson_mode": "normal",
      "cmi.suspend_data": data.suspendData,
      "cmi.launch_data": "",
    };
    if (!(element in values)) {
      lastError = "401";
      return "";
    }
    lastError = "0";
    return values[element];
  };
  const setValue = (element: string, value: string) => {
    if (!initialized || finished) return fail("301");
    if (typeof value !== "string") return fail("201");
    if (element === "cmi.core.lesson_status") {
      if (!statuses.has(value as ScormStatus)) return fail("405");
      data.status = value as ScormStatus;
    } else if (element === "cmi.core.lesson_location") {
      if (value.length > 255) return fail("405");
      data.location = value;
    } else if (element === "cmi.core.score.raw") {
      const score = Number(value);
      if (!Number.isFinite(score) || score < 0 || score > 100)
        return fail("405");
      data.score = String(score);
    } else if (element === "cmi.suspend_data") {
      if (value.length > 4096) return fail("405");
      data.suspendData = value;
    } else if (element === "cmi.core.session_time") {
      if (!/^\d{2,4}:\d{2}:\d{2}(?:\.\d{1,2})?$/.test(value))
        return fail("405");
      sessionTime = value;
    } else if (element === "cmi.core.exit") {
      if (!["time-out", "suspend", "logout", ""].includes(value))
        return fail("405");
    } else {
      return fail("401");
    }
    lastError = "0";
    return "true";
  };

  const api = {
    LMSInitialize: (argument: string) => {
      if (argument !== "") return fail("201");
      if (initialized && !finished) return fail("101");
      data = readScormSnapshot(storage, key);
      initialized = true;
      finished = false;
      sessionTime = "00:00:00.00";
      if (data.status === "not attempted") data.status = "incomplete";
      return success();
    },
    LMSGetValue: getValue,
    LMSSetValue: setValue,
    LMSCommit: (argument: string) => {
      if (argument !== "") return fail("201");
      if (!initialized || finished) return fail("301");
      try {
        persist();
        return success();
      } catch {
        return fail("101");
      }
    },
    LMSFinish: (argument: string) => {
      if (argument !== "") return fail("201");
      if (!initialized || finished) return fail("301");
      data.totalTime = centisecondsToTime(
        timeToCentiseconds(data.totalTime) + timeToCentiseconds(sessionTime),
      );
      try {
        persist();
        finished = true;
        return success();
      } catch {
        return fail("101");
      }
    },
    LMSGetLastError: () => lastError,
    LMSGetErrorString: (code: string) =>
      ({
        "0": "No error",
        "101": "General exception",
        "201": "Invalid argument error",
        "301": "Not initialized",
        "401": "Not implemented error",
        "405": "Incorrect data type or value",
      })[code] ?? "Unknown error",
    LMSGetDiagnostic: (code: string) =>
      code === "" ? lastError : `SCORM 1.2 error ${code}`,
  };

  return {
    api,
    getSnapshot: () => ({ ...data }),
    reset: () => {
      storage.removeItem(key);
      data = initialSnapshot();
      initialized = false;
      finished = false;
      sessionTime = "00:00:00.00";
      lastError = "0";
      onCommit({ ...data });
    },
  };
}
