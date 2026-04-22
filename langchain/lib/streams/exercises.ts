/**
 * ══════════════════════════════════════════════════════════════════
 *  NODE.JS STREAMS — Exercises
 * ══════════════════════════════════════════════════════════════════
 *
 *  Run: pnpm tsx lib/streams/exercises.ts
 *
 *  Each exercise has:
 *    - A clear task description
 *    - Hints if you need them
 *    - A TODO marker for where to write your code
 *    - An expected output at the bottom
 *
 *  Work through them top to bottom.
 *  Uncomment each exercise call in main() as you go.
 *
 * ══════════════════════════════════════════════════════════════════
 */

import fs from "fs";
import path from "path";
import { Readable, Writable, Transform, pipeline } from "stream";
import { promisify } from "util";
import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import { createReadStream, createWriteStream } from "fs";
import { createInterface } from "readline";
import { getModel } from "../model-cache";

const pipelineAsync = promisify(pipeline);

// ── Temp directory ────────────────────────────────────────────────
const TMP = path.join(process.cwd(), ".exercises-tmp");

async function setup() {
    await mkdir(TMP, { recursive: true });

    // A text file with 30 lines
    await writeFile(
        path.join(TMP, "words.txt"),
        Array.from({ length: 30 }, (_, i) => `line-${i + 1}: the quick brown fox jumps over the lazy dog`).join("\n")
    );

    // A JSON-lines file (one JSON object per line)
    const users = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace", "Hank", "Ivy", "Jack"][i],
        score: Math.floor(50 + i * 5),
    }));
    await writeFile(
        path.join(TMP, "users.jsonl"),
        users.map((u) => JSON.stringify(u)).join("\n")
    );

    // A CSV file
    const csvRows = [
        "name,age,city",
        "Alice,30,New York",
        "Bob,25,London",
        "Carol,35,Paris",
        "Dave,28,Tokyo",
        "Eve,32,Sydney",
    ];
    await writeFile(path.join(TMP, "people.csv"), csvRows.join("\n"));

    // A large numbers file (for backpressure exercise)
    await writeFile(
        path.join(TMP, "numbers.txt"),
        Array.from({ length: 100 }, (_, i) => String(i + 1)).join("\n")
    );
}

async function cleanup() {
    for (const f of ["words.txt", "users.jsonl", "people.csv", "numbers.txt", "output.txt", "upper.txt", "filtered.txt"]) {
        try { await unlink(path.join(TMP, f)); } catch { }
    }
    try { fs.rmdirSync(TMP); } catch { }
}

function header(n: number, title: string) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  EXERCISE ${n}: ${title}`);
    console.log(`${"═".repeat(60)}`);
}

// ══════════════════════════════════════════════════════════════════
//  EXERCISE 1 — fs.readFile
//
//  TASK:
//    Read the file at `path.join(TMP, "words.txt")` using
//    fs.readFile (callback style), then:
//      1. Count the total number of lines
//      2. Count the total number of words (split by whitespace)
//      3. Print both counts
//
//  HINTS:
//    - data.split("\n") gives you lines
//    - data.split(/\s+/) gives you words
//    - wrap in a Promise<void> so you can await it
//
//  EXPECTED OUTPUT:
//    Lines : 30
//    Words : 270
// ══════════════════════════════════════════════════════════════════

async function exercise1_readFile() {
    header(1, "fs.readFile — count lines and words");

    // try {
    //     const stream = createReadStream(path.join(TMP, "words.txt"), { encoding: "utf-8", highWaterMark: 16 * 1024 });
    //     for await (const chunk of stream) {
    //         console.log(chunk, 123)
    //     }
    // } catch (err) {
    //     console.error(err);
    // }
    // TODO: Read words.txt with fs.readFile (callback style)
    // TODO: Count lines and words
    // TODO: Print:  Lines : 30   Words : 270
}

// ══════════════════════════════════════════════════════════════════
//  EXERCISE 2 — createReadStream + chunks
//
//  TASK:
//    Stream the same "words.txt" file using createReadStream
//    with a highWaterMark of 128 bytes.
//    Count:
//      1. How many chunks were emitted
//      2. The total bytes received
//    Print both.
//
//  HINTS:
//    - Listen to the "data" event
//    - chunk is a Buffer — chunk.length gives byte count
//    - Listen to "end" to know when it's done
//
//  EXPECTED OUTPUT (roughly):
//    Chunks : ~17
//    Bytes  : 1680  (will vary by platform line endings)
// ══════════════════════════════════════════════════════════════════

async function exercise2_createReadStream() {
    header(2, "createReadStream — count chunks vs bytes");

    try {
        const stream = createReadStream(path.join(TMP, "words.txt"), { encoding: "utf-8", highWaterMark: 128 });
        let count = 0;
        let totalBytes = 0;

        for await (const chunk of stream) {
            count += 1
            totalBytes += chunk.length;
        }

        console.log(count, totalBytes);
    } catch (err) {
        console.error(err);
    }
    // TODO: Open words.txt with createReadStream({ highWaterMark: 128 })
    // TODO: Count chunks (data events) and total bytes
    // TODO: Print both counts when "end" fires
}

// ══════════════════════════════════════════════════════════════════
//  EXERCISE 3 — readline (line by line)
//
//  TASK:
//    Use readline + createReadStream to read "words.txt" line by line.
//    Find and print ONLY the lines that contain the word "fox".
//
//  HINTS:
//    - createInterface({ input: createReadStream(...) })
//    - for await (const line of rl) { ... }
//    - line.includes("fox")
//
//  EXPECTED OUTPUT:
//    line-1: the quick brown fox jumps over the lazy dog
//    line-2: the quick brown fox jumps over the lazy dog
//    ... (all 30 lines contain "fox", so 30 matches)
// ══════════════════════════════════════════════════════════════════

async function exercise3_readline() {
    header(3, "readline — line-by-line filter");

    try {
        const stream = createReadStream(path.join(TMP, "words.txt"), { encoding: "utf-8", highWaterMark: 128 });
        let count = 0;
        let totalBytes = 0;

        for await (const chunk of stream) {
            count += 1
            totalBytes += chunk.length;
        }

        console.log(count, totalBytes);
    } catch (err) {
        console.error(err);
    }

    // TODO: Open words.txt via readline + createReadStream
    // TODO: Print only lines that contain "fox"
    // TODO: At the end print: Matching lines: 30
}

// ══════════════════════════════════════════════════════════════════
//  EXERCISE 4 — new Readable (custom producer)
//
//  TASK:
//    Create a custom Readable stream (using `new Readable`) that
//    produces the Fibonacci sequence — one number per chunk — and
//    stops after producing 10 numbers.
//
//    Collect all produced values and print them.
//
//  HINTS:
//    - Store state (a, b) outside the Readable in a closure
//    - In `read()`: this.push(String(a) + "\n"), then advance a/b
//    - After 10 numbers: this.push(null)   ← EOF
//    - Use objectMode: false — push strings
//    - for await...of to collect
//
//  EXPECTED OUTPUT:
//    Fibonacci: 1, 1, 2, 3, 5, 8, 13, 21, 34, 55
// ══════════════════════════════════════════════════════════════════

async function exercise4_customReadable() {
    header(4, "new Readable — Fibonacci producer");
    let a = 0, b = 1;
    const readable = new Readable({
        read() {
            this.push(String(a) + "\n");
            [a, b] = [b, a + b];
            if (a > 55) this.push(null);
        },
        highWaterMark: 1,
        encoding: 'utf-8'
    })

    for await (const num of readable) {
        console.log(num);
    }
    // TODO: Create a Readable that pushes Fibonacci numbers
    // TODO: Collect with for await...of
    // TODO: Print: Fibonacci: 1, 1, 2, 3, 5, 8, 13, 21, 34, 55
}

// ══════════════════════════════════════════════════════════════════
//  EXERCISE 5 — Readable.from() with async generator
//
//  TASK:
//    Write an async generator `paginate(pages)` that:
//      - Accepts an array of arrays (pages of items)
//      - Yields each item one at a time
//      - Waits 10ms between pages (simulate network delay)
//
//    Use Readable.from(paginate(...)) to stream the items.
//    Collect all items and print the count + all IDs.
//
//  EXAMPLE INPUT:
//    const pages = [
//      [{ id: 1 }, { id: 2 }],
//      [{ id: 3 }, { id: 4 }],
//      [{ id: 5 }],
//    ];
//
//  EXPECTED OUTPUT:
//    Total items: 5
//    IDs: 1, 2, 3, 4, 5
// ══════════════════════════════════════════════════════════════════

async function exercise5_readableFrom() {
    header(5, "Readable.from() — async generator pagination");

    const pages = [
        [{ id: 1 }, { id: 2 }],
        [{ id: 3 }, { id: 4 }],
        [{ id: 5 }],
    ];

    // TODO: Write an async generator `paginate(pages)` above or inline
    // TODO: Use Readable.from(paginate(pages), { objectMode: true })
    // TODO: Collect all items with for await...of
    // TODO: Print total count and all IDs
}

// ══════════════════════════════════════════════════════════════════
//  EXERCISE 6 — new Writable (custom consumer)
//
//  TASK:
//    Create a Writable stream that:
//      - Receives string chunks
//      - Counts the total number of WORDS across all chunks
//      - After .end(), prints the total word count
//
//    Feed it these chunks:
//      "Hello world\n"
//      "the quick brown fox\n"
//      "one two three\n"
//
//  HINTS:
//    - chunk.toString().trim().split(/\s+/).length  ← words in a chunk
//    - Listen to "finish" event to print total
//
//  EXPECTED OUTPUT:
//    Total words written: 9
// ══════════════════════════════════════════════════════════════════

async function exercise6_customWritable() {
    header(6, "new Writable — word counter sink");
    let totalWords = 0;
    const collected: string[] = [];

    const writableStream = new Writable({
        write(chunk, encoding, callback) {
            const wordCount = chunk.toString().trim().split(/\s+/).length;
            totalWords += wordCount;
            collected.push(chunk.toString());
            callback();
        }
    })

    writableStream.write("Hello world\n");
    writableStream.write("the quick brown fox\n");
    writableStream.write("one two three\n");
    writableStream.end();

    writableStream.on("finish", () => {
        console.log(`Total words written: ${totalWords}`);
    });
}

// ══════════════════════════════════════════════════════════════════
//  EXERCISE 7 — Transform stream
//
//  TASK:
//    Create a Transform stream that:
//      - Receives lines of text (one per .write() call)
//      - Reverses each line
//      - Pushes the reversed line downstream
//
//    Pipe these inputs through it:
//      "hello"   →  "olleh"
//      "world"   →  "dlrow"
//      "streams" →  "smaerts"
//
//  HINTS:
//    - chunk.toString().split("").reverse().join("")
//    - cb(null, reversed + "\n")
//
//  EXPECTED OUTPUT:
//    olleh
//    dlrow
//    smaerts
// ══════════════════════════════════════════════════════════════════

async function exercise7_transformReverse() {
    header(7, "Transform — reverse each line");
    const transform = new Transform({
        transform(chunk, encoding, callback) {
            // Each word arrives as its own chunk — reverse it
            const reversed = chunk.toString().split("").reverse().join("");
            callback(null, reversed + "\n");
        },
        encoding: "utf-8"
    });

    // Write one at a time with await so each is its own chunk
    await new Promise<void>((resolve) => { transform.write("hello", resolve as any); });
    await new Promise<void>((resolve) => { transform.write("world", resolve as any); });
    await new Promise<void>((resolve) => { transform.write("streams", resolve as any); });
    transform.end();

    const res: string[] = [];
    for await (const chunk of transform) {
        res.push((chunk as Buffer).toString().trim());
    }

    console.log(res.join("\n"));

    // TODO: Create a Transform that reverses each chunk
    // TODO: Write "hello", "world", "streams" into it
    // TODO: Collect output and print reversed lines
}

// ══════════════════════════════════════════════════════════════════
//  EXERCISE 8 — Transform: JSON-lines parser
//
//  TASK:
//    Create a Transform stream that:
//      - Reads the "users.jsonl" file (one JSON object per line)
//      - Parses each line into a JS object
//      - Outputs ONLY users whose score >= 65
//      - Runs in objectMode
//
//    Print each matching user's name and score.
//
//  HINTS:
//    - You need a `jsonBuffer` variable outside the Transform
//      to accumulate incomplete lines across chunks
//    - In transform: split by "\n", keep last incomplete line in buffer
//    - In flush: process remaining buffer content
//    - Use a filter inside the transform: only push if score >= 65
//
//  EXPECTED OUTPUT:
//    Dave  score=65
//    Eve   score=70
//    Frank score=75
//    Grace score=80
//    Hank  score=85
//    Ivy   score=90
//    Jack  score=95
// ══════════════════════════════════════════════════════════════════

async function exercise8_jsonLinesParser() {
    header(8, "Transform — JSON-lines parser + filter");

    // TODO: Create a Transform (objectMode) that parses JSON lines
    // TODO: Filter: only pass through users with score >= 65
    // TODO: Pipe createReadStream("users.jsonl") → yourTransform
    // TODO: Listen to "data" events to print matching users
}

// ══════════════════════════════════════════════════════════════════
//  EXERCISE 9 — pipeline() with multiple transforms
//
//  TASK:
//    Build a pipeline that:
//      1. Reads "words.txt" with createReadStream
//      2. Transform 1: uppercase every chunk
//      3. Transform 2: count total bytes passing through
//         (just count, don't modify the data — pass chunk through unchanged)
//      4. Writes the result to "upper.txt"
//
//    After the pipeline finishes:
//      - Print: "Wrote X bytes"
//      - Read and print the first 80 chars of "upper.txt" to verify
//
//  HINTS:
//    - Use pipelineAsync(src, t1, t2, dst)
//    - In the byte-counter transform: record chunk.length, then cb(null, chunk)
//    - The byte counter's total is only final AFTER pipeline resolves
//
//  EXPECTED OUTPUT:
//    Wrote 1680 bytes
//    Preview: LINE-1: THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG...
// ══════════════════════════════════════════════════════════════════

async function exercise9_pipeline() {
    header(9, "pipeline() — uppercase + byte counter + file write");

    // TODO: Create Transform 1: uppercase
    // TODO: Create Transform 2: byte counter (pass data through unchanged)
    // TODO: pipelineAsync(createReadStream("words.txt"), t1, t2, createWriteStream("upper.txt"))
    // TODO: After await: print bytes written and first 80 chars of output
}

// ══════════════════════════════════════════════════════════════════
//  EXERCISE 10 — CSV parser Transform
//
//  TASK:
//    Stream "people.csv" and transform it into JS objects.
//    Skip the header row.
//    Print each person as: "Alice is 30 years old from New York"
//
//  HINTS:
//    - Similar to exercise 8 — buffer incomplete lines across chunks
//    - First line is the header ("name,age,city") — skip it or use it
//      to build field names dynamically
//    - Split each data line by ","
//    - objectMode: true for the transform output
//
//  EXPECTED OUTPUT:
//    Alice is 30 years old from New York
//    Bob is 25 years old from London
//    Carol is 35 years old from Paris
//    Dave is 28 years old from Tokyo
//    Eve is 32 years old from Sydney
// ══════════════════════════════════════════════════════════════════

async function exercise10_csvParser() {
    header(10, "Transform — CSV parser (string → object)");

    // TODO: Create a Transform that:
    //   - buffers incomplete lines
    //   - parses CSV lines into objects using the first line as headers
    //   - outputs objects in objectMode
    // TODO: Pipe createReadStream("people.csv") → csvTransform
    // TODO: Print each person in the format above
}

// ══════════════════════════════════════════════════════════════════
//  EXERCISE 11 — Backpressure (manual)
//
//  TASK:
//    Create a FAST Readable that pushes 50 numbers (1..50) instantly.
//    Create a SLOW Writable (highWaterMark: 5, objectMode: true)
//    that takes 5ms per item.
//
//    Write from readable → writable MANUALLY (no pipe/pipeline).
//    Implement proper backpressure:
//      - Check writable.write() return value
//      - If false → pause, wait for "drain", then resume
//    Track and print how many times backpressure was triggered.
//
//  HINTS:
//    - Listen to readable "data" event
//    - In the handler: if (!writable.write(chunk)) { readable.pause(); writable.once("drain", () => readable.resume()); }
//    - On readable "end": writable.end()
//    - On writable "finish": print stats
//
//  EXPECTED OUTPUT:
//    Written: 50 items
//    Backpressure triggered: ~9 times
// ══════════════════════════════════════════════════════════════════

async function exercise11_backpressure() {
    header(11, "Backpressure — manual pause/resume");

    // TODO: Create fast Readable (objectMode) pushing numbers 1..50
    // TODO: Create slow Writable (highWaterMark: 5, 5ms per item)
    // TODO: Connect them manually, tracking backpressure pauses
    // TODO: Print: Written: 50 items  Backpressure triggered: X times
}

// ══════════════════════════════════════════════════════════════════
//  EXERCISE 12 — AbortController
//
//  TASK:
//    Stream "numbers.txt" (100 lines) with createReadStream.
//    After reading 5 chunks, abort the stream using AbortController.
//
//    Print:
//      - How many chunks were read before abort
//      - The error name (should be "AbortError")
//      - signal.reason
//
//  HINTS:
//    - Pass { signal: ac.signal } to createReadStream
//    - Call ac.abort("read enough") inside the "data" handler
//    - Listen to "error" to catch the AbortError
//    - "end" does NOT fire when aborted — only "error" then "close"
//
//  EXPECTED OUTPUT:
//    Chunks before abort: 5
//    Error: AbortError
//    Reason: "read enough"
// ══════════════════════════════════════════════════════════════════

async function exercise12_abortController() {
    header(12, "AbortController — cancel stream mid-read");

    // TODO: Create AbortController
    // TODO: Open numbers.txt with createReadStream({ signal: ac.signal })
    // TODO: Count chunks; after 5, call ac.abort("read enough")
    // TODO: Handle "error" event, print chunk count + error name + reason
}

// ══════════════════════════════════════════════════════════════════
//  EXERCISE 13 — LLM streaming with Readable.from()
//
//  TASK:
//    Call an LLM model and stream its response using Node.js streams.
//    Wrap the LangChain stream in a Readable using Readable.from().
//    Pipe it through a Transform that:
//      - Receives AIMessageChunk objects (objectMode in)
//      - Extracts chunk.content (the token text)
//      - Outputs the token string (not objectMode out)
//    Collect all tokens into a string and print the full response.
//    Also print the total token count.
//
//  HINTS:
//    - const model = getModel("llama-3.1-8b-instant", 0.7)
//    - const llmStream = await model.stream("Tell me a fun fact in one sentence")
//    - Readable.from(llmStream, { objectMode: true })
//    - The Transform needs readableObjectMode: false, writableObjectMode: true
//      OR just use objectMode: true and push strings
//    - chunk.content is the token text (may be empty string — skip those)
//    - Use for await...of on the transform output to collect tokens
//
//  EXPECTED OUTPUT (example):
//    Token count: 23
//    Response: "Did you know that honey never spoils — archaeologists have found ..."
// ══════════════════════════════════════════════════════════════════

async function exercise13_llmStream() {
    header(13, "LLM streaming — Readable.from() + Transform");

    // TODO: Get the model with getModel("llama-3.1-8b-instant", 0.7)
    // TODO: Call model.stream("Tell me a fun fact in one sentence")
    // TODO: Wrap in Readable.from(llmStream, { objectMode: true })
    // TODO: Create a Transform that extracts chunk.content (token text)
    // TODO: Collect tokens and print total count + full response
}

// ══════════════════════════════════════════════════════════════════
//  EXERCISE 14 — LLM streaming with pipeline()
//
//  TASK:
//    Same as exercise 13 but this time use pipeline().
//    Build the full chain:
//      LLM readable → token extractor transform → word counter transform → stdout writable
//
//    The word counter transform:
//      - Receives token strings
//      - Passes each token through unchanged
//      - Tracks running word count by splitting on spaces
//
//    At the end (after pipeline resolves) print:
//      - Approximate word count of the response
//
//  HINTS:
//    - process.stdout is already a Writable — you can use it directly
//    - Or create a custom Writable that collects into a string
//    - Word count: accumulate all tokens, then split final string on /\s+/
//
//  EXPECTED OUTPUT:
//    <streamed response printed to console>
//    Word count: ~15
// ══════════════════════════════════════════════════════════════════

async function exercise14_llmPipeline() {
    header(14, "LLM pipeline() — token extractor → word counter → stdout");

    // TODO: Get model + call model.stream(...)
    // TODO: Wrap in Readable.from()
    // TODO: Build 3-stage pipeline: token extract → word count → writable sink
    // TODO: After pipelineAsync resolves: print word count
}

// ══════════════════════════════════════════════════════════════════
//  EXERCISE 15 — LLM streaming with AbortController
//
//  TASK:
//    Stream an LLM response with a hard 2-second timeout.
//    Use AbortSignal.timeout(2000) passed to Readable.from via a
//    manual abort listener on the async generator.
//
//    If the LLM finishes in time: print the full response.
//    If it times out: print "Timed out after X tokens"
//
//  HINTS:
//    - AbortSignal.timeout(2000) creates a signal that fires after 2s
//    - Wrap the LLM stream iteration in a try/catch
//    - Check for err.name === "TimeoutError" || err.name === "AbortError"
//    - Track token count as you go — print it on timeout
//    - You can pass the signal to Readable.from like this:
//        async function* withAbort(signal: AbortSignal) {
//          for await (const chunk of llmStream) {
//            if (signal.aborted) throw signal.reason;
//            yield chunk;
//          }
//        }
//
//  EXPECTED OUTPUT (if fast):
//    Response: "..."
//    Completed in time ✓
//
//  EXPECTED OUTPUT (if slow):
//    Timed out after 8 tokens
// ══════════════════════════════════════════════════════════════════

async function exercise15_llmAbort() {
    header(15, "LLM streaming + AbortSignal.timeout()");

    // TODO: Call model.stream("Write a detailed 3-paragraph story about space exploration")
    // TODO: Wrap iteration with AbortSignal.timeout(2000)
    // TODO: Collect tokens; if aborted → print "Timed out after X tokens"
    // TODO: If finished in time → print full response
}

// ══════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════

async function main() {
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║  NODE.JS STREAMS — Exercises                             ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log("\n  Uncomment exercises in main() as you complete them.\n");

    await setup();

    // ── Uncomment each exercise as you complete it ────────────────
    //await exercise1_readFile();
    //await exercise2_createReadStream();
    //await exercise3_readline();
    //await exercise4_customReadable();
    // await exercise5_readableFrom();
    //await exercise6_customWritable();
    await exercise7_transformReverse();
    // await exercise8_jsonLinesParser();
    // await exercise9_pipeline();
    // await exercise10_csvParser();
    // await exercise11_backpressure();
    // await exercise12_abortController();
    // await exercise13_llmStream();      // ← requires GROQ_API_KEY
    // await exercise14_llmPipeline();    // ← requires GROQ_API_KEY
    // await exercise15_llmAbort();       // ← requires GROQ_API_KEY

    await cleanup();
    console.log("\n  ✅ Done.");
}

main().catch(console.error);
