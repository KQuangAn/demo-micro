/**
 * ══════════════════════════════════════════════════════════════════
 *  LLM STREAMING WITH GROQ + TRANSFORM STREAMS + ABORTCONTROLLER
 * ══════════════════════════════════════════════════════════════════
 *
 *  Run: pnpm llm-stream
 *
 *  What this file teaches:
 *
 *  PART A — Raw LLM streaming          (Groq stream → for-await chunks)
 *  PART B — Transform stream pipeline  (chunks → strip think tags → uppercase)
 *  PART C — AbortController + LLM      (cancel mid-stream with a timeout)
 *  PART D — Word-count Transform       (count tokens as they flow through)
 *  PART E — Accumulator Writable       (collect full response from stream)
 *  PART F — Tee / fan-out              (same stream → console AND file simultaneously)
 *  PART G — AbortSignal.timeout()      (no controller needed, auto-cancel)
 *  PART H — Graceful error handling    (AbortError vs real errors)
 *
 *  Key concepts:
 *    • LangChain's .stream() returns an AsyncGenerator<AIMessageChunk>
 *    • We wrap it in Readable.from() to plug into the Node stream pipeline
 *    • Transform streams let us mutate/inspect chunks as they flow
 *    • AbortController.abort() propagates through the whole pipeline
 * ══════════════════════════════════════════════════════════════════
 */

import "dotenv/config";
import { Readable, Transform, Writable, pipeline, PassThrough } from "stream";
import { promisify } from "util";
import { createWriteStream } from "fs";
import { mkdir, unlink } from "fs/promises";
import path from "path";
import { getModel } from "../model-cache";

const pipelineAsync = promisify(pipeline);

// ─── helpers ────────────────────────────────────────────────────────────────

const TMP = path.join(process.cwd(), ".llm-stream-tmp");

async function setup() {
  await mkdir(TMP, { recursive: true });
}

async function cleanup() {
  // remove tmp dir files silently
  try {
    const { rm } = await import("fs/promises");
    await rm(TMP, { recursive: true, force: true });
  } catch {
    // already gone
  }
}

function hr(label: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${label}`);
  console.log("─".repeat(60));
}

function banner(part: string, title: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${part} — ${title}`);
  console.log("═".repeat(60) + "\n");
}

/** Extract the text content from an AIMessageChunk */
function chunkText(chunk: unknown): string {
  if (typeof chunk === "string") return chunk;
  // AIMessageChunk has .content which may be string or array
  const c = (chunk as { content?: unknown }).content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .map((item) =>
        typeof item === "string"
          ? item
          : (item as { text?: string }).text ?? ""
      )
      .join("");
  }
  return String(chunk);
}

// ─── PART A — Raw LLM streaming ─────────────────────────────────────────────

async function partA_rawStreaming() {
  banner("PART A", "Raw LLM streaming — for-await over chunks");

  /*
   * LangChain's .stream(input) returns an AsyncGenerator.
   * Each yielded value is an AIMessageChunk.
   * We iterate with for-await and print each piece as it arrives.
   *
   * WHY STREAMING?
   *   Without streaming: you wait 3-10 seconds for the full response.
   *   With streaming:    first token appears in ~200ms, rest follows word-by-word.
   */

  const model = getModel("llama-3.1-8b-instant", 0.7);

  hr("A1 — streaming a short answer token by token");
  process.stdout.write("LLM > ");

  const stream = await model.stream(
    "Count to 5, one word per line. Be concise."
  );

  let chunkCount = 0;
  for await (const chunk of stream) {
    const text = chunkText(chunk);
    process.stdout.write(text); // no newline — tokens arrive mid-word
    chunkCount++;
  }

  console.log(`\n\n✅ Received ${chunkCount} chunks total`);

  // ─────────────────────────────────────────────────────────────────
  hr("A2 — collecting chunks into a full string");

  const stream2 = await model.stream("What is 2 + 2? One sentence.");
  const parts: string[] = [];

  for await (const chunk of stream2) {
    parts.push(chunkText(chunk));
  }

  const full = parts.join("");
  console.log(`Collected: "${full}"`);
  console.log(`Total chars: ${full.length}, chunks: ${parts.length}`);
}

// ─── PART B — Transform stream pipeline ─────────────────────────────────────

async function partB_transformPipeline() {
  banner("PART B", "Transform stream pipeline over LLM chunks");

  /*
   * LangChain stream → Readable.from() → Transform A → Transform B → Writable
   *
   * Readable.from(asyncIterable, { objectMode: true })
   *   Wraps any async generator into a Node Readable.
   *   objectMode:true means chunks flow as AIMessageChunk objects, not Buffers.
   *
   * We build a chain of Transform streams, each doing one job:
   *   1. ExtractText     — AIMessageChunk → plain string
   *   2. StripThinkTags  — remove <think>…</think> reasoning blocks (some models)
   *   3. WordWrapper     — insert newline every N chars for terminal display
   */

  const model = getModel("llama-3.1-8b-instant", 0.7);

  // ── Transform 1: extract text from AIMessageChunk ──────────────────────────
  const extractText = new Transform({
    objectMode: true, // input: objects (AIMessageChunk)
    writableObjectMode: true,
    readableObjectMode: false, // output: strings/Buffers
    transform(chunk, _enc, callback) {
      const text = chunkText(chunk);
      callback(null, text); // push the extracted string
    },
  });

  // ── Transform 2: strip <think>…</think> tags ───────────────────────────────
  // Some models (e.g. deepseek-r1, qwen) wrap reasoning in <think> blocks.
  // We strip them so the final output is clean.
  // NOTE: decodeStrings defaults to true — Node converts Buffer → string for us
  let insideThink = false;
  let thinkBuffer = "";
  const stripThink = new Transform({
    encoding: "utf8", // ensure chunks arrive as strings
    transform(chunk: Buffer | string, _enc, callback) {
      const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;

      // accumulate until we can decide
      thinkBuffer += text;
      let result = "";

      while (thinkBuffer.length > 0) {
        if (insideThink) {
          const closeIdx = thinkBuffer.indexOf("</think>");
          if (closeIdx !== -1) {
            insideThink = false;
            thinkBuffer = thinkBuffer.slice(closeIdx + "</think>".length);
          } else {
            thinkBuffer = ""; // still inside think, consume
          }
        } else {
          const openIdx = thinkBuffer.indexOf("<think>");
          if (openIdx !== -1) {
            result += thinkBuffer.slice(0, openIdx);
            insideThink = true;
            thinkBuffer = thinkBuffer.slice(openIdx + "<think>".length);
          } else {
            result += thinkBuffer;
            thinkBuffer = "";
          }
        }
      }

      callback(null, result);
    },
    flush(callback) {
      // flush any remaining buffer
      if (!insideThink && thinkBuffer) {
        this.push(thinkBuffer);
      }
      callback();
    },
  });

  // ── Transform 3: word-wrap at 70 chars ────────────────────────────────────
  let lineLen = 0;
  const wordWrap = new Transform({
    encoding: "utf8",
    transform(chunk: Buffer | string, _enc, callback) {
      const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
      const words = text.split(/(\s+)/); // split on whitespace, keep separators
      let out = "";
      for (const word of words) {
        if (lineLen + word.length > 70) {
          out += "\n";
          lineLen = 0;
        }
        out += word;
        lineLen += word.length;
      }
      callback(null, out);
    },
    flush(callback) {
      callback(null, "\n"); // trailing newline at end of stream
    },
  });

  // ── Writable: print to stdout ──────────────────────────────────────────────
  const toStdout = new Writable({
    decodeStrings: false,
    write(chunk: Buffer | string, _enc, callback) {
      process.stdout.write(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk);
      callback();
    },
  });

  hr("B1 — streaming through 3 transforms into stdout");
  process.stdout.write("LLM > ");

  const llmStream = await model.stream(
    "Explain what a Transform stream is in Node.js in 3 sentences."
  );

  // Wrap the LangChain AsyncGenerator in a Node Readable
  const readable = Readable.from(llmStream, { objectMode: true });

  await pipelineAsync(readable, extractText, stripThink, wordWrap, toStdout);

  console.log("\n✅ Pipeline complete");
}

// ─── PART C — AbortController + LLM ────────────────────────────────────────

async function partC_abortController() {
  banner("PART C", "AbortController — cancel LLM stream mid-flight");

  /*
   * AbortController lets you cancel an in-progress operation.
   *
   *   const ac = new AbortController();
   *   ac.abort("reason");        → sets ac.signal.aborted = true
   *                                fires 'abort' event on ac.signal
   *
   * Two abort strategies shown:
   *   C1 — cancel after N chunks (user presses "stop generating")
   *   C2 — cancel after a timeout (hard deadline)
   *
   * When we abort:
   *   • The LangChain stream generator receives the signal
   *   • Readable.from()'s internal loop checks signal → throws AbortError
   *   • pipelineAsync() rejects with that AbortError
   *   • We catch it and handle gracefully
   */

  const model = getModel("llama-3.1-8b-instant", 0.7);

  // ─────────────────────────────────────────────────────────────────
  hr("C1 — cancel after receiving 5 chunks");

  const ac1 = new AbortController();
  let chunksSeen = 0;
  const MAX_CHUNKS = 5;

  // Counter transform — increments chunksSeen and aborts when threshold hit
  const chunkCounter = new Transform({
    transform(chunk: Buffer, _enc, callback) {
      const text = chunk.toString("utf8");
      chunksSeen++;
      process.stdout.write(text); // show what we got before cancel
      if (chunksSeen >= MAX_CHUNKS) {
        console.log(`\n\n[abort] Hit ${MAX_CHUNKS} chunks — aborting!`);
        ac1.abort("max chunks reached");
      }
      callback(null, text);
    },
  });

  // Sink that does nothing (just drains)
  const sink = new Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  });

  const llmStream1 = await model.stream(
    "Write a long story about a robot learning to paint. At least 200 words."
  );

  // Pass signal to Readable.from so the generator is cancelled when aborted
  const readable1 = Readable.from(llmStream1, {
    objectMode: true,
    signal: ac1.signal,
  });

  // Extract text first
  const extract1 = new Transform({
    objectMode: true,
    writableObjectMode: true,
    readableObjectMode: false,
    transform(chunk, _enc, cb) {
      cb(null, chunkText(chunk));
    },
  });

  process.stdout.write("LLM > ");

  try {
    await pipelineAsync(readable1, extract1, chunkCounter, sink, {
      signal: ac1.signal,
    });
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name === "AbortError") {
      console.log(`✅ Stream cancelled cleanly — reason: "${ac1.signal.reason}"`);
    } else {
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  hr("C2 — cancel after 800ms hard timeout");

  const ac2 = new AbortController();
  const TIMEOUT_MS = 800;

  // Auto-cancel after TIMEOUT_MS
  const timer = setTimeout(() => {
    console.log(`\n[timeout] ${TIMEOUT_MS}ms elapsed — aborting stream`);
    ac2.abort(`${TIMEOUT_MS}ms timeout`);
  }, TIMEOUT_MS);

  const llmStream2 = await model.stream(
    "Write a detailed history of the internet, covering every decade from 1960 to 2020."
  );

  const readable2 = Readable.from(llmStream2, {
    objectMode: true,
    signal: ac2.signal,
  });

  const extract2 = new Transform({
    objectMode: true,
    writableObjectMode: true,
    readableObjectMode: false,
    transform(chunk, _enc, cb) {
      cb(null, chunkText(chunk));
    },
  });

  let charCount = 0;
  const counter2 = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      const text = chunk.toString("utf8");
      charCount += text.length;
      process.stdout.write(text);
      cb(null, text);
    },
  });

  process.stdout.write("LLM > ");

  try {
    await pipelineAsync(readable2, extract2, counter2, sink, {
      signal: ac2.signal,
    });
    clearTimeout(timer); // completed before timeout
    console.log(`\n✅ Stream finished before timeout (${charCount} chars)`);
  } catch (err: unknown) {
    clearTimeout(timer);
    const e = err as Error;
    if (e.name === "AbortError") {
      console.log(
        `\n✅ Cancelled after ${charCount} chars — reason: "${ac2.signal.reason}"`
      );
    } else {
      throw err;
    }
  }
}

// ─── PART D — Word-count Transform (metrics as tokens flow) ─────────────────

async function partD_wordCountTransform() {
  banner("PART D", "Word-count Transform — inspect tokens mid-stream");

  /*
   * A Transform can be both a consumer AND a producer.
   * Here we:
   *   1. Let text pass through unchanged (this.push(chunk))
   *   2. Count words as they arrive
   *   3. In _flush() we emit a final summary line
   *
   * This is the pattern for any kind of "tap" / metrics / logging
   * middleware you want to insert in a pipeline without changing the data.
   */

  class WordCountTransform extends Transform {
    private wordCount = 0;
    private charCount = 0;
    private chunkCount = 0;

    constructor() {
      super();
    }

    _transform(chunk: Buffer, _enc: string, callback: () => void) {
      const text = chunk.toString("utf8");
      this.chunkCount++;
      this.charCount += text.length;
      // rough word count: split on whitespace
      const words = text.trim().split(/\s+/).filter(Boolean);
      this.wordCount += words.length;

      process.stdout.write(text); // pass through to stdout
      this.push(text); // pass data downstream
      callback();
    }

    _flush(callback: () => void) {
      // inject summary at end of stream
      const summary =
        `\n\n📊 [WordCount] chunks=${this.chunkCount} ` +
        `words≈${this.wordCount} chars=${this.charCount}\n`;
      this.push(summary);
      callback();
    }
  }

  const model = getModel("llama-3.1-8b-instant", 0.7);

  const llmStream = await model.stream(
    "Give me 5 interesting facts about black holes. Use bullet points."
  );

  const readable = Readable.from(llmStream, { objectMode: true });

  const extractText = new Transform({
    objectMode: true,
    writableObjectMode: true,
    readableObjectMode: false,
    transform(chunk, _enc, cb) {
      cb(null, chunkText(chunk));
    },
  });

  const wordCounter = new WordCountTransform();

  // Final sink (data already printed inside WordCountTransform)
  const sink = new Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  });

  process.stdout.write("LLM > ");
  await pipelineAsync(readable, extractText, wordCounter, sink);
  console.log("✅ Word-count pipeline done");
}

// ─── PART E — Accumulator Writable ──────────────────────────────────────────

async function partE_accumulatorWritable() {
  banner("PART E", "Accumulator Writable — collect full response from stream");

  /*
   * Sometimes you want streaming delivery (fast first byte) but also need
   * the complete string at the end (e.g. to parse JSON, store in DB).
   *
   * Pattern: custom Writable that appends to an internal buffer.
   *   After the pipeline finishes, read accumulator.result.
   *
   * Compare this to Part A2 (manual for-await) — same outcome but
   * fully composable as a pipeline stage.
   */

  class AccumulatorWritable extends Writable {
    public result = "";
    private _showLive: boolean;

    constructor(showLive = true) {
      super();
      this._showLive = showLive;
    }

    _write(chunk: Buffer, _enc: string, callback: () => void) {
      const text = chunk.toString("utf8");
      this.result += text;
      if (this._showLive) process.stdout.write(text); // live display
      callback();
    }
  }

  const model = getModel("llama-3.1-8b-instant", 0.7);

  const llmStream = await model.stream(
    'Respond with ONLY valid JSON: {"capital": "...", "population": ...} for France.'
  );

  const readable = Readable.from(llmStream, { objectMode: true });
  const extractText = new Transform({
    objectMode: true,
    writableObjectMode: true,
    readableObjectMode: false,
    transform(chunk, _enc, cb) {
      cb(null, chunkText(chunk));
    },
  });

  const accumulator = new AccumulatorWritable(true);

  process.stdout.write("LLM > ");
  await pipelineAsync(readable, extractText, accumulator);

  console.log("\n\n📦 Full collected response:");
  console.log(`  Raw string: "${accumulator.result}"`);

  // try to parse JSON from the collected result
  try {
    // extract JSON from the string (model might wrap in ```json blocks)
    const jsonMatch = accumulator.result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`  Parsed:`, parsed);
    }
  } catch {
    console.log("  (not valid JSON — model added extra text)");
  }

  console.log("✅ Accumulator done");
}

// ─── PART F — Tee / fan-out ──────────────────────────────────────────────────

async function partF_tee() {
  banner("PART F", "Tee (fan-out) — same stream → console AND file");

  /*
   * "Tee" is a Unix concept: split one stream into two outputs simultaneously.
   *
   *   Source ──► PassThrough (tee) ──► stdout
   *                    └──────────────► file
   *
   * Node's PassThrough is a Transform that passes data unchanged.
   * We manually pipe it to two destinations:
   *   • process.stdout  (live display)
   *   • createWriteStream(file)  (persist to disk)
   *
   * IMPORTANT: We can't use pipelineAsync for fan-out because it's a
   * 1-to-1 chain. Instead we .pipe() manually and track both "finish" events.
   */

  const outFile = path.join(TMP, "llm-response.txt");

  const model = getModel("llama-3.1-8b-instant", 0.7);
  const llmStream = await model.stream(
    "Write a haiku about streams in Node.js."
  );

  const readable = Readable.from(llmStream, { objectMode: true });

  // Extract text from chunks
  const extractText = new Transform({
    objectMode: true,
    writableObjectMode: true,
    readableObjectMode: false,
    transform(chunk, _enc, cb) {
      cb(null, chunkText(chunk));
    },
  });

  // The tee — a PassThrough that we'll pipe to two places
  const tee = new PassThrough();

  // Destination 1: stdout
  const stdoutWriter = new Writable({
    write(chunk: Buffer, _enc, cb) {
      process.stdout.write(chunk.toString("utf8"));
      cb();
    },
  });

  // Destination 2: file
  const fileWriter = createWriteStream(outFile);

  // Fan-out: pipe tee to both destinations
  tee.pipe(stdoutWriter);
  tee.pipe(fileWriter);

  // Wait for both destinations to finish
  const stdoutDone = new Promise<void>((resolve, reject) => {
    stdoutWriter.on("finish", resolve);
    stdoutWriter.on("error", reject);
  });
  const fileDone = new Promise<void>((resolve, reject) => {
    fileWriter.on("finish", resolve);
    fileWriter.on("error", reject);
  });

  // Drive the source → extractText → tee
  process.stdout.write("LLM > ");
  await pipelineAsync(readable, extractText, tee);
  await Promise.all([stdoutDone, fileDone]);

  console.log(`\n\n✅ Response saved to: ${outFile}`);

  // Read it back to verify
  const { readFile } = await import("fs/promises");
  const saved = await readFile(outFile, "utf8");
  console.log(`📂 File contents (${saved.length} chars): "${saved.trim()}"`);
}

// ─── PART G — AbortSignal.timeout() ─────────────────────────────────────────

async function partG_signalTimeout() {
  banner("PART G", "AbortSignal.timeout() — no controller, auto-cancel");

  /*
   * AbortSignal.timeout(ms) is a static factory that creates a signal
   * which auto-aborts after ms milliseconds — no AbortController needed.
   *
   * Use it when you just want a deadline without needing manual cancel:
   *
   *   const signal = AbortSignal.timeout(2000);
   *   Readable.from(iterable, { signal })
   *
   * The error name will be "TimeoutError" (not "AbortError"),
   * so check for both when handling.
   *
   * REAL-WORLD: "If the LLM hasn't finished in 3s, give up and return cached."
   */

  const DEADLINE_MS = 1500;
  const signal = AbortSignal.timeout(DEADLINE_MS);

  const model = getModel("llama-3.1-8b-instant", 0.7);
  const llmStream = await model.stream(
    "Describe the entire history of computer science from 1940 to now in extreme detail."
  );

  const readable = Readable.from(llmStream, { objectMode: true, signal });

  const extractText = new Transform({
    objectMode: true,
    writableObjectMode: true,
    readableObjectMode: false,
    transform(chunk, _enc, cb) {
      cb(null, chunkText(chunk));
    },
  });

  let charCount = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      const text = chunk.toString("utf8");
      charCount += text.length;
      process.stdout.write(text);
      cb(null, text);
    },
  });

  const sink = new Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  });

  console.log(`⏱  Hard deadline: ${DEADLINE_MS}ms\n`);
  process.stdout.write("LLM > ");

  try {
    await pipelineAsync(readable, extractText, counter, sink, { signal });
    console.log(`\n✅ Finished within deadline (${charCount} chars)`);
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      console.log(
        `\n⏰ Auto-cancelled after ${DEADLINE_MS}ms — got ${charCount} chars`
      );
      console.log(`   signal.aborted=${signal.aborted}  reason=${signal.reason}`);
    } else {
      throw err;
    }
  }
}

// ─── PART H — Graceful error handling ───────────────────────────────────────

async function partH_errorHandling() {
  banner("PART H", "Graceful error handling — AbortError vs real errors");

  /*
   * When working with LLM streams, errors fall into 3 buckets:
   *
   *   1. AbortError   — we cancelled (ac.abort())
   *      err.name === "AbortError"
   *
   *   2. TimeoutError — AbortSignal.timeout() fired
   *      err.name === "TimeoutError"
   *
   *   3. Real errors  — network failure, API rate-limit, parse error
   *      anything else
   *
   * Strategy:
   *   • AbortError / TimeoutError → log gracefully, return partial result
   *   • Real error               → re-throw (let caller decide)
   *
   * We also show how to attach a 'abort' listener to do cleanup.
   */

  hr("H1 — AbortError vs TimeoutError names");

  // AbortController cancellation → "AbortError"
  const ac = new AbortController();
  ac.abort("user cancelled");
  console.log(`Manual abort — name: "${ac.signal.reason}" (reason)`);
  // Note: the *error* thrown has name "AbortError"

  // AbortSignal.timeout → "TimeoutError"
  const tSig = AbortSignal.timeout(1);
  await new Promise((r) => setTimeout(r, 10)); // let it fire
  console.log(`Timeout signal — aborted: ${tSig.aborted}`);
  // The *error* thrown has name "TimeoutError"

  // ─────────────────────────────────────────────────────────────────
  hr("H2 — abort listener for cleanup");

  const ac2 = new AbortController();

  // Register cleanup BEFORE the operation starts
  ac2.signal.addEventListener(
    "abort",
    () => {
      console.log(
        `[cleanup] abort fired — reason: "${ac2.signal.reason}" — closing DB connections, flushing buffers...`
      );
    },
    { once: true }
  );

  // Simulate aborting after 200ms
  setTimeout(() => ac2.abort("demo cleanup"), 200);

  const model = getModel("llama-3.1-8b-instant", 0.7);
  const llmStream = await model.stream(
    "Write a very long essay about the universe."
  );

  const readable = Readable.from(llmStream, {
    objectMode: true,
    signal: ac2.signal,
  });

  const extractText = new Transform({
    objectMode: true,
    writableObjectMode: true,
    readableObjectMode: false,
    transform(chunk, _enc, cb) {
      cb(null, chunkText(chunk));
    },
  });

  const sink = new Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  });

  try {
    await pipelineAsync(readable, extractText, sink, { signal: ac2.signal });
    console.log("Stream finished (faster than expected)");
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name === "AbortError") {
      console.log(`✅ AbortError caught cleanly — "${ac2.signal.reason}"`);
    } else {
      console.error(`❌ Unexpected error: ${e.message}`);
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  hr("H3 — unified error handler pattern");

  function handleStreamError(err: unknown, signal?: AbortSignal): "aborted" | "timeout" | "error" {
    const e = err as Error;
    if (e.name === "AbortError") {
      console.log(`  → aborted (reason: "${signal?.reason ?? "unknown"}")`);
      return "aborted";
    }
    if (e.name === "TimeoutError") {
      console.log(`  → timeout (signal.aborted=${signal?.aborted})`);
      return "timeout";
    }
    console.error(`  → real error: ${e.message}`);
    return "error";
  }

  // Test with AbortError
  const acTest = new AbortController();
  acTest.abort("test reason");
  const testErr = Object.assign(new Error("AbortError"), { name: "AbortError" });
  const result1 = handleStreamError(testErr, acTest.signal);
  console.log(`  classified as: "${result1}"`);

  // Test with TimeoutError
  const testTimeout = Object.assign(new Error("TimeoutError"), { name: "TimeoutError" });
  const result2 = handleStreamError(testTimeout);
  console.log(`  classified as: "${result2}"`);

  // Test with real error
  const testReal = new Error("ECONNRESET");
  const result3 = handleStreamError(testReal);
  console.log(`  classified as: "${result3}"`);

  console.log("\n✅ Error handling patterns done");
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function summary() {
  banner("SUMMARY", "Cheat-sheet");

  console.log(`
┌────────────────────────────────────────────────────────────────┐
│           LLM STREAMING + TRANSFORMS + ABORTCONTROLLER         │
├─────────────────────────┬──────────────────────────────────────┤
│ Pattern                 │ Use when                             │
├─────────────────────────┼──────────────────────────────────────┤
│ model.stream()          │ Always — get first token fast        │
│ Readable.from(stream)   │ Plug LangChain → Node pipeline       │
│ objectMode Transform    │ Work on AIMessageChunk objects       │
│ string Transform        │ Work on extracted text               │
│ _flush()                │ Emit summary/footer at end           │
│ AccumulatorWritable     │ Need full text + streaming display   │
│ PassThrough (tee)       │ Fan-out to multiple destinations     │
├─────────────────────────┼──────────────────────────────────────┤
│ AbortController         │ User clicks "Stop", or conditional   │
│ ac.abort(reason)        │ Any time — cancel immediately        │
│ Readable.from({signal}) │ Wire signal into the source          │
│ pipelineAsync({signal}) │ Cancel the entire chain              │
│ AbortSignal.timeout(ms) │ Hard deadline, no controller needed  │
├─────────────────────────┼──────────────────────────────────────┤
│ err.name==="AbortError" │ Manual cancellation                  │
│ err.name==="TimeoutError"│ AbortSignal.timeout() fired         │
│ signal.reason           │ Why it was aborted                   │
│ signal.aborted          │ Check if already cancelled           │
├─────────────────────────┼──────────────────────────────────────┤
│ { once: true } listener │ Cleanup on abort (DB close, flush)   │
└─────────────────────────┴──────────────────────────────────────┘

Flow diagram:
  LangChain model.stream()
        │
        ▼
  AsyncGenerator<AIMessageChunk>
        │
        ▼  Readable.from(gen, { objectMode:true, signal })
  Node Readable (objectMode)
        │
        ▼  Transform (objectMode → string)
  ExtractText
        │
        ▼  Transform (string → string)
  StripThinkTags / WordCount / WordWrap
        │
        ▼
  Writable (sink) or PassThrough (tee) or AccumulatorWritable
`);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  await setup();

  try {
    await partA_rawStreaming();
    await partB_transformPipeline();
    await partC_abortController();
    await partD_wordCountTransform();
    await partE_accumulatorWritable();
    await partF_tee();
    await partG_signalTimeout();
    await partH_errorHandling();
    summary();
  } finally {
    await cleanup();
    console.log("\n✅ All done. Tmp files cleaned up.");
  }
}

main().catch(console.error);
