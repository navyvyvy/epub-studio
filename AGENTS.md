# Project Instructions

## Approval Before Changes

1. Before changing code, styles, assets, or documentation, present a short plan with the intended scope and affected files. Wait for explicit user approval.
2. Implement only the approved plan. Small fixes, cleanup, or design substitutions are not exceptions. If the scope or design direction changes, explain the difference and ask again before editing.
3. Read-only inspection and diagnostic checks may be used to prepare a plan. Report additional findings without fixing them unless the user approves those fixes.
4. Commits and pushes require explicit user authorization. Permission from a previous task is not continuing permission; authorization for a commit alone does not authorize a push.
5. Report what changed, what was verified, and any remaining risks. Follow `WORKFLOW_RULES.md` when updating features and their documentation.

## Context7

Use Context7 MCP to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service, including API syntax, configuration, migration, library-specific debugging, setup, and CLI usage. Use it even when the answer seems familiar. Prefer Context7 over web search for library documentation.

Do not use Context7 for refactoring, scripts written from scratch, business-logic debugging, code review, or general programming concepts.

1. Start with `resolve-library-id`, using the library name and the user's question, unless the user provides an exact `/org/project` ID.
2. Choose the best match by name, relevance, snippet count, source reputation, and benchmark score. Retry alternate names or queries when needed, and use a version-specific ID when a version is specified.
3. Call `query-docs` with the selected ID and the full question, not just keywords.
4. Base the answer on the fetched documentation.
