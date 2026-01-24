# Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.

# Custom Instructions for Claude Code

# Implementation
- Always use bun fmt and bun lint:fix after implementing a fix/feature.

## Communication Style

- Keep summaries after task completion very concise.
- No flattery, self-congratulation, or unnecessary politeness
- No emojis/emoticons
- Focus on what was done & any important outcomes
- Skip verbose explanations unless something went wrong or requires user attention
- It's Q1 2026, don't search for earlier versions

## Code Comments

Write comments only when they explain _why_, not _what_. Do not add comments that restate what the code already expresses:

- No comments describing what a function does if the name is clear
- No comments labeling code sections (e.g., "// Calculate X", "// Handle Y case")
- No step numbers (e.g., "// 1. First do X", "// 2. Then do Y")
- No comments restating variable assignments or conditionals
- No format examples in comments when types/signatures are clear

Good: `// Tolerance for floating point comparison due to browser rounding`
Bad: `// Check if values are equal within tolerance`

## NPM Package Installation

When installing new npm packages, use `pnpm info <package> version` to determine the latest version. Do not rely on training data or web searches for package versions - they become stale quickly.

Exception: Follow existing version constraints when a project's package.json, lockfile, or peer dependencies require specific versions.
