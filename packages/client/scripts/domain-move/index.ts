import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmdirSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { SOURCE_ROOT, aliasFor, rewriteSource, type Layout } from './rewrite';
import table from './table';

// bun packages/client/scripts/domain-move/index.ts [--stubs] [--contract] [--check] [--only <old path prefix>]...

export type Table = {
	moves: Record<string, string>;
	removals: string[];
};

export type Options = {
	stubs?: boolean;
	contract?: boolean;
	only?: string[];
};

export type Summary = {
	moved: number;
	rewritten: number;
	stubs: number;
	deleted: number;
};

const SCRIPT_FOLDER = 'packages/client/scripts/domain-move/';
const SCANNED = /\.(?:ts|tsx|js|mjs|cjs|json)$/;
const STUB_LINE = /^(?:export \* from|export \{ default \} from|import) '~\/[^']+';$/;
const NO_STUB = /\.test\.tsx?$|\.d\.ts$/;

function git(root: string, ...args: string[]): string {
	const result = Bun.spawnSync(['git', ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' });

	if (result.exitCode !== 0) {
		throw new Error(`git ${args.join(' ')} failed: ${result.stderr.toString()}`);
	}

	return result.stdout.toString();
}

function listFiles(root: string): string[] {
	const output = git(root, 'ls-files', '--cached', '--others', '--exclude-standard');

	return [...new Set(output.split('\n'))].filter((path) => path && existsSync(join(root, path)));
}

function read(root: string, path: string): string {
	return readFileSync(join(root, path), 'utf8');
}

function selected(path: string, only: string[]): boolean {
	return !only.length || only.some((prefix) => path.startsWith(prefix));
}

/**
 * @description Tells whether a file is a re-export stub this codemod left at an old path.
 * @param text The file's contents.
 * @returns Whether every line re-exports or imports a `~/` module.
 */
export function isStub(text: string): boolean {
	const lines = text.split('\n').filter((line) => line.trim());

	return lines.length > 0 && lines.every((line) => STUB_LINE.test(line));
}

/**
 * @description Writes the stub that keeps an old path importable after its file moved.
 * @param text The moved file's contents, read to see what it exports.
 * @param target The moved file's repo-relative path.
 * @returns The stub's contents.
 */
export function stubFor(text: string, target: string): string {
	const specifier = aliasFor(target);

	if (!/^export\b/m.test(text)) {
		return `import '${specifier}';\n`;
	}

	const lines: string[] = [];

	if (/^export default\b|\bas default\b/m.test(text)) {
		lines.push(`export { default } from '${specifier}';`);
	}

	if (/^export (?!default\b)/m.test(text)) {
		lines.push(`export * from '${specifier}';`);
	}

	return `${lines.join('\n')}\n`;
}

/**
 * @description Expands the table into one row per file, against the files that exist now.
 * @param source The table.
 * @param files Every repo-relative file path in the checkout.
 * @param options Which rows to use and whether removals apply.
 * @returns The move as a {@link Layout}.
 */
export function buildLayout(source: Table, files: string[], options: Options = {}): Layout {
	const { only = [], contract = false } = options;
	const layout: Layout = {
		files: new Map(),
		directories: new Map(),
		removed: new Set(),
		known: new Set(files),
	};

	for (const [from, to] of Object.entries(source.moves)) {
		if (!selected(from, only)) {
			continue;
		}

		const oldPath = `${SOURCE_ROOT}/${from}`;
		const newPath = `${SOURCE_ROOT}/${to}`;

		if (!from.endsWith('/')) {
			layout.files.set(oldPath, newPath);
			continue;
		}

		const present = files.filter((path) => path.startsWith(oldPath));
		const names = present.length
			? present.map((path) => path.slice(oldPath.length))
			: files
					.filter((path) => path.startsWith(newPath))
					.map((path) => path.slice(newPath.length));

		for (const name of names) {
			layout.files.set(oldPath + name, newPath + name);
		}

		layout.directories.set(oldPath.slice(0, -1), newPath.slice(0, -1));
	}

	for (const path of layout.files.keys()) {
		layout.known.add(path);
	}

	for (const removal of source.removals) {
		const path = `${SOURCE_ROOT}/${removal}`;

		layout.known.add(path);

		if (contract && selected(removal, only)) {
			layout.removed.add(path);
		}
	}

	return layout;
}

function scannedFiles(root: string, files: string[], layout: Layout): string[] {
	return files.filter((path) => {
		if (!SCANNED.test(path) || path.startsWith(SCRIPT_FOLDER)) {
			return false;
		}

		if (path.startsWith('packages/api/src/') || path.includes('node_modules/')) {
			return false;
		}

		return !layout.files.has(path) || !isStub(read(root, path));
	});
}

/**
 * @description Sorts imports and reformats the files the move wrote, since new specifiers change line lengths.
 * @param root The repo root.
 * @param paths The repo-relative files to tidy.
 */
function tidy(root: string, paths: string[]) {
	const code = paths.filter(
		(path) => /\.(?:ts|tsx|js|mjs)$/.test(path) && existsSync(join(root, path)),
	);
	const bin = join(root, 'node_modules/.bin');

	if (!code.length || !existsSync(join(bin, 'oxlint'))) return;

	Bun.spawnSync([join(bin, 'oxlint'), '--config', '.oxlintrc.json', '--fix', ...code], {
		cwd: root,
	});
	Bun.spawnSync([join(bin, 'oxfmt'), '--config', '.oxfmtrc.json', ...code], { cwd: root });
}

function pruneEmpty(root: string, path: string) {
	let folder = posix.dirname(path);

	while (folder.startsWith(`${SOURCE_ROOT}/`) && existsSync(join(root, folder))) {
		if (readdirSync(join(root, folder)).length) return;

		rmdirSync(join(root, folder));
		folder = posix.dirname(folder);
	}
}

function remove(root: string, path: string) {
	git(root, 'rm', '-q', '-f', '--ignore-unmatch', '--', path);

	rmSync(join(root, path), { force: true });

	pruneEmpty(root, path);
}

/**
 * @description Lists what still names the old layout: unmoved files, stale specifiers and, in contract mode, stubs and removals.
 * @param root The repo root.
 * @param source The table.
 * @param options Which rows to check and whether stubs and removals count.
 * @returns One line per leftover; empty when the move is complete.
 */
export function check(root: string, source: Table, options: Options = {}): string[] {
	const files = listFiles(root);
	const layout = buildLayout(source, files, options);
	const leftovers: string[] = [];

	for (const [from, to] of layout.files) {
		if (!existsSync(join(root, from))) {
			continue;
		}

		if (!isStub(read(root, from))) {
			leftovers.push(`unmoved ${from} -> ${to}`);
		} else if (options.contract) {
			leftovers.push(`stub ${from}`);
		}
	}

	for (const path of layout.removed) {
		if (existsSync(join(root, path))) {
			leftovers.push(`not removed ${path}`);
		}
	}

	for (const file of scannedFiles(root, files, layout)) {
		for (const change of rewriteSource(read(root, file), file, file, layout).changes) {
			leftovers.push(
				change.after
					? `stale ${file}: ${change.before} -> ${change.after}`
					: `removed ${file}: ${change.before}`,
			);
		}
	}

	return leftovers;
}

/**
 * @description Moves every selected row with `git mv` and rewrites each specifier and path string that names a moved file.
 * @param root The repo root.
 * @param source The table.
 * @param options Which rows to move, whether to leave stubs, and whether to delete stubs and removals.
 * @returns Counts of what changed.
 */
export function apply(root: string, source: Table, options: Options = {}): Summary {
	const files = listFiles(root);
	const layout = buildLayout(source, files, options);
	const pending = new Map<string, string>();
	const blockers: string[] = [];
	const summary: Summary = { moved: 0, rewritten: 0, stubs: 0, deleted: 0 };

	for (const file of scannedFiles(root, files, layout)) {
		const text = read(root, file);
		const to = layout.files.get(file) ?? file;
		const result = rewriteSource(text, file, to, layout);

		for (const change of result.changes) {
			if (!change.after) {
				blockers.push(`${file} imports ${change.before}, which contract mode deletes`);
			}
		}

		if (result.text !== text) {
			pending.set(to, result.text);
		}
	}

	const moves = [...layout.files].filter(
		([from]) => existsSync(join(root, from)) && !isStub(read(root, from)),
	);

	for (const [from, to] of moves) {
		if (existsSync(join(root, to))) {
			blockers.push(`${from} cannot move: ${to} already exists`);
		}
	}

	if (blockers.length) {
		throw new Error(`Nothing changed:\n${blockers.join('\n')}`);
	}

	const moved: [string, string][] = [];

	for (const [from, to] of moves) {
		mkdirSync(dirname(join(root, to)), { recursive: true });
		git(root, 'mv', from, to);
		pruneEmpty(root, from);
		moved.push([from, to]);
	}

	summary.moved = moved.length;

	for (const [path, text] of pending) {
		writeFileSync(join(root, path), text);
	}

	summary.rewritten = pending.size;

	if (options.stubs && !options.contract) {
		for (const [from, to] of moved) {
			if (NO_STUB.test(from)) {
				continue;
			}

			mkdirSync(dirname(join(root, from)), { recursive: true });
			writeFileSync(join(root, from), stubFor(read(root, to), to));
			git(root, 'add', '--', from);
			summary.stubs++;
		}
	}

	tidy(root, [...pending.keys(), ...moved.map(([from]) => from)]);

	if (!options.contract) {
		return summary;
	}

	for (const from of layout.files.keys()) {
		if (existsSync(join(root, from)) && isStub(read(root, from))) {
			remove(root, from);
			summary.deleted++;
		}
	}

	for (const path of layout.removed) {
		if (existsSync(join(root, path))) {
			remove(root, path);
			summary.deleted++;
		}
	}

	return summary;
}

function main() {
	const { values } = parseArgs({
		options: {
			check: { type: 'boolean', default: false },
			stubs: { type: 'boolean', default: false },
			contract: { type: 'boolean', default: false },
			only: { type: 'string', multiple: true, default: [] },
		},
	});
	const root = resolve(import.meta.dir, '../../../..');

	if (values.check) {
		const leftovers = check(root, table, values);

		for (const line of leftovers) {
			console.log(line);
		}

		console.log(`${leftovers.length} leftovers`);
		process.exit(leftovers.length ? 1 : 0);
	}

	const summary = apply(root, table, values);

	console.log(
		`moved ${summary.moved}, rewrote ${summary.rewritten}, stubs ${summary.stubs}, deleted ${summary.deleted}`,
	);
}

if (import.meta.main) {
	main();
}

export default { isStub, stubFor, buildLayout, check, apply };
