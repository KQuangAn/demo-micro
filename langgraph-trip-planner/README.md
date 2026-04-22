# LangGraph Trip Planning Assistant

This project implements four distinct multi-agent systems in LangGraph for the Trip Planning Assistant domain, supporting sequential, parallel, subagents-as-tools, and critic loop workflows.

## Structure
- `nodes/` — YAML node definitions for each workflow
- `edges/` — TypeScript edge definitions (including conditional logic)
- `lib/` — Reusable function library for parsing YAML and building LangGraph components
- `tests/` — Evaluation definitions/tests (TDD/CDD)
- `middleware/` — Middleware node logic (PII, tool validation, retry, todo, human interrupt, Postgres checkpointer)

## Features
- Modular, reusable agent and middleware components
- Conditional edge routing via `edges.ts`
- Postgres checkpointer integration for state persistence
- Test-driven and contract-driven development

See the design document in the root for rationale and details.
