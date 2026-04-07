/**
 * ══════════════════════════════════════════════════════════════════
 *  Global Test Setup
 * ══════════════════════════════════════════════════════════════════
 *
 *  This file runs ONCE before every test file.
 *
 *  KEY PRINCIPLE: Disable LangSmith tracing in unit tests.
 *  You don't want test runs polluting your production traces,
 *  and you don't want tests to fail due to missing API keys.
 *
 * ══════════════════════════════════════════════════════════════════
 */

// ─── Disable LangSmith tracing during tests ───────────────────────
// This prevents test runs from sending data to LangSmith
// and removes the need for LANGCHAIN_API_KEY in CI/CD
process.env.LANGCHAIN_TRACING_V2 = "false";
process.env.LANGCHAIN_API_KEY = "test-key-not-used";

// ─── Fake AWS credentials for tests ──────────────────────────────
// Prevents real AWS SDK calls from happening during unit tests
process.env.AWS_REGION = "us-east-1";
process.env.AWS_ACCESS_KEY_ID = "test-access-key";
process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";

// ─── Fake Groq API key ────────────────────────────────────────────
// Unit tests should mock the model, not call real APIs
process.env.GROQ_API_KEY = "test-groq-key-not-used";
process.env.GOOGLE_API_KEY = "test-google-key-not-used";
