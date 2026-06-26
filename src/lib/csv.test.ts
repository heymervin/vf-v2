import { describe, it, expect } from "vitest";
import { csvCell, toCsv, parseCsv } from "./csv";

describe("csvCell", () => {
  it("leaves plain values unquoted", () => {
    expect(csvCell("Anna")).toBe("Anna");
    expect(csvCell(120)).toBe("120");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes and escapes commas, quotes, and newlines", () => {
    expect(csvCell("Smith, Anna")).toBe('"Smith, Anna"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("toCsv", () => {
  it("joins headers and rows, escaping as needed", () => {
    const csv = toCsv(["Name", "Email"], [["Anna, B", "a@x.com"]]);
    expect(csv).toBe('Name,Email\n"Anna, B",a@x.com');
  });
});

describe("parseCsv", () => {
  it("parses plain rows", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("handles quoted fields with commas, quotes, and newlines", () => {
    expect(parseCsv('"Anna, B",a@x.com')).toEqual([["Anna, B", "a@x.com"]]);
    expect(parseCsv('"say ""hi"""')).toEqual([['say "hi"']]);
    expect(parseCsv('"line1\nline2",x')).toEqual([["line1\nline2", "x"]]);
  });

  it("tolerates CRLF and a trailing newline", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("round-trips with toCsv", () => {
    const csv = toCsv(["Name", "Email"], [["Anna, B", 'say "hi"']]);
    expect(parseCsv(csv)).toEqual([["Name", "Email"], ["Anna, B", 'say "hi"']]);
  });
});
