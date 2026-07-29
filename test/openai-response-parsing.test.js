import assert from "node:assert/strict";
import test from "node:test";

import {
  extractOpenAIText,
  parseJsonObject
} from "../apps/api/src/platform/openai/responseParsing.ts";

test("OpenAI response text extraction accepts known response shapes", () => {
  assert.equal(
    extractOpenAIText({ output_text: '{"status":"ready"}' }),
    '{"status":"ready"}'
  );
  assert.equal(
    extractOpenAIText({
      output: [
        {
          content: [
            { type: "output_text", text: "nested text" }
          ]
        }
      ]
    }),
    "nested text"
  );
  assert.equal(
    extractOpenAIText({
      output: [{ content: "not-an-array" }]
    }),
    ""
  );
  assert.equal(extractOpenAIText(null), "");
});

test("OpenAI JSON parsing accepts object payloads and bounded prose", () => {
  assert.deepEqual(
    parseJsonObject('```json\n{"status":"ready"}\n```'),
    { status: "ready" }
  );
  assert.deepEqual(
    parseJsonObject(
      'Result follows: {"status":"ready","items":[]}'
    ),
    { status: "ready", items: [] }
  );
});

test("OpenAI JSON object parsing rejects arrays, primitives, and malformed text", () => {
  assert.equal(parseJsonObject('[{"status":"ready"}]'), null);
  assert.equal(parseJsonObject('"ready"'), null);
  assert.equal(parseJsonObject("42"), null);
  assert.equal(parseJsonObject("{invalid"), null);
});
