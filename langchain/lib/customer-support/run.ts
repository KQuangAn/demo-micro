/**
 * ══════════════════════════════════════════════════════════════════
 *  Customer Support — Interactive CLI
 * ══════════════════════════════════════════════════════════════════
 */

import "dotenv/config";
import * as readline from "readline";
import { createSupportAgent } from "./agent";

// ─── Env check ─────────────────────────────────────────────────────

const REQUIRED = ["GROQ_API_KEY", "PINECONE_API_KEY"];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`❌  Missing env var: ${key}`);
    process.exit(1);
  }
}

// ─── Colour helpers ────────────────────────────────────────────────

const c = {
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
};

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log(c.bold("\n🎧  AcmeStore Customer Support"));
  console.log(c.dim("   Type your question, or 'quit' to exit.\n"));

  const agent = createSupportAgent();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let closed = false;
  rl.on("close", () => { closed = true; });

  const ask = () => {
    if (closed) return;
    rl.question(c.cyan("You: "), async (input) => {
      const trimmed = input.trim();
      if (!trimmed || ["quit", "exit", "q"].includes(trimmed.toLowerCase())) {
        console.log(c.dim("\n👋  Thanks for contacting AcmeStore. Goodbye!\n"));
        rl.close();
        return;
      }

      try {
        const t0 = Date.now();
        const { answer, toolsUsed } = await agent.chat(trimmed);
        const ms = Date.now() - t0;

        console.log(`\n${c.green("Agent:")} ${answer}`);
        if (toolsUsed.length) {
          console.log(c.dim(`   [tools: ${toolsUsed.join(", ")} | ${ms}ms]`));
        }
        console.log();
      } catch (err: any) {
        console.error(c.yellow(`\n⚠  Error: ${err.message}\n`));
      }

      ask();
    });
  };

  ask();
}

main().catch(console.error);
