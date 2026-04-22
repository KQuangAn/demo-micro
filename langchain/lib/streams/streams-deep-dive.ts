/**
 * ══════════════════════════════════════════════════════════════════
 *  NODE.JS STREAMS & FILE I/O — Deep Dive
 * ══════════════════════════════════════════════════════════════════
 *
 *  Run: pnpm streams
 *
 *  Topics covered:
 *
 *  PART A — fs.readFile       (load whole file into memory at once)
 *  PART B — fs.createReadStream  (read file chunk by chunk)
 *  PART C — Readable stream   (produce data on demand)
 *  PART D — Writable stream   (consume data, e.g. write to file)
 *  PART E — Transform stream  (read + modify + write in one pipe)
 *  PART F — Duplex stream     (read AND write independently)
 *  PART G — pipeline()        (connect streams safely, auto error handling)
 *  PART H — stream.Readable.from()  (turn any iterable into a stream)
 *  PART I — async iteration   (for await...of on any readable)
 *  PART J — backpressure      (what happens when writer is slower than reader)
 *  PART K — Readable deep dive (buffer, modes, _read, events)
 *  PART L — AbortController   (cancel streams cleanly)
 *
 * ══════════════════════════════════════════════════════════════════
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  QUICK-REFERENCE SUMMARY — read this first                     │
 * ├─────────────────────────────────────────────────────────────────┤
 * │                                                                 │
 * │  STREAM TYPES                                                   │
 * │  ─────────────────────────────────────────────────────────────  │
 * │  Readable   → produces data   (file read, HTTP body, generator) │
 * │  Writable   → consumes data   (file write, HTTP request, sink)  │
 * │  Transform  → reads + modifies + writes  (gzip, parse, upper)  │
 * │  Duplex     → read AND write independently  (TCP socket, WS)   │
 * │                                                                 │
 * │  HOW TO CREATE EACH                                             │
 * │  ─────────────────────────────────────────────────────────────  │
 * │  Readable:                                                      │
 * │    new Readable({ read() { this.push(data); this.push(null); }})│
 * │    Readable.from([1,2,3])          ← from array / iterable     │
 * │    Readable.from(async function*() { yield x; }())             │
 * │    createReadStream("file.txt")    ← from file                 │
 * │                                                                 │
 * │  Writable:                                                      │
 * │    new Writable({ write(chunk, enc, cb) { cb(); } })           │
 * │    createWriteStream("file.txt")   ← to file                   │
 * │                                                                 │
 * │  Transform (3 equivalent ways):                                 │
 * │    Way 1: new Transform({ transform(chunk, enc, cb) { cb(null, result); } })
 * │    Way 2: class MyT extends Transform { _transform(c,e,cb){} } │
 * │    Way 3: async function*(source) { for await(c of source) yield c.toUpperCase(); }
 * │                                                                 │
 * │  Transform callback patterns:                                   │
 * │    cb()              → done, push nothing                       │
 * │    cb(null, data)    → push data downstream + signal done       │
 * │    cb(new Error())   → signal error, abort pipeline             │
 * │    flush(cb)         → called at end — flush remaining buffer   │
 * │                                                                 │
 * │  CONNECTING STREAMS                                             │
 * │  ─────────────────────────────────────────────────────────────  │
 * │  a.pipe(b)                  ← simple, but errors DON'T propagate│
 * │  pipeline(a, b, c)          ← safe: errors destroy all streams  │
 * │  await pipelineAsync(a,b,c) ← promisified pipeline (use this)  │
 * │                                                                 │
 * │  READING A FILE — pick one                                      │
 * │  ─────────────────────────────────────────────────────────────  │
 * │  fs.readFile(p, cb)         whole file, callback                │
 * │  await readFile(p, "utf8")  whole file, async/await             │
 * │  createReadStream(p)        chunk by chunk, memory-safe         │
 * │  readline + createReadStream  line by line                      │
 * │  for await (const line of rl)  line by line, clean syntax       │
 * │                                                                 │
 * │  KEY READABLE CONCEPTS                                          │
 * │  ─────────────────────────────────────────────────────────────  │
 * │  highWaterMark  → soft buffer limit (default 16 KB / 16 objects)│
 * │  Paused mode   → data sits in buffer, you call .read() to pull  │
 * │  Flowing mode  → data events fire automatically (add 'data' listener)
 * │  push(null)    → ONLY way to end a Readable ('end' event fires) │
 * │  push() → false means buffer hit HWM, stop producing           │
 * │  setEncoding("utf8") → auto-decode chunks using StringDecoder   │
 * │  destroy(err)  → abort mid-flight ('close' fires, NOT 'end')    │
 * │                                                                 │
 * │  BACKPRESSURE                                                   │
 * │  ─────────────────────────────────────────────────────────────  │
 * │  writable.write() returns false  → buffer full, pause readable  │
 * │  writable emits "drain"          → buffer empty, resume reading │
 * │  pipe() / pipeline() handle this automatically                  │
 * │  Manual: check write() return, listen for "drain" event         │
 * │                                                                 │
 * │  ABORTING STREAMS                                               │
 * │  ─────────────────────────────────────────────────────────────  │
 * │  const ac = new AbortController();                              │
 * │  createReadStream(path, { signal: ac.signal })                  │
 * │  pipeline(a, b, c, { signal: ac.signal })                       │
 * │  ac.abort("reason") → destroys all streams, throws AbortError   │
 * │  AbortSignal.timeout(ms) → auto-fires after ms, no controller   │
 * │                                                                 │
 * │  KEY EVENTS                                                     │
 * │  ─────────────────────────────────────────────────────────────  │
 * │  Readable: data, end, readable, error, close, pause, resume     │
 * │  Writable: drain, finish, error, close                          │
 * │  'end'   fires when all data consumed (push(null) reached)      │
 * │  'finish' fires when writable.end() is called and drained       │
 * │  'close' fires after 'end'/'error' — underlying resource freed  │
 * │  'drain' fires when writable buffer empties (backpressure done) │
 * │                                                                 │
 * │  CHUNK, ENCODING, CALLBACK explained                            │
 * │  ─────────────────────────────────────────────────────────────  │
 * │  chunk    → Buffer by default; string if upstream set encoding; │
 * │             any value in objectMode                             │
 * │  encoding → string name ("utf8"), or "buffer" when chunk=Buffer │
 * │             usually ignored — just call chunk.toString()        │
 * │  callback → MUST call it; it's the backpressure lever           │
 * │             cb()           = done, push nothing                 │
 * │             cb(null, data) = push data + signal done            │
 * │             cb(err)        = signal error                        │
 * │                                                                 │
 * └─────────────────────────────────────────────────────────────────┘
 */



import fs from "fs";
import path from "path";
import { Readable, Writable, Transform, Duplex } from "stream";
import { pipeline } from "stream/promises";   // ← native promise version, no promisify needed
import { once } from "events";                 // ← await once(emitter, "event") instead of new Promise
import { createWriteStream, createReadStream } from "fs";
import { mkdir, writeFile, unlink } from "fs/promises";
import { setTimeout as sleep } from "timers/promises"; // ← await sleep(ms) instead of new Promise

// ── Temp directory for demo files ────────────────────────────────
const TMP = path.join(process.cwd(), ".stream-demo-tmp");

async function setup() {
    await mkdir(TMP, { recursive: true });
    // Write a sample text file we'll read in various ways
    await writeFile(
        path.join(TMP, "sample.txt"),
        Array.from({ length: 50 }, (_, i) => `Line ${i + 1}: Hello from Node.js streams!`).join("\n")
    );
    await writeFile(
        path.join(TMP, "numbers.txt"),
        Array.from({ length: 20 }, (_, i) => `${i + 1}`).join("\n")
    );
}

async function cleanup() {
    for (const f of ["sample.txt", "numbers.txt", "output.txt", "transformed.txt"]) {
        try { await unlink(path.join(TMP, f)); } catch { }
    }
    try { fs.rmdirSync(TMP); } catch { }
}

// ──────────────────────────────────────────────────────────────────
//  HEADER helper
// ──────────────────────────────────────────────────────────────────
function header(title: string) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${"═".repeat(60)}`);
}

function section(title: string) {
    console.log(`\n  ── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`);
}

// ══════════════════════════════════════════════════════════════════
//  PART A — fs.readFile
//  Reads the ENTIRE file into a Buffer / string in one shot.
//  Simple, but keeps the whole file in RAM.
//  Use when: file is small, you need all content before doing anything.
// ══════════════════════════════════════════════════════════════════

async function partA_readFile() {
    header("PART A — fs.readFile (whole file at once)");

    const filePath = path.join(TMP, "sample.txt");

    // ── A1: callback style ───────────────────────────────────────
    section("A1: Callback style → replaced with fs/promises.readFile");
    {
        const { readFile: readFileP } = await import("fs/promises");
        const data = await readFileP(filePath, "utf8");
        const lines = data.split("\n");
        console.log(`  Total lines   : ${lines.length}`);
        console.log(`  Total bytes   : ${Buffer.byteLength(data)} bytes`);
        console.log(`  First line    : "${lines[0]}"`);
        console.log(`  Last line     : "${lines.at(-1)}"`);
    }

    // ── A2: promise style (fs/promises) ─────────────────────────
    section("A2: Promise style (fs/promises) still read the whole file");
    const { readFile } = await import("fs/promises");
    const data = await readFile(filePath, "utf8");
    console.log(`  Read ${data.length} characters`);

    // ── A3: read as Buffer (binary) ──────────────────────────────
    section("A3: Buffer (binary mode — no encodin g)");
    const buf = await readFile(filePath);  // no encoding → returns Buffer
    console.log(`  Buffer length : ${buf.length} bytes`);
    console.log(`  First 10 bytes: [${[...buf.slice(0, 10)].join(", ")}]`);
    console.log(`  typeof result : ${typeof buf}  (Buffer, not string)`);

    // ── WHEN to use readFile vs streams ──────────────────────────
    section("A4: When to use readFile vs stream");
    console.log(`
  readFile()                      createReadStream()
  ──────────────────────────────  ──────────────────────────────
  Whole file in RAM               One chunk at a time
  Simple, one .then()             More code, but memory-safe
  ✓ Config files (small)          ✓ Log files (huge)
  ✓ Templates                     ✓ CSV import
  ✗ 500 MB CSV                    ✓ Video/audio
  `);
}

// ══════════════════════════════════════════════════════════════════
//  PART B — fs.createReadStream
//  Reads the file in chunks (highWaterMark = chunk size in bytes).
//  Node emits "data" events for each chunk, then "end".
//  RAM usage = one chunk, not the whole file.
// ══════════════════════════════════════════════════════════════════

async function partB_createReadStream() {
    header("PART B — fs.createReadStream (chunk by chunk)");

    const filePath = path.join(TMP, "sample.txt");

    // ── B1: listen to events manually ───────────────────────────
    section("B1: for await...of (modern — no event listeners needed)");
    {
        let chunkCount = 0;
        let totalBytes = 0;

        const stream = createReadStream(filePath, {
            encoding: "utf8",
            highWaterMark: 64,   // read 64 bytes per chunk (tiny, for demo)
            //                     real default = 64 KB (65536 bytes)
        });
        console.log(stream)
        for await (const chunk of stream) {
            chunkCount++;
            totalBytes += (chunk as string).length;
            if (chunkCount <= 3) {
                console.log(`  chunk[${chunkCount}] = "${(chunk as string).slice(0, 30).replace(/\n/g, "↵")}..." (${(chunk as string).length} chars)`);
            }
        }
        console.log(`  ... total: ${chunkCount} chunks, ${totalBytes} bytes`);
    }

    // ── B2: read specific byte range ─────────────────────────────
    section("B2: Read a specific byte range (start / end)");
    {
        const stream = createReadStream(filePath, { start: 0, end: 49, encoding: "utf8" });
        let result = "";
        for await (const c of stream) result += c;
        console.log(`  Bytes 0-49: "${result}"`);
    }

    // ── B3: pipe to a writable ───────────────────────────────────
    section("B3: pipe() — connect readable → writable");
    console.log(`
  createReadStream(src)
    .pipe(createWriteStream(dst))
    //   ↑ pipe() automatically calls write() on dst
    //   ↑ handles backpressure
    //   ↑ ends the writable when readable finishes
  `);
    await pipeline(
        createReadStream(filePath),
        createWriteStream(path.join(TMP, "output.txt"))
    );
    console.log(`  Copied to output.txt ✓`);
}

// ══════════════════════════════════════════════════════════════════
//  PART C — Readable stream (custom producer)
//  You push data into it, consumers pull from it.
//  Two modes:
//    • flowing   → data events fire automatically (.resume(), .pipe())
//    • paused    → consumer calls .read() manually
// ══════════════════════════════════════════════════════════════════

async function partC_readable() {
    header("PART C — Custom Readable stream");

    // ── C1: push-based readable (objectMode: false → Buffer/string) ─
    section("C1: push() string data");

    const words = ["Hello", " ", "from", " ", "a", " ", "Readable", "!"];

    const readable1 = new Readable({
        read() {
            // _read() is called when the consumer wants more data.
            // Push null to signal the end of the stream.
            const word = words.shift();
            this.push(word ?? null);   // null = EOF
        },
    });

    let result1 = "";
    readable1.setEncoding("utf8");
    for await (const c of readable1) result1 += c;
    console.log(`  Output: "${result1}"`);

    // ── C2: object mode readable ─────────────────────────────────
    section("C2: objectMode — push JS objects, not strings");

    const records = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Carol" },
    ];

    const objectStream = new Readable({
        objectMode: true,
        read() {
            const record = records.shift();
            this.push(record ?? null);
        },
    });

    for await (const obj of objectStream) {
        //                     ↑ async iteration — PART I covers this properly
        console.log(`  Record: ${JSON.stringify(obj)}`);
    }

    // ── C3: Readable.from() — easiest way ────────────────────────
    section("C3: Readable.from(iterable) — no class needed");

    async function* generate() {
        for (let i = 1; i <= 5; i++) {
            await sleep(10); // simulate async work
            yield `item-${i}\n`;
        }
    }

    const fromStream = Readable.from(generate());
    let out3 = "";
    for await (const chunk of fromStream) out3 += chunk;
    console.log(`  From async generator: ${out3.trim().split("\n").join(", ")}`);
}

// ══════════════════════════════════════════════════════════════════
//  PART D — Writable stream (custom consumer)
//  Receives data via .write() and .end().
//  _write() is called for each chunk — you decide what to do with it.
// ══════════════════════════════════════════════════════════════════

async function partD_writable() {
    header("PART D — Custom Writable stream");

    // ── D1: collect all chunks into an array ─────────────────────
    section("D1: Collect chunks (in-memory sink)");

    const collected: string[] = [];

    const sink = new Writable({
        defaultEncoding: "utf8",
        write(chunk, encoding, callback) {
            //        ↑ chunk = Buffer or string
            //               ↑ encoding (if string was pushed)
            //                        ↑ MUST call callback() when done
            collected.push(chunk.toString());
            callback();  // signals "ready for next chunk"
        },
    });

    sink.write("chunk-1\n");
    sink.write("chunk-2\n");
    sink.write("chunk-3\n");
    sink.end();  // no more writes after this

    await once(sink, "finish");
    console.log(`  Collected: ${collected.length} chunks`);
    collected.forEach((c, i) => console.log(`    [${i}] "${c.trim()}"`));

    // ── D2: writable in objectMode ───────────────────────────────
    section("D2: objectMode Writable");

    const totals = { count: 0, sum: 0 };

    const summer = new Writable({
        objectMode: true,
        write(obj: { value: number }, _enc, cb) {
            totals.count++;
            totals.sum += obj.value;
            cb();
        },
    });

    [10, 20, 30, 40].forEach((v) => summer.write({ value: v }));
    summer.end();

    await once(summer, "finish");
    console.log(`  count=${totals.count}  sum=${totals.sum}  avg=${totals.sum / totals.count}`);
}

// ══════════════════════════════════════════════════════════════════
//  PART E — Transform stream
//  Both Readable AND Writable.
//  Data flows IN through _transform(), modified data comes OUT.
//  Classic use: compression, encryption, parsing, uppercasing.
// ══════════════════════════════════════════════════════════════════

async function partE_transform() {
    header("PART E — Transform stream (read + modify + write)");

    // ── E1: uppercase transform ──────────────────────────────────
    section("E1: Uppercase transform");

    const upper = new Transform({
        transform(chunk: Buffer, _encoding: string, cb: (err: null, data: string) => void) {
            cb(null, chunk.toString().toUpperCase()); // cb(null, data) = push + callback in one
        },
    });

    upper.write("hello world\n");
    upper.write("from node.js\n");
    upper.end();

    let out = "";
    upper.setEncoding("utf8");
    for await (const chunk of upper) out += chunk;
    console.log(`  Input:  "hello world\\nfrom node.js"`);
    console.log(`  Output: "${out.trim()}"`);

    // ── E2: JSON-lines parser ─────────────────────────────────────
    section("E2: JSON-lines parser (string → object)");

    let jsonBuffer = "";
    const parser = new Transform({
        objectMode: true,         // output objects, not strings
        transform(chunk: Buffer, _enc: string, cb: () => void) {
            jsonBuffer += chunk.toString();
            const lines = jsonBuffer.split("\n");
            jsonBuffer = lines.pop()!; // keep incomplete last line in buffer
            for (const line of lines) {
                if (line.trim()) this.push(JSON.parse(line)); // emit parsed object
            }
            cb();
        },
        flush(cb: () => void) {
            // called when input ends — flush remaining buffer
            if (jsonBuffer.trim()) this.push(JSON.parse(jsonBuffer));
            cb();
        },
    });
    const jsonInput = [
        `{"id":1,"name":"Alice"}\n`,
        `{"id":2,"name":"Bob"}\n`,
        `{"id":3,"name":"Carol"}`,
    ];

    const parsed: any[] = [];
    parser.on("data", (obj) => parsed.push(obj));
    jsonInput.forEach((line) => parser.write(line));
    parser.end();

    await once(parser, "finish");
    parsed.forEach((p) => console.log(`  Parsed: ${JSON.stringify(p)}`));

    // ── E3: pipe chain ────────────────────────────────────────────
    section("E3: Chain transforms with pipe");
    console.log(`
  createReadStream("file.txt")                  // source
    .pipe(new Transform({ transform(chunk, _enc, cb) { cb(null, chunk.toString().toUpperCase()); } }))
    .pipe(new Transform({ transform(chunk, _enc, cb) { cb(null, chunk); } }))
    .pipe(createWriteStream("out"))              // sink

  Each .pipe() returns the next stream,
  so you can chain as many transforms as you want.
  `);

    createReadStream("file.txt").pipe(new Transform({
        transform(chunk, encoding, callback) {
            callback(null, chunk.toString().toUpperCase());
        },
    }))
}

// ══════════════════════════════════════════════════════════════════
//  PART F — Duplex stream
//  Has BOTH a readable side AND a writable side, but they are
//  INDEPENDENT — writing in doesn't automatically produce reads out.
//  (Unlike Transform where input → output)
//  Use case: network sockets, bidirectional communication.
// ══════════════════════════════════════════════════════════════════

async function partF_duplex() {
    header("PART F — Duplex stream (independent read + write)");

    section("F1: Duplex vs Transform");
    console.log(`
  Transform:                    Duplex:
  ┌──────────────┐              ┌──────────────┐
  │  write ──►   │              │  write side  │  ← independent
  │  (modify)    │              ├──────────────┤
  │  ──► read    │              │  read side   │  ← independent
  └──────────────┘              └──────────────┘
  Input causes output           Writing does NOT cause reading
  e.g. gzip, encrypt            e.g. TCP socket, WebSocket
  `);

    section("F2: Simple Duplex — echo with prefix");

    const messages: string[] = [];

    const echo = new Duplex({
        read(size) {
            // Called when someone reads from this stream.
            // We push whatever was last written to the write side.
            const msg = messages.shift();
            this.push(msg ? `[ECHO] ${msg}` : null);
        },
        write(chunk, _enc, cb) {
            // Called when someone writes to this stream.
            // We store it so read() can return it later.
            messages.push(chunk.toString().trim());
            cb();
        },
    });

    echo.write("Hello duplex!");
    echo.write("Second message");
    echo.end();

    echo.setEncoding("utf8");
    for await (const line of echo) {
        console.log(`  ${line}`);
    }
}

// ══════════════════════════════════════════════════════════════════
//  PART G — pipeline()
//  The RIGHT way to connect streams.
//  Unlike .pipe(), pipeline() properly:
//    • propagates errors from any stream in the chain
//    • destroys all streams on error (no memory leaks)
//    • works with async/await via promisify
// ══════════════════════════════════════════════════════════════════

async function partG_pipeline() {
    header("PART G — pipeline() (safe stream chaining)");

    section("G1: pipe() vs pipeline() error handling");
    console.log(`
  // ❌ pipe() — errors do NOT propagate automatically
  readable.pipe(transform).pipe(writable);
  //            ↑ if transform errors, writable is NOT destroyed
  //              → memory leak, hanging process

  // ✅ pipeline() — errors destroy ALL streams in the chain
  await pipeline(readable, transform, writable);
  //             ↑ any stream errors → all streams destroyed → promise rejects
  `);

    section("G2: Real pipeline — file → uppercase → file");

    const src = createReadStream(path.join(TMP, "sample.txt"));
    const upper = new Transform({
        transform(chunk, _enc, cb) {
            this.push(chunk.toString().toUpperCase());
            cb();
        },
    });
    const dst = createWriteStream(path.join(TMP, "transformed.txt"));

    await pipeline(src, upper, dst);
    console.log(`  pipeline complete: sample.txt → UPPER → transformed.txt ✓`);

    // Verify
    const { readFile } = await import("fs/promises");
    const check = await readFile(path.join(TMP, "transformed.txt"), "utf8");
    console.log(`  First 60 chars: "${check.slice(0, 60)}"`);

    section("G3: pipeline with async generator (Node 16+)");
    console.log(`
  // You can mix streams and async generators in pipeline():
  await pipeline(
    createReadStream("input.txt"),
    async function* (source) {
      for await (const chunk of source) {
        yield chunk.toString().toUpperCase();  // transform inline
      }
    },
    createWriteStream("output.txt")
  );
  `);
}

// ══════════════════════════════════════════════════════════════════
//  PART H — Readable.from()
//  The easiest way to create a readable from any iterable or
//  async iterable (array, generator, async generator, etc.)
// ══════════════════════════════════════════════════════════════════

async function partH_from() {
    header("PART H — Readable.from(iterable)");

    section("H1: From a plain array");
    const fromArray = Readable.from(["a", "b", "c", "d"]);
    const arrResult: string[] = [];
    for await (const chunk of fromArray) arrResult.push(chunk as string);
    console.log(`  Array → stream: [${arrResult.join(", ")}]`);

    section("H2: From a sync generator");
    function* range(start: number, end: number) {
        for (let i = start; i <= end; i++) yield i;
    }
    const fromGen = Readable.from(range(1, 5), { objectMode: true });
    const genResult: number[] = [];
    for await (const n of fromGen) genResult.push(n as number);
    console.log(`  Generator → stream: [${genResult.join(", ")}]`);

    section("H3: From an async generator (simulates API pagination)");
    async function* fetchPages() {
        const pages = [
            [{ id: 1 }, { id: 2 }],
            [{ id: 3 }, { id: 4 }],
            [{ id: 5 }],
        ];
        for (const page of pages) {
            await sleep(5); // simulate network delay
            for (const item of page) yield item;
        }
    }

    const fromAsync = Readable.from(fetchPages(), { objectMode: true });
    const items: any[] = [];
    for await (const item of fromAsync) items.push(item);
    console.log(`  Async generator → stream: ${items.length} items, ids=[${items.map((i) => i.id).join(",")}]`);
}

// ══════════════════════════════════════════════════════════════════
//  PART I — Async iteration (for await...of)
//  Any Readable can be iterated with for await...of.
//  Clean syntax, no event listeners needed.
//  Works with: file streams, HTTP responses, custom streams, generators.
// ══════════════════════════════════════════════════════════════════

async function partI_asyncIteration() {
    header("PART I — Async iteration (for await...of)");

    section("I1: Iterate a file stream line by line");

    // readline + createReadStream = line-by-line without loading whole file
    const { createInterface } = await import("readline");
    const rl = createInterface({
        input: createReadStream(path.join(TMP, "numbers.txt")),
        crlfDelay: Infinity,
    });

    let lineCount = 0;
    let sum = 0;
    for await (const line of rl) {
        lineCount++;
        sum += parseInt(line, 10);
    }
    console.log(`  Processed ${lineCount} lines, sum = ${sum}`);

    section("I2: Iterate a custom stream");
    async function* countdown(from: number) {
        for (let i = from; i >= 0; i--) {
            await sleep(2);
            yield i;
        }
    }

    const stream = Readable.from(countdown(5), { objectMode: true });
    const nums: number[] = [];
    for await (const n of stream) nums.push(n as number);
    console.log(`  Countdown: ${nums.join(" → ")}`);

    section("I3: break out early (partial read)");
    const bigStream = Readable.from(
        (function* () { let i = 0; while (true) yield ++i; })(),
        { objectMode: true }
    );

    const first5: number[] = [];
    for await (const n of bigStream) {
        first5.push(n as number);
        if (first5.length >= 5) break;  // stop reading — stream is destroyed
    }
    console.log(`  First 5 from infinite stream: [${first5.join(", ")}]`);
}

// ══════════════════════════════════════════════════════════════════
//  PART J — Backpressure
//  The most important stream concept for performance.
//  When a Writable is slower than a Readable, data queues up in RAM.
//  Backpressure is the mechanism to pause the Readable until
//  the Writable drains.
// ══════════════════════════════════════════════════════════════════

async function partJ_backpressure() {
    header("PART J — Backpressure");

    section("J1: What is backpressure?");
    console.log(`
  Readable (fast)          Writable (slow)
  ─────────────────────    ─────────────────────
  push 1000 items/sec  →   can only handle 100/sec

  Without backpressure → buffer grows → OOM crash

  With backpressure:
    writable.write() returns FALSE when buffer is full
    ↓
    readable.pause() — stop producing data
    ↓
    writable emits "drain" when buffer empties
    ↓
    readable.resume() — start producing again
  `);

    section("J2: Manual backpressure (without pipe)");

    let written = 0;
    let pauses = 0;

    const slow = new Writable({
        highWaterMark: 5,         // buffer fills after 5 items
        objectMode: true,
        write(chunk, _enc, cb) {
            written++;
            setTimeout(cb, 1);      // simulate slow write
        },
    });

    const producer = new Readable({
        objectMode: true,
        read() { },                // we push manually below
    });

    // Push 20 items, respect backpressure
    let i = 0;
    function pushNext() {
        while (i < 20) {
            const ok = slow.write({ i: ++i });
            if (!ok) {
                // buffer is full — wait for drain before pushing more
                pauses++;
                slow.once("drain", pushNext);
                return;
            }
        }
        slow.end();
    }

    pushNext();
    await once(slow, "finish");
    console.log(`  Wrote ${written} items, backpressure triggered ${pauses} time(s)`);

    section("J3: pipe() handles backpressure automatically");
    console.log(`
  createReadStream("huge.csv")
    .pipe(createWriteStream("copy.csv"))
    //   ↑ pipe() calls readable.pause() when writable returns false
    //   ↑ and readable.resume() on 'drain'
    //   ↑ you never think about it

  This is why pipe() / pipeline() exist.
  If you write manual stream code, YOU must handle backpressure.
  `);
}

// ══════════════════════════════════════════════════════════════════
//  SUMMARY CHEAT SHEET
// ══════════════════════════════════════════════════════════════════

function summary() {
    header("SUMMARY — Node.js Streams Cheat Sheet");
    console.log(`
  TYPE          CLASS        DIRECTION      USE CASE
  ────────────  ───────────  ─────────────  ──────────────────────────────
  Readable      Readable     → out          File read, HTTP response body
  Writable      Writable     in →           File write, HTTP request body
  Transform     Transform    in → modify →  Gzip, encrypt, parse CSV/JSON
  Duplex        Duplex       in + out       TCP socket, WebSocket

  KEY EVENTS
  ─────────────────────────────────────────────────────
  Readable:  data, end, error, readable, close
  Writable:  drain, finish, error, close
  Both:      pipe, unpipe

  KEY METHODS
  ─────────────────────────────────────────────────────
  readable.pipe(writable)     connect streams (basic)
  pipeline(a, b, c)           connect streams (safe, use this)
  readable.pause()            stop flowing mode
  readable.resume()           restart flowing mode
  writable.write(chunk)       returns false if buffer full (backpressure)
  writable.end()              no more writes

  READING A FILE — pick one:
  ─────────────────────────────────────────────────────
  fs.readFile(path, cb)           whole file, callback
  await fs/promises.readFile()    whole file, async/await
  createReadStream(path)          chunks, memory-safe
  readline + createReadStream     line by line
  for await (const line of rl)    line by line, clean syntax

  CREATING A READABLE — pick one:
  ─────────────────────────────────────────────────────
  new Readable({ read() })        full control
  Readable.from([1,2,3])          from array
  Readable.from(generator())      from (async) generator  ← simplest
  `);
}

// ══════════════════════════════════════════════════════════════════
//  PART K — Readable DEEP DIVE
//
//  Everything about the Readable class in one place:
//    K1  Internal buffer + highWaterMark
//    K2  Two modes: paused vs flowing — and how you switch
//    K3  _read() — the pull mechanism explained
//    K4  push(null) — signalling EOF
//    K5  push() return value — internal backpressure signal
//    K6  readable event vs data event
//    K7  .read(n) — manual pull in paused mode
//    K8  setEncoding() — decode chunks automatically
//    K9  destroy() — abort a stream mid-flight
//    K10 Events: data, end, readable, error, close, pause, resume
// ══════════════════════════════════════════════════════════════════

async function partK_readableDeepDive() {
    header("PART K — Readable DEEP DIVE");

    // ── K1: Internal buffer + highWaterMark ─────────────────────
    section("K1: Internal buffer + highWaterMark");
    console.log(`
  Every Readable has an internal buffer (a linked list of chunks).
  highWaterMark = the SOFT limit on how many bytes (or objects) to
                  buffer before telling the producer to slow down.

  Default highWaterMark:
    Binary mode  → 16 384 bytes  (16 KB)
    objectMode   → 16 objects
    String mode  → 16 384 chars

  ┌─────────────────────────────────────────────────────────┐
  │  Readable internal buffer                               │
  │                                                         │
  │  [chunk1][chunk2][chunk3]...[chunkN]                    │
  │  ◄──────────────────────────────────►                   │
  │              buffered bytes                             │
  │                                                         │
  │  When buffered >= highWaterMark:                        │
  │    push() returns FALSE  ← "stop producing for now"    │
  │  When consumer reads:                                   │
  │    buffer drains → _read() is called again             │
  └─────────────────────────────────────────────────────────┘

  highWaterMark is a HINT, not a hard cap.
  You can push past it — Node won't throw. It just signals "slow down".
  `);

    // ── K2: Two modes — paused vs flowing ───────────────────────
    section("K2: Paused mode vs Flowing mode");
    console.log(`
  A Readable starts in PAUSED mode.

  ┌─────────────────────────────────────────────────────────┐
  │  PAUSED mode                  FLOWING mode              │
  │                                                         │
  │  Data sits in buffer.         Data events fire          │
  │  Consumer must call           automatically as fast     │
  │  .read() to pull chunks.      as data arrives.          │
  │                                                         │
  │  Nothing is lost —            If no 'data' handler,     │
  │  data waits for you.          data IS lost (dropped).   │
  └─────────────────────────────────────────────────────────┘

  HOW TO SWITCH:

  Paused → Flowing:
    stream.on("data", handler)  ← adding a data listener starts flow
    stream.resume()             ← explicit resume
    stream.pipe(writable)       ← pipe always puts it in flowing mode

  Flowing → Paused:
    stream.pause()              ← explicit pause
    stream.unpipe()             ← removing pipe destination
  `);

    // Prove it with code
    section("K2 demo: start paused, switch to flowing");
    const slowSource = new Readable({
        highWaterMark: 2,
        read() { },   // we push manually
    });

    const received: number[] = [];
    // Stream is PAUSED right now — nothing flows yet

    slowSource.push(Buffer.from([1]));
    slowSource.push(Buffer.from([2]));
    slowSource.push(Buffer.from([3]));
    slowSource.push(null); // EOF

    console.log(`  isPaused before listener: ${slowSource.isPaused()}`);  // true

    // Adding 'data' listener → switches to FLOWING mode
    slowSource.on("data", (chunk: Buffer) => received.push(chunk[0]));
    await once(slowSource, "end");

    console.log(`  isPaused after listener:  ${slowSource.isPaused()}`);   // false
    console.log(`  received chunks: [${received.join(", ")}]`);

    // ── K3: _read() — the pull mechanism ────────────────────────
    section("K3: _read(size) — the pull contract");
    console.log(`
  _read(size) is called by Node when the consumer wants more data.
  It is NOT called on a schedule — only when the buffer is below
  highWaterMark AND a consumer is actively reading.

  The contract:
    1. Node calls _read(size)         ← "give me up to \`size\` bytes"
    2. You call this.push(chunk)      ← "here is some data"
    3. Node calls _read() again       ← "give me more"
    4. You call this.push(null)       ← "I'm done, no more data"
    5. 'end' event fires              ← consumer knows stream is finished

  size is a HINT — you can push less or more than size bytes.
  Most implementations ignore size entirely.

  ┌─────────────────────────────────────────────────────────┐
  │  Consumer reads         →  _read() called               │
  │  this.push(chunk)       →  chunk goes into buffer       │
  │  Consumer reads again   →  _read() called again         │
  │  this.push(null)        →  'end' event fires            │
  └─────────────────────────────────────────────────────────┘
  `);

    // K3 demo: count how many times _read is called
    let readCalls = 0;
    const items = [10, 20, 30, 40, 50];

    const counted = new Readable({
        objectMode: true,
        read() {
            readCalls++;
            const val = items.shift();
            this.push(val ?? null);
        },
    });

    const out: number[] = [];
    for await (const v of counted) out.push(v as number);
    console.log(`  _read() called ${readCalls} times to produce ${out.length} items`);
    console.log(`  values: [${out.join(", ")}]`);
    // _read is called once per item + once more to get the null (EOF)

    // ── K4: push(null) — EOF ────────────────────────────────────
    section("K4: push(null) — how a stream signals it is finished");
    console.log(`
  this.push(null)   ← the ONLY way to end a Readable properly

  After push(null):
    • No more data can be pushed (ignored / throws)
    • Buffer drains normally
    • When buffer is empty → 'end' event fires
    • for await...of loop exits
    • .pipe() destination gets .end() called

  Common mistake:
    forgetting push(null) → stream hangs forever,
    consumer waits for 'end' that never comes.
  `);

    // K4 demo: show hanging vs proper end
    const proper = new Readable({
        read() {
            this.push("data");
            this.push(null);  // ← without this, 'end' never fires
        },
    });
    const chunks: string[] = [];
    proper.setEncoding("utf8");
    for await (const c of proper) chunks.push(c);
    console.log(`  Proper end — got: "${chunks.join("")}", stream ended ✓`);

    // ── K5: push() return value — producer backpressure ─────────
    section("K5: push() return value");
    console.log(`
  const ok = this.push(chunk);

  ok === true   → buffer is below highWaterMark, keep pushing
  ok === false  → buffer is AT or ABOVE highWaterMark, stop pushing
                  Node will call _read() again when buffer drains

  This is backpressure FROM the readable's perspective:
    The readable tells its OWN producer to slow down.
    (Not the same as writable backpressure from PART J)
  `);

    const hwm2 = new Readable({ highWaterMark: 3, read() { } });
    const results: boolean[] = [];
    results.push(hwm2.push(Buffer.from("a")));   // 1 byte — likely true
    results.push(hwm2.push(Buffer.from("b")));   // 2 bytes
    results.push(hwm2.push(Buffer.from("c")));   // 3 bytes — hits HWM
    results.push(hwm2.push(Buffer.from("d")));   // 4 bytes — over HWM
    hwm2.push(null);
    hwm2.resume(); // drain it
    await once(hwm2, "end");
    console.log(`  push() return values: [${results.join(", ")}]`);
    console.log(`  (false = buffer hit highWaterMark of 3)`);

    // ── K6: 'readable' event vs 'data' event ────────────────────
    section("K6: 'readable' event vs 'data' event");
    console.log(`
  'data'  event → FLOWING mode. Fires for each chunk automatically.
                  You receive chunks as they arrive.

  'readable' event → PAUSED mode. Fires when there is data in the
                  buffer ready to be read. YOU call .read() to pull.

  'data':
    stream.on("data", (chunk) => process(chunk));
    // Node pushes chunks to you

  'readable':
    stream.on("readable", () => {
      let chunk;
      while ((chunk = stream.read()) !== null) {
        process(chunk);
      }
    });
    // You pull chunks from Node
  `);

    // K6 demo: readable event + manual .read()
    const manualSrc = Readable.from(["x", "y", "z"]);
    const pulled: string[] = [];

    manualSrc.on("readable", () => {
        let chunk: string | null;
        while ((chunk = manualSrc.read() as string | null) !== null) {
            pulled.push(chunk);
        }
    });
    await once(manualSrc, "end");
    console.log(`  Pulled via 'readable': [${pulled.map((c) => `"${c}"`).join(", ")}]`);

    // ── K7: .read(n) — read exactly n bytes ─────────────────────
    section("K7: .read(n) — pull exactly N bytes in paused mode");
    console.log(`
  stream.read()    → pull ALL buffered data
  stream.read(n)   → pull exactly n bytes (returns null if not enough buffered)

  Use case: binary protocols where you know the message size upfront.
    e.g. "first 4 bytes = message length, rest = message body"
  `);

    const binSrc = new Readable({ read() { } });
    // Simulate a 4-byte length header followed by 8 bytes of body
    const header4 = Buffer.alloc(4);
    header4.writeUInt32BE(8, 0);         // message body is 8 bytes long
    binSrc.push(header4);
    binSrc.push(Buffer.from("ABCDEFGH")); // 8-byte body
    binSrc.push(null);

    await once(binSrc, "readable");
    const len = (binSrc.read(4) as Buffer).readUInt32BE(0);
    const body = binSrc.read(len) as Buffer;
    console.log(`  Header says body length = ${len}`);
    console.log(`  Body: "${body.toString("ascii")}"`);

    // ── K8: setEncoding() ────────────────────────────────────────
    section("K8: setEncoding() — decode chunks automatically");
    console.log(`
  Without setEncoding:  chunk is a Buffer (raw bytes)
  With setEncoding:     chunk is a string (decoded for you)

  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    // chunk is already a string — no .toString() needed
  });

  Internally, Node uses a StringDecoder that handles
  multi-byte UTF-8 characters split across chunk boundaries correctly.

  // ❌ naive: chunk.toString() can corrupt multi-byte chars split at boundaries
  // ✅ correct: stream.setEncoding("utf8") uses StringDecoder internally
  `);

    // ── K9: destroy() — abort mid-flight ────────────────────────
    section("K9: destroy() — abort a stream");
    console.log(`
  stream.destroy()           → abort, emit 'close', no 'end'
  stream.destroy(new Error)  → abort with error, emit 'error' then 'close'

  Use when:
    • User cancels a download
    • Request timeout
    • Processing error — you don't want more data

  After destroy():
    • push() is silently ignored
    • 'end' event does NOT fire (use 'close' instead)
    • for await...of throws the error (if one was passed)
  `);

    let pushCount = 0;
    const abortable = new Readable({
        read() {
            // Stop pushing after 3 items so the stream doesn't spin forever
            if (pushCount++ < 3) this.push(`data-${pushCount}`);
        },
    });

    let destroyReceived = "";
    abortable.on("close", () => { destroyReceived = "close fired ✓ (not 'end')"; });
    abortable.resume();                          // start flowing
    await sleep(5); // let a few chunks flow
    abortable.destroy();                         // abort — 'end' will NOT fire
    await sleep(10);
    console.log(`  ${destroyReceived}`);

    // ── K10: All events ──────────────────────────────────────────
    section("K10: Every Readable event explained");
    console.log(`
  EVENT       WHEN IT FIRES                          DO WHAT
  ──────────  ─────────────────────────────────────  ──────────────────────
  'data'      a chunk is ready (flowing mode)        process chunk
  'end'       all data consumed, push(null) reached  cleanup
  'readable'  buffer has data (paused mode)          call .read() in a loop
  'error'     something went wrong                   handle or rethrow
  'close'     underlying resource closed             final cleanup
  'pause'     stream switched to paused mode         (informational)
  'resume'    stream switched to flowing mode        (informational)

  IMPORTANT ORDERING:
    'end' fires BEFORE 'close'
    'error' fires BEFORE 'close'
    'data' fires AFTER 'readable' would

  COMMON MISTAKE:
    Listening to both 'data' and 'readable' on the same stream
    → unpredictable behaviour. Pick ONE mode.
  `);
}

// ══════════════════════════════════════════════════════════════════
//  PART L — AbortController with Streams
//
//  AbortController is the standard Web API for cancelling async work.
//  Node.js streams accept an AbortSignal in their options — when the
//  signal fires, the stream is destroyed automatically.
//
//  Topics:
//    L1  What AbortController / AbortSignal is
//    L2  createReadStream with AbortSignal  (file read cancellation)
//    L3  pipeline() with AbortSignal        (abort the whole chain)
//    L4  Readable.from() + AbortSignal      (async generator cancellation)
//    L5  Manual signal listener             (destroy on abort yourself)
//    L6  AbortController with timeout       (AbortSignal.timeout())
//    L7  Reason — why was it aborted?
// ══════════════════════════════════════════════════════════════════

async function partL_abortController() {
    header("PART L — AbortController with Streams");

    // ── L1: What AbortController is ─────────────────────────────
    section("L1: AbortController — the mental model");
    console.log(`
  AbortController is a controller/signal pair:

    const ac     = new AbortController();
    const signal = ac.signal;              // ← pass this to streams/fetch/etc.

    ac.abort("reason");                    // ← fire it from anywhere

  ┌───────────────────────────────────────────────────────┐
  │  AbortController                                      │
  │    .signal  ──────────────────►  AbortSignal          │
  │                                    .aborted  boolean  │
  │                                    .reason   any      │
  │    .abort(reason)  ────────────►   fires 'abort' event│
  └───────────────────────────────────────────────────────┘

  The pattern:
    • YOU hold the AbortController  (you decide when to cancel)
    • You PASS the signal to streams, fetch, etc.
    • When you call .abort() → everything that received the signal
      cleans itself up automatically

  Node streams accept: { signal: ac.signal }
    createReadStream(path, { signal })
    createWriteStream(path, { signal })
    pipeline(a, b, c, { signal })
    new Readable({ signal })             (Node 18+)
  `);

    // ── L2: createReadStream with AbortSignal ───────────────────
    section("L2: createReadStream — cancel mid-read");

    const ac1 = new AbortController();
    const filePath = path.join(TMP, "sample.txt");

    let l2chunks = 0;
    let l2error = "";

    const l2stream = createReadStream(filePath, {
        highWaterMark: 64,
        signal: ac1.signal,              // ← pass signal here
    });

    l2stream.on("data", () => {
        l2chunks++;
        if (l2chunks === 3) {
            // After 3 chunks, cancel the read
            ac1.abort("user cancelled");   // ← destroys stream immediately
        }
    });

    await Promise.race([
        once(l2stream, "end"),
        once(l2stream, "error").then(([err]: any[]) => { l2error = err.name; }),
    ]);

    console.log(`  Read ${l2chunks} chunks before abort`);
    console.log(`  Error type: "${l2error}"    ← AbortError, not a crash`);
    console.log(`  Signal aborted: ${ac1.signal.aborted}   reason: "${ac1.signal.reason}"`);

    // ── L3: pipeline() with AbortSignal ─────────────────────────
    section("L3: pipeline() — abort the entire chain at once");
    console.log(`
  // One signal aborts ALL streams in the chain simultaneously:

  const ac = new AbortController();

  setTimeout(() => ac.abort("timeout"), 100);   // abort after 100ms

  try {
    await pipeline(
      createReadStream("huge.csv"),
      new Transform({ ... }),
      createWriteStream("output.csv"),
      { signal: ac.signal }           // ← ONE signal covers the whole chain
    );
  } catch (err) {
    if (err.name === "AbortError") console.log("Cancelled cleanly");
    else throw err;
  }

  Without the signal, you'd have to call .destroy() on EACH stream manually.
  `);

    // Real demo: abort pipeline after 1 chunk
    const ac3 = new AbortController();
    let l3chunksProcessed = 0;

    try {
        await pipeline(
            createReadStream(filePath, { highWaterMark: 64 }),
            new Transform({
                transform(chunk, _enc, cb) {
                    l3chunksProcessed++;
                    if (l3chunksProcessed === 2) ac3.abort("processed enough");
                    cb(null, chunk); // cb(null, data) = push + signal ready in one call
                },
            }),
            new Writable({ write(_c, _e, cb) { cb(); } }),
            { signal: ac3.signal },
        );
    } catch (err: any) {
        console.log(`  pipeline aborted after ${l3chunksProcessed} chunk(s)`);
        console.log(`  Error: ${err.name}  reason: "${ac3.signal.reason}"`);
    }

    // ── L4: Readable.from() + AbortSignal ───────────────────────
    section("L4: Readable.from() async generator — abort via signal");
    console.log(`
  When the signal fires inside an async generator, throwing AbortError
  causes the for await loop on the stream side to also throw AbortError.
  `);

    const ac4 = new AbortController();

    // Async generator that respects an abort signal
    async function* infiniteCounter(signal: AbortSignal) {
        let i = 0;
        while (true) {
            if (signal.aborted) {
                // Clean way: throw so the pipeline knows why we stopped
                throw signal.reason;
            }
            await sleep(5);
            yield ++i;
        }
    }

    // Abort after 25ms — should have produced ~5 items
    setTimeout(() => ac4.abort(new Error("time limit reached")), 25);

    const l4items: number[] = [];
    try {
        for await (const n of Readable.from(infiniteCounter(ac4.signal), { objectMode: true })) {
            l4items.push(n as number);
        }
    } catch (err: any) {
        console.log(`  Produced ${l4items.length} items: [${l4items.join(", ")}]`);
        console.log(`  Stopped because: "${err.message}"`);
    }

    // ── L5: Manual signal listener — destroy yourself ───────────
    section("L5: Manual signal listener (for streams that don't accept signal)");
    console.log(`
  Older streams or third-party streams may not accept a signal option.
  You can still wire up AbortController manually:
  `);

    const ac5 = new AbortController();

    const legacyStream = new Readable({
        // No signal option — older API
        read() { },
    });

    // Wire it up yourself:
    const onAbort = () => {
        legacyStream.destroy(new Error(`Aborted: ${ac5.signal.reason}`));
    };

    ac5.signal.addEventListener("abort", onAbort, { once: true });

    legacyStream.push("chunk-1");
    legacyStream.push("chunk-2");

    let l5received: string[] = [];
    let l5err = "";

    legacyStream.setEncoding("utf8");
    legacyStream.on("data", (c) => l5received.push(c.trim()));

    // Abort after a short delay
    setTimeout(() => ac5.abort("manual stop"), 10);

    await Promise.race([
        once(legacyStream, "end"),
        once(legacyStream, "error").then(([e]: any[]) => { l5err = e.message; }),
    ]);

    console.log(`  Received: [${l5received.map((s) => `"${s}"`).join(", ")}]`);
    console.log(`  Destroyed with error: "${l5err}"`);

    // Cleanup: remove listener to avoid leaks
    ac5.signal.removeEventListener("abort", onAbort);

    // ── L6: AbortSignal.timeout() ────────────────────────────────
    section("L6: AbortSignal.timeout(ms) — built-in timeout, no controller needed");
    console.log(`
  AbortSignal.timeout(ms) creates a signal that fires automatically
  after ms milliseconds — no AbortController needed.

  // Abort file read if it takes longer than 5 seconds:
  const stream = createReadStream("huge.file", {
    signal: AbortSignal.timeout(5000)
  });

  // Abort pipeline after 30 seconds:
  await pipeline(src, transform, dst, {
    signal: AbortSignal.timeout(30_000)
  });
  `);

    // Demo: timeout fires before stream finishes
    let l6chunks = 0;
    let l6errName = "";

    const l6stream = createReadStream(filePath, {
        highWaterMark: 64,
        signal: AbortSignal.timeout(1),   // abort after 1ms
    });
    l6stream.on("data", () => l6chunks++);
    await Promise.race([
        once(l6stream, "end"),
        once(l6stream, "error").then(([e]: any[]) => { l6errName = e.name; }),
    ]);

    console.log(`  Chunks read before timeout: ${l6chunks}`);
    console.log(`  Error: "${l6errName}"   (TimeoutError — a subtype of AbortError)`);

    // ── L7: Reason — what aborted and why ───────────────────────
    section("L7: Abort reason — communicate WHY it was cancelled");
    console.log(`
  ac.abort()                    → signal.reason = DOMException("signal is aborted without reason")
  ac.abort("string reason")     → signal.reason = "string reason"
  ac.abort(new Error("..."))    → signal.reason = Error instance
  AbortSignal.timeout(ms)       → signal.reason = TimeoutError (DOMException)

  Check reason to decide how to handle it:
  `);

    const reasons = [
        { label: "user cancel", abort: () => { const ac = new AbortController(); ac.abort("user clicked cancel"); return ac.signal; } },
        { label: "timeout", abort: () => AbortSignal.timeout(0) },
    ];

    for (const { label, abort } of reasons) {
        const signal = abort();
        await sleep(5); // let timeout fire
        const reason = signal.reason;
        console.log(`  [${label}]  aborted=${signal.aborted}  reason=${reason instanceof Error ? reason.name : JSON.stringify(reason)}`);
    }

    console.log(`
  // Idiomatic error handling pattern:
  try {
    await pipeline(src, dst, { signal });
  } catch (err) {
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      // expected cancellation — handle gracefully
    } else {
      throw err;  // real error — rethrow
    }
  }
  `);
}

// ══════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════

async function main() {
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║  NODE.JS STREAMS & FILE I/O — Complete Deep Dive         ║");
    console.log("╚══════════════════════════════════════════════════════════╝");

    await setup();

    await partA_readFile();
    await partB_createReadStream();
    await partC_readable();
    await partD_writable();
    await partE_transform();
    await partF_duplex();
    await partG_pipeline();
    await partH_from();
    await partI_asyncIteration();
    await partJ_backpressure();
    await partK_readableDeepDive();
    await partL_abortController();

    summary();

    await cleanup();
    console.log("\n  ✅ All done. Temp files cleaned up.");
}

main().catch(console.error);
