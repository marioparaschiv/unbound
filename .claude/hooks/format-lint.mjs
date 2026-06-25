#!/usr/bin/env node
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

/**
 * Claude Code port of the OMP `format-lint` extension (.omp/extensions/format-lint.ts).
 * Wired as two hooks in .claude/settings.json:
 *
 *   - PostToolUse (Edit|Write|MultiEdit): oxfmt formats the touched apps/ +
 *     packages/ file right away (format-on-save).
 *   - Stop: every apps/ + packages/ file git reports as changed vs HEAD is
 *     ast-grep auto-fixed (touched lines only), oxfmt-formatted, oxlint
 *     --fix-dangerously'd, then ast-grep's no-fix rules block on touched lines.
 *
 * Stop scope mirrors the OMP original: only apps/ + packages/ files git reports
 * as changed AND modified since session start are processed, so a pre-existing
 * dirty tree is left untouched. Session start is taken from the birthtime of
 * Claude's transcript file (`transcript_path`); if it is unavailable the guard
 * is skipped and the whole git-dirty tree is processed.
 */

const SCOPE = /^(?:apps|packages)\//;
const FMT_EXT = /\.(?:[cm]?[jt]sx?|jsonc?)$/;
const LINT_EXT = /\.[cm]?[jt]sx?$/;
const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;
const MAX_BUFFER = 64 * 1024 * 1024;
const MAX_REPORT = 12_000;

const run = promisify(execFile);

async function exec(file, args, cwd) {
	try {
		const { stdout, stderr } = await run(file, args, { cwd, maxBuffer: MAX_BUFFER });

		return { code: 0, stdout, stderr };
	} catch (err) {
		const e = typeof err === 'object' && err !== null ? err : {};

		return {
			code: typeof e.code === 'number' ? e.code : 1,
			stdout: e.stdout ?? '',
			stderr: e.stderr ?? '',
		};
	}
}

async function repoRoot(cwd) {
	const common = await exec('git', ['rev-parse', '--git-common-dir'], cwd);

	if (common.code === 0 && common.stdout.trim()) {
		const dir = common.stdout.trim();
		const abs = isAbsolute(dir) ? dir : join(cwd, dir);

		return dirname(abs);
	}

	return cwd;
}

function bin(root, name) {
	return join(root, 'node_modules', '.bin', name);
}

async function formatFiles(root, oxfmt, files) {
	if (files.length === 0 || !existsSync(oxfmt)) {
		return;
	}

	await exec(
		oxfmt,
		['--config', '.oxfmtrc.json', '--no-error-on-unmatched-pattern', ...files],
		root,
	);
}

async function changedFiles(root, sinceMs) {
	const tracked = await exec('git', ['diff', '--name-only', '--diff-filter=d', 'HEAD'], root);
	const untracked = await exec('git', ['ls-files', '--others', '--exclude-standard'], root);

	const files = new Set();

	for (const line of `${tracked.stdout}\n${untracked.stdout}`.split('\n')) {
		const file = line.trim();

		if (!file || !SCOPE.test(file)) {
			continue;
		}

		if (sinceMs === null) {
			files.add(file);
			continue;
		}

		try {
			if (statSync(join(root, file)).mtimeMs >= sinceMs) {
				files.add(file);
			}
		} catch {
			continue;
		}
	}

	return [...files];
}

/**
 * 1-based line numbers added/changed in `file` vs HEAD. `null` means the file
 * is new (untracked) so every line counts. `--no-ext-diff` forces plain unified
 * output past the repo's configured external diff driver (difftastic).
 */
async function changedLines(root, file) {
	const diff = await exec(
		'git',
		['diff', '--no-ext-diff', '--unified=0', 'HEAD', '--', file],
		root,
	);

	if (!diff.stdout.trim()) {
		return null;
	}

	const lines = new Set();

	for (const row of diff.stdout.split('\n')) {
		const match = HUNK.exec(row);

		if (!match) {
			continue;
		}

		const start = Number(match[1]);
		const count = match[2] === undefined ? 1 : Number(match[2]);

		for (let i = 0; i < count; i++) {
			lines.add(start + i);
		}
	}

	return lines;
}

async function scanFindings(root, sg, files) {
	const scan = await exec(sg, ['scan', '-c', 'sgconfig.yml', '--json=compact', ...files], root);

	try {
		const parsed = JSON.parse(scan.stdout || '[]');

		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function toRel(root, file) {
	return file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file;
}

/**
 * Apply ast-grep fixes, but only for findings sitting on lines this change
 * touched - splicing each `replacement` into the file by byte offset. Legacy
 * matches on untouched lines are left alone.
 */
async function applyAstFixes(root, sg, files) {
	const findings = await scanFindings(root, sg, files);
	const added = new Map();
	const byFile = new Map();

	for (const finding of findings) {
		if (finding.replacement === undefined || finding.replacementOffsets === undefined) {
			continue;
		}

		const rel = toRel(root, finding.file);

		if (!added.has(rel)) {
			added.set(rel, await changedLines(root, rel));
		}

		const lines = added.get(rel);

		if (lines && !lines.has(finding.range.start.line + 1)) {
			continue;
		}

		const fixes = byFile.get(rel) ?? [];

		fixes.push({
			start: finding.replacementOffsets.start,
			end: finding.replacementOffsets.end,
			text: finding.replacement,
		});
		byFile.set(rel, fixes);
	}

	for (const [rel, fixes] of byFile) {
		fixes.sort((a, b) => b.start - a.start);

		let buffer = readFileSync(join(root, rel));
		let guard = buffer.length;

		for (const fix of fixes) {
			if (fix.end > guard) {
				continue;
			}

			buffer = Buffer.concat([
				buffer.subarray(0, fix.start),
				Buffer.from(fix.text),
				buffer.subarray(fix.end),
			]);
			guard = fix.start;
		}

		writeFileSync(join(root, rel), buffer);
	}
}

/**
 * ast-grep findings with no automatic fix, located on lines this change
 * introduced - formatted `path:line:col  rule  message` for the block reason.
 */
async function astViolations(root, sg, files) {
	const findings = await scanFindings(root, sg, files);
	const added = new Map();
	const report = [];

	for (const finding of findings) {
		if (finding.replacement !== undefined) {
			continue;
		}

		const rel = toRel(root, finding.file);

		if (!added.has(rel)) {
			added.set(rel, await changedLines(root, rel));
		}

		const lines = added.get(rel);
		const line = finding.range.start.line + 1;

		if (lines === null || lines.has(line)) {
			const col = finding.range.start.column + 1;

			report.push(`${rel}:${line}:${col}  ${finding.ruleId}  ${finding.message}`);
		}
	}

	return report;
}

async function readStdin() {
	let raw = '';

	for await (const chunk of process.stdin) {
		raw += chunk;
	}

	try {
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

async function onPostToolUse(root, payload) {
	const filePath = payload?.tool_input?.file_path;

	if (typeof filePath !== 'string' || !filePath) {
		return;
	}

	const rel = isAbsolute(filePath) ? relative(root, filePath) : filePath;

	if (!SCOPE.test(rel) || !FMT_EXT.test(rel) || !existsSync(join(root, rel))) {
		return;
	}

	await formatFiles(root, bin(root, 'oxfmt'), [rel]);
}

async function onStop(root, sinceMs) {
	// Without a known session boundary we cannot tell our changes from a
	// pre-existing dirty tree. Skip rather than scan (and block on) work that
	// is not ours - mirrors the "pre-existing dirty tree is left untouched"
	// guarantee documented at the top of this file.
	if (sinceMs === null) {
		return;
	}

	const files = await changedFiles(root, sinceMs);

	if (files.length === 0) {
		return;
	}

	const fmtFiles = files.filter((file) => FMT_EXT.test(file));
	const lintFiles = files.filter((file) => LINT_EXT.test(file));
	const sg = bin(root, 'ast-grep');
	const hasAstGrep = existsSync(sg);

	if (lintFiles.length > 0 && hasAstGrep) {
		await applyAstFixes(root, sg, lintFiles);
	}

	await formatFiles(root, bin(root, 'oxfmt'), fmtFiles);

	if (lintFiles.length === 0) {
		return;
	}

	const problems = [];
	const oxlint = bin(root, 'oxlint');

	if (existsSync(oxlint)) {
		const lint = await exec(
			oxlint,
			['--config', '.oxlintrc.json', '--fix-dangerously', ...lintFiles],
			root,
		);

		const output = `${lint.stdout}\n${lint.stderr}`.trim();

		if (lint.code !== 0 && output) {
			problems.push(output);
		}
	}

	if (hasAstGrep) {
		const violations = await astViolations(root, sg, lintFiles);

		if (violations.length > 0) {
			problems.push(`AGENTS.md structural rules (ast-grep):\n${violations.join('\n')}`);
		}
	}

	const report = problems.join('\n\n').trim().slice(0, MAX_REPORT);

	if (!report) {
		return;
	}

	process.stdout.write(
		JSON.stringify({
			decision: 'block',
			reason:
				`Formatter, linter, and ast-grep ran on your changed files. ` +
				`Fix these before finishing:\n\n${report}`,
		}),
	);
}

function sessionStart(payload) {
	const transcript = payload?.transcript_path;

	if (typeof transcript !== 'string' || !transcript) {
		return null;
	}

	try {
		return statSync(transcript).birthtimeMs;
	} catch {
		return null;
	}
}

async function main() {
	const payload = await readStdin();
	const cwd = typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
	const root = await repoRoot(cwd);
	const event = payload?.hook_event_name;

	try {
		if (event === 'Stop') {
			await onStop(root, sessionStart(payload));
		} else {
			await onPostToolUse(root, payload);
		}
	} catch {
		// Never let a hook failure wedge the agent; format/lint is best-effort.
	}
}

await main();
