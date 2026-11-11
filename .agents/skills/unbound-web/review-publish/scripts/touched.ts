#!/usr/bin/env bun
// Which model actions each hunk of the verified code overlaps since the sync commit.
// Usage: bun touched.ts [<ref>]. Exit 0: unchanged. Exit 1: one line per hunk.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The commit the spec and COVERAGE.md line numbers describe. Move it only after re-checking every row. */
export const SYNC_COMMIT = '68a75a6d9e3bdd35fe89d33ca760295670493a67';

/** Every file the model describes. */
export const VERIFIED_FILES = [
	'apps/web/src/lib/review.ts',
	'apps/web/src/lib/publish-version.ts',
	'apps/web/src/lib/submission-decision.ts',
	'apps/web/src/lib/addon-claim.ts',
	'apps/web/src/lib/pinned-files.ts',
	'apps/web/src/lib/addon-bytecode.ts',
	'apps/web/src/lib/submissions.ts',
	'apps/web/src/lib/staging.ts',
	'apps/web/src/lib/github.ts',
	'apps/web/src/lib/auth/auth.ts',
	'apps/web/src/db/schema/addons.ts',
	'apps/web/src/lib/artifacts.ts',
	'apps/web/src/lib/addon-page-source.ts',
	'apps/web/src/lib/addon-files.ts',
	'apps/web/src/lib/addon-visibility.ts',
	'packages/contracts/src/addon-files.ts',
	'packages/contracts/src/version-layout.ts',
];

type Row = { file: string; ranges: [number, number][]; actions: string };
type Hunk = { file: string; start: number; end: number };

function readRows(): Row[] {
	const text = readFileSync(join(import.meta.dir, '..', 'COVERAGE.md'), 'utf8');

	return text
		.split('\n')
		.filter((line) => /^\| `[^`]+\.ts`/.test(line))
		.map((line) => {
			const [code, actions] = line
				.split('|')
				.slice(1, 3)
				.map((cell) => cell.trim());
			const ranges = [...code.matchAll(/\b(\d+)(?:-(\d+))?\b/g)].map(
				(match): [number, number] => [Number(match[1]), Number(match[2] ?? match[1])],
			);

			return { file: /`([^`]+\.ts)`/.exec(code)![1], ranges, actions };
		});
}

function readHunks(ref: string | undefined): Hunk[] {
	const args = [
		'git',
		'diff',
		'--unified=0',
		SYNC_COMMIT,
		...(ref ? [ref] : []),
		'--',
		...VERIFIED_FILES,
	];
	const diff = Bun.spawnSync(args, { stdout: 'pipe', stderr: 'inherit' });

	if (diff.exitCode !== 0) {
		throw new Error(`Failed to run ${args.join(' ')}`);
	}

	const hunks: Hunk[] = [];
	let file = '';

	for (const line of diff.stdout.toString().split('\n')) {
		if (line.startsWith('--- a/')) {
			file = line.slice(6);
		} else if (line.startsWith('--- /dev/null')) {
			file = '';
		} else if (line.startsWith('+++ b/') && !file) {
			file = line.slice(6);
		}

		const hunk = /^@@ -(\d+)(?:,(\d+))? /.exec(line);

		if (hunk && file) {
			const start = Number(hunk[1]);
			const count = Number(hunk[2] ?? 1);

			hunks.push({ file, start, end: start + Math.max(count, 1) - 1 });
		}
	}

	return hunks;
}

function main(): number {
	const rows = readRows();
	const hunks = readHunks(process.argv[2]);

	if (!hunks.length) {
		console.log(
			`unchanged since ${SYNC_COMMIT.slice(0, 9)}: the verification still describes the code`,
		);

		return 0;
	}

	for (const hunk of hunks) {
		const actions = rows
			.filter((row) => hunk.file.endsWith(`/${row.file}`))
			.filter((row) =>
				row.ranges.some(([start, end]) => hunk.start <= end && hunk.end >= start),
			)
			.map((row) => row.actions);

		console.log(
			`${hunk.file}:${hunk.start}-${hunk.end} -> ${actions.length ? [...new Set(actions)].join('; ') : '(no coverage row)'}`,
		);
	}

	return 1;
}

process.exit(main());
