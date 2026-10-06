import { formatChatTimestamp } from "@/lib/chatTimestamps";

describe("formatChatTimestamp", () => {
  const now = new Date("2026-10-06T12:05:00");

  it("formats timestamps as relative time", () => {
    expect(formatChatTimestamp(new Date("2026-10-06T12:00:00").getTime(), "relative", now)).toBe(
      "5 minutes ago",
    );
  });

  it("formats timestamps as local exact time", () => {
    const timestamp = new Date("2026-10-06T14:32:00");
    expect(formatChatTimestamp(timestamp.getTime(), "exact", now)).toBe(
      timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    );
  });
});