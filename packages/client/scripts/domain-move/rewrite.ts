import { posix } from 'node:path';

export const PACKAGE_ROOT = 'packages/client';
export const SOURCE_ROOT = 'packages/client/src';

const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.json'];

const ALIAS = /(['"`])~\/([^'"`\s]*)\1/g;
const RELATIVE =
	/(\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*|\bmock\.module\s*\(\s*)(['"])(\.\.?(?:\/[^'"\s]*)?)\2/g;
const PACKAGE_PATH = /(['"`])(\.\/)?src\/([^'"`\s]*)\1/g;
const REPO_PATH = /(['"`])packages\/client\/src\/([^'"`\s]*)\1/g;

/** How a specifier named its module, kept so the rewritten specifier reads the same way. */
type SpecifierForm = 'file' | 'bare' | 'directory';

type Resolved = {
	path: string;
	form: SpecifierForm;
};

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

/**
 * @description Rewrites a path relative to `packages/client/src` that names a moved file or folder.
 * @param rest The path after `src/`, possibly a glob such as `api/metro/**`.
 * @param layout The move.
 * @param folders Whether `rest` may name a folder's `index` file, as a `~/` specifier does.
 * @returns The path after the move, `null` for a removed file, or `undefined` when it is unaffected.
 */
function rewriteSourcePath(
	rest: string,
	layout: Layout,
	folders: boolean = false,
): string | null | undefined {
	const resolved = resolveModule(posix.join(SOURCE_ROOT, rest), layout.known, folders);

	if (resolved) {
		if (layout.removed.has(resolved.path)) return null;

		const target = layout.files.get(resolved.path);

		if (!target) return;

		return posix.relative(SOURCE_ROOT, formatPath(target, resolved.form));
	}

	for (const [from, to] of layout.directories) {
		const folder = posix.relative(SOURCE_ROOT, from);

		if (isInside(rest, folder)) {
			return posix.relative(SOURCE_ROOT, to) + rest.slice(folder.length);
		}
	}

	return void 0;
}

function rewriteRelative(
	specifier: string,
	from: string,
	to: string,
	layout: Layout,
): string | null | undefined {
	const resolved = resolveModule(posix.join(posix.dirname(from), specifier), layout.known);

	if (!resolved) return;

	if (layout.removed.has(resolved.path)) return null;

	const target = layout.files.get(resolved.path) ?? resolved.path;

	if (target === resolved.path && to === from) return;

	const path = formatPath(target, resolved.form);
	const next = relativeSpecifier(to, path);

	if (next.startsWith('..') && isInside(to, SOURCE_ROOT) && isInside(path, SOURCE_ROOT)) {
		return `~/${posix.relative(SOURCE_ROOT, path)}`;
	}

	return next;
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

	function record(before: string, after: string | null | undefined, quote: string) {
		if (after === undefined || after === before) {
			return quote + before + quote;
		}

		if (after === null) {
			changes.push({ before });

			return quote + before + quote;
		}

		changes.push({ before, after });

		return quote + after + quote;
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

		const after = rewriteSourcePath(rest, layout, true);

		return record(`~/${rest}`, after && `~/${after}`, quote);
	});

	next = next.replace(PACKAGE_PATH, (match, quote: string, dot = '', rest: string) => {
		if (!inPackage || inSource) {
			return match;
		}

		const after = rewriteSourcePath(rest, layout);

		return record(`${dot}src/${rest}`, after && `${dot}src/${after}`, quote);
	});

	next = next.replace(REPO_PATH, (_, quote: string, rest: string) => {
		const after = rewriteSourcePath(rest, layout);
		const prefix = `${SOURCE_ROOT}/`;

		return record(prefix + rest, after && prefix + after, quote);
	});

	if (!inPackage) {
		return { text: next, changes };
	}

	for (const [folder, target] of layout.directories) {
		const before = escapeSlashes(`/src/${posix.relative(SOURCE_ROOT, folder)}/`);

		if (!next.includes(before)) {
			continue;
		}

		const after = escapeSlashes(`/src/${posix.relative(SOURCE_ROOT, target)}/`);

		next = next.replaceAll(before, after);
		changes.push({ before, after });
	}

	return { text: next, changes };
}

function escapeSlashes(path: string): string {
	return path.replaceAll('/', '\\/');
}

export default { PACKAGE_ROOT, SOURCE_ROOT, resolveModule, aliasFor, rewriteSource };
