// frontend/utils/relativeTime.test.ts
import { describe, expect, it } from "vitest";

import { formatRelativeTime, relativeTimeParts } from "./relativeTime";

const NOW = Date.parse("2026-06-02T12:00:00Z");

const LABELS = {
  justNow: "just now",
  minutes: "{n} min ago",
  hours: "{n} h ago",
  days: "{n} d ago",
};

describe("relativeTimeParts", () => {
  it("returns just-now under a minute", () => {
    expect(relativeTimeParts("2026-06-02T11:59:30Z", NOW)).toEqual({ key: "justNow", n: 0 });
  });

  it("returns minutes under an hour", () => {
    expect(relativeTimeParts("2026-06-02T11:45:00Z", NOW)).toEqual({ key: "minutes", n: 15 });
  });

  it("returns hours under a day", () => {
    expect(relativeTimeParts("2026-06-02T09:00:00Z", NOW)).toEqual({ key: "hours", n: 3 });
  });

  it("returns days beyond 24h (no weekday names)", () => {
    expect(relativeTimeParts("2026-05-30T12:00:00Z", NOW)).toEqual({ key: "days", n: 3 });
  });

  it("treats future / unparseable timestamps as just-now", () => {
    expect(relativeTimeParts("2026-06-02T12:05:00Z", NOW)).toEqual({ key: "justNow", n: 0 });
    expect(relativeTimeParts("not-a-date", NOW)).toEqual({ key: "justNow", n: 0 });
  });
});

describe("formatRelativeTime", () => {
  it("interpolates the count", () => {
    expect(formatRelativeTime("2026-06-02T11:45:00Z", NOW, LABELS)).toBe("15 min ago");
    expect(formatRelativeTime("2026-06-02T11:59:50Z", NOW, LABELS)).toBe("just now");
  });
});
