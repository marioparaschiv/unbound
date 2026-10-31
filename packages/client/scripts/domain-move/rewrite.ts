import { posix } from 'node:path';

export const PACKAGE_ROOT = 'packages/client';
export const SOURCE_ROOT = 'packages/client/src';

const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
const UNAFFECTED: Outcome = { type: 'unaffected' };
const REMOVED: Outcome = { type: 'removed' };

const ALIAS = /(['"`])~\/([^'"`\s]*)\1/g;
const RELATIVE =
	/(\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*|\bmock\.module\s*\(\s*)(['"])(\.\.?(?:\/[^'"\s]*)?)\2/g;
const PACKAGE_PATH = /(['"`])(\.\/)?src\/([^'"`\s]*)\1/g;
const REPO_PATH = /(['"`])packages\/client\/src\/([^'"`\s]*)\1/g;

type SpecifierForm = 'file' | 'bare' | 'directory';

type Resolved = {
	path: string;
	form: SpecifierForm;
};

type Outcome = { type: 'unaffected' } | { type: 'removed' } | { type: 'moved'; path: string };

/** The move in repo-relative paths. `known` holds every file that exists or existed before the move. */
export type Layout = {
	files: Map<string, string>;
	directories: Map<string, string>;
	removed: Set<string>;
	known: Set<string>;
};

/** One specifier the rewrite changes. `after` is absent when the specifier names a removed file. */
export type Change = {
	before: string;
	after?: string;
};

export type Rewrite = {
	text: string;
	changes: Change[];
};

/**
 * @description Resolves a module path the way the bundler does: as written, with an extension, or as a folder index.
 * @param base The repo-relative path a specifier names.
 * @param known Every repo-relative file path that may be named.
 * @param folders Whether a folder name resolves to its `index` file; off for path strings, where a folder means the folder.
 * @returns The file and how the specifier named it, or `undefined` when nothing matches.
 */
export function resolveModule(
	base: string,
	known: Set<string>,
	folders: boolean = true,
): Resolved | undefined {
	const path = posix.normalize(base);

	if (known.has(path)) {
		return { path, form: 'file' };
	}

	for (const extension of EXTENSIONS) {
		if (known.has(path + extension)) {
			return { path: path + extension, form: 'bare' };
		}
	}

	for (const extension of folders ? EXTENSIONS : []) {
		if (known.has(`${path}/index${extension}`)) {
			return { path: `${path}/index${extension}`, form: 'directory' };
		}
	}

	return void 0;
}

function formatPath(path: string, form: SpecifierForm): string {
	if (form === 'file') {
		return path;
	}

	const bare = path.slice(0, path.length - posix.extname(path).length);

	if (form === 'directory' && posix.basename(bare) === 'index') {
		return posix.dirname(bare);
	}

	return bare;
}

/**
 * @description Writes the `~/` specifier for a file under `packages/client/src`, as an import would name it.
 * @param path The repo-relative file path.
 * @returns The specifier without its extension, naming the folder for an `index` file.
 */
export function aliasFor(path: string): string {
	return `~/${posix.relative(SOURCE_ROOT, formatPath(path, 'directory'))}`;
}

function isInside(path: string, folder: string): boolean {
	return path === folder || path.startsWith(`${folder}/`);
}

function relativeSpecifier(importer: string, target: string): string {
	const path = posix.relative(posix.dirname(importer), target);

	if (!path) {
		return '.';
	}

	if (path.startsWith('..')) {
		return path;
	}

	return `./${path}`;
}

function moved(path: string): Outcome {
	return { type: 'moved', path };
}

function withPrefix(outcome: Outcome, prefix: string): Outcome {
	return outcome.type === 'moved' ? moved(prefix + outcome.path) : outcome;
}

function incoming(layout: Layout, from: string, to: string): string[] {
	const names: string[] = [];

	for (const [source, target] of layout.files) {
		if (isInside(target, to) && !isInside(source, from)) {
			names.push(posix.relative(to, target));
		}
	}

	return names.toSorted();
}

function entries(layout: Layout, folder: string): string[] {
	const names = new Set<string>();

	for (const path of layout.files.keys()) {
		if (!isInside(path, folder)) {
			continue;
		}

		const name = posix.relative(folder, path);
		const [head] = name.split('/');

		names.add(head === name ? name : `${head}/**`);
	}

	return [...names].toSorted();
}

function rewriteFolder(rest: string, from: string, to: string, layout: Layout): Outcome {
	const folder = posix.relative(SOURCE_ROOT, from);
	const target = posix.relative(SOURCE_ROOT, to);
	const suffix = rest.slice(folder.length);

	if (suffix !== '/**' || !incoming(layout, from, to).length) {
		return moved(target + suffix);
	}

	return moved(`${target}/{${entries(layout, from).join(',')}}`);
}

function rewriteSourcePath(rest: string, layout: Layout, folders: boolean = false): Outcome {
	const resolved = resolveModule(posix.join(SOURCE_ROOT, rest), layout.known, folders);

	if (resolved) {
		if (layout.removed.has(resolved.path)) {
			return REMOVED;
		}

		const target = layout.files.get(resolved.path);

		if (!target) {
			return UNAFFECTED;
		}

		return moved(posix.relative(SOURCE_ROOT, formatPath(target, resolved.form)));
	}

	for (const [from, to] of layout.directories) {
		if (isInside(rest, posix.relative(SOURCE_ROOT, from))) {
			return rewriteFolder(rest, from, to, layout);
		}
	}

	return UNAFFECTED;
}

function rewriteRelative(specifier: string, from: string, to: string, layout: Layout): Outcome {
	const resolved = resolveModule(posix.join(posix.dirname(from), specifier), layout.known);

	if (!resolved) {
		return UNAFFECTED;
	}

	if (layout.removed.has(resolved.path)) {
		return REMOVED;
	}

	const target = layout.files.get(resolved.path) ?? resolved.path;

	if (target === resolved.path && to === from) {
		return UNAFFECTED;
	}

	const path = formatPath(target, resolved.form);
	const next = relativeSpecifier(to, path);

	if (next.startsWith('..') && isInside(to, SOURCE_ROOT) && isInside(path, SOURCE_ROOT)) {
		return moved(`~/${posix.relative(SOURCE_ROOT, path)}`);
	}

	return moved(next);
}

/**
 * @description Rewrites every specifier and path string in one file that names a moved file.
 * @param text The file's contents.
 * @param from The file's repo-relative path now.
 * @param to The file's repo-relative path after the move.
 * @param layout The move.
 * @returns The new contents and each specifier that changed.
 */
export function rewriteSource(text: string, from: string, to: string, layout: Layout): Rewrite {
	const changes: Change[] = [];
	const inPackage = isInside(from, PACKAGE_ROOT);
	const inSource = isInside(from, SOURCE_ROOT);

	function record(before: string, outcome: Outcome, quote: string) {
		if (outcome.type === 'removed') {
			changes.push({ before });
		}

		if (outcome.type !== 'moved' || outcome.path === before) {
			return quote + before + quote;
		}

		changes.push({ before, after: outcome.path });

		return quote + outcome.path + quote;
	}

	let next = text.replace(RELATIVE, (match, lead: string, quote: string, specifier: string) => {
		if (!inPackage) {
			return match;
		}

		return lead + record(specifier, rewriteRelative(specifier, from, to, layout), quote);
	});

	next = next.replace(ALIAS, (match, quote: string, rest: string) => {
		if (!inPackage) {
			return match;
		}

		return record(`~/${rest}`, withPrefix(rewriteSourcePath(rest, layout, true), '~/'), quote);
	});

	next = next.replace(PACKAGE_PATH, (match, quote: string, dot = '', rest: string) => {
		if (!inPackage || inSource) {
			return match;
		}

		const outcome = withPrefix(rewriteSourcePath(rest, layout), `${dot}src/`);

		return record(`${dot}src/${rest}`, outcome, quote);
	});

	next = next.replace(REPO_PATH, (_, quote: string, rest: string) => {
		const prefix = `${SOURCE_ROOT}/`;

		return record(prefix + rest, withPrefix(rewriteSourcePath(rest, layout), prefix), quote);
	});

	if (!inPackage) {
		return { text: next, changes };
	}

	for (const [folder, target] of layout.directories) {
		const before = escapeSlashes(`/src/${posix.relative(SOURCE_ROOT, folder)}/`);

		if (!next.includes(before)) {
			continue;
		}

		const after =
			escapeSlashes(`/src/${posix.relative(SOURCE_ROOT, target)}/`) +
			excluding(incoming(layout, folder, target));

		next = next.replaceAll(before, () => after);
		changes.push({ before, after });
	}

	return { text: next, changes };
}

function escapeSlashes(path: string): string {
	return path.replaceAll('/', '\\/');
}

function excluding(names: string[]): string {
	if (!names.length) {
		return '';
	}

	const escaped = names.map((name) => name.replaceAll(/[.*+?^${}()|[\]\\/]/g, '\\$&'));

	return `(?!(?:${escaped.join('|')})$)`;
}

export default { PACKAGE_ROOT, SOURCE_ROOT, resolveModule, aliasFor, rewriteSource };
