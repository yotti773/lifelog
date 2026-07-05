import { describe, expect, it } from "vitest";
import { formatCalendarDate, formatJstDateTime } from "../sheetsSync";

describe("formatCalendarDate", () => {
  it("converts a YYYY-MM-DD key into yyyy年mm月dd日 without any timezone shift", () => {
    expect(formatCalendarDate("2026-07-05")).toBe("2026年07月05日");
  });
});

describe("formatJstDateTime", () => {
  it("converts a UTC ISO timestamp to JST (UTC+9) yyyy年mm月dd日 hh:mm", () => {
    expect(formatJstDateTime("2026-07-05T12:00:00.000Z")).toBe("2026年07月05日 21:00");
  });

  it("rolls over to the next JST calendar day when the UTC time is late enough", () => {
    expect(formatJstDateTime("2026-07-05T20:00:00.000Z")).toBe("2026年07月06日 05:00");
  });
});
