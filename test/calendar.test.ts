import { describe, it, expect } from "vitest";
import { parseIcs } from "@/lib/calendar";

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Roast planning with Wayne
DTSTART:20260715T090000Z
DTEND:20260715T100000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:All-day offsite
DTSTART;VALUE=DATE:20260716
END:VEVENT
END:VCALENDAR`;

describe("parseIcs", () => {
  it("parses multiple VEVENTs", () => {
    const events = parseIcs(ICS);
    expect(events).toHaveLength(2);
  });
  it("reads summary and timed start/end", () => {
    const e = parseIcs(ICS)[0];
    expect(e.summary).toBe("Roast planning with Wayne");
    expect(e.start.getUTCHours()).toBe(9);
    expect(e.end?.getUTCHours()).toBe(10);
  });
  it("handles all-day (VALUE=DATE) events", () => {
    const e = parseIcs(ICS)[1];
    expect(e.summary).toBe("All-day offsite");
    expect(e.start.getFullYear()).toBe(2026);
    expect(e.end).toBeNull();
  });
  it("returns [] for non-calendar text", () => {
    expect(parseIcs("not a calendar")).toEqual([]);
  });
});
