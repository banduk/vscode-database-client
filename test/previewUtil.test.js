const assert = require("assert");
const { formatPreviewValue, normalizeCellValue } = require("../src/vue/result/previewUtil");

function describe(name, fn) {
  console.log(name);
  fn();
}

function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

describe("previewUtil", () => {
  it("normalizes null/undefined to null", () => {
    assert.strictEqual(normalizeCellValue(null), null);
    assert.strictEqual(normalizeCellValue(undefined), null);
  });

  it("normalizes typed array payloads", () => {
    const text = "ok";
    const buf = new Uint16Array(text.split("").map((c) => c.charCodeAt(0)));
    const payload = { type: "Buffer", data: Array.from(buf) };
    assert.strictEqual(normalizeCellValue(payload), text);
  });

  it("formats JSON objects as pretty JSON", () => {
    const res = formatPreviewValue({ a: 1, b: true }, "json");
    assert.strictEqual(res.isPre, true);
    assert.ok(res.text.includes("\n"));
    assert.ok(res.text.includes("\"a\": 1"));
  });

  it("formats JSON strings as pretty JSON", () => {
    const res = formatPreviewValue("{\"a\":1}", "json");
    assert.strictEqual(res.isPre, true);
    assert.ok(res.text.includes("\n"));
    assert.ok(res.text.includes("\"a\": 1"));
  });

  it("keeps invalid JSON strings as-is for json formatter", () => {
    const res = formatPreviewValue("{not-json}", "json");
    assert.strictEqual(res.isPre, false);
    assert.strictEqual(res.text, "{not-json}");
  });

  it("auto formatter pretty prints objects", () => {
    const res = formatPreviewValue({ ok: true }, "auto");
    assert.strictEqual(res.isPre, true);
    assert.ok(res.text.includes("\"ok\": true"));
  });

  it("auto formatter pretty prints JSON-like strings", () => {
    const res = formatPreviewValue("  [1,2]", "auto");
    assert.strictEqual(res.isPre, true);
    assert.ok(res.text.includes("\n"));
  });

  it("auto formatter leaves plain strings untouched", () => {
    const res = formatPreviewValue("hello", "auto");
    assert.strictEqual(res.isPre, false);
    assert.strictEqual(res.text, "hello");
  });

  it("array formatter renders arrays as newline lists", () => {
    const res = formatPreviewValue([1, 2, 3], "array");
    assert.strictEqual(res.isPre, true);
    assert.strictEqual(res.text, "1\n2\n3");
  });

  it("array formatter splits comma strings", () => {
    const res = formatPreviewValue("a, b, c", "array");
    assert.strictEqual(res.isPre, true);
    assert.strictEqual(res.text, "a\nb\nc");
  });

  it("raw formatter stringifies values", () => {
    const res = formatPreviewValue(123, "raw");
    assert.strictEqual(res.isPre, false);
    assert.strictEqual(res.text, "123");
  });
});
