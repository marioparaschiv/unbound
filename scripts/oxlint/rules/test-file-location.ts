import { dirname, join, relative, resolve, sep } from 'node:path';
import { readFileSync, statSync } from 'node:fs';

import type { Rule } from '../rule';

import packageRootOf from '../package-root-of.ts';

const TEST_NAME = /\.(test|spec|s3|suite)\.[cm]?[jt]sx?$/;

const SUPPORT_FOLDERS = new Set(['helpers', 'fixtures']);

const OUT_OF_SCOPE = [
	`${sep}packages${sep}cli${sep}templates${sep}`,
	`${sep}tests${sep}fixtures${sep}`,
];

const directories = new Map<string, boolean>();

const workspaceRoots = new Map<string, boolean>();

function isDirectory(path: string): boolean {
	const cached = directories.get(path);

	if (cached !== undefined) {
		return cached;
	}

	const directory = statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false;

	directories.set(path, directory);

	return directory;
}

function isWorkspaceRoot(root: string): boolean {
	const cached = workspaceRoots.get(root);

	if (cached !== undefined) {
		return cached;
	}

	const workspace = readFileSync(join(root, 'package.json'), 'utf8').includes('"workspaces"');

	workspaceRoots.set(root, workspace);

	return workspace;
}

// The workspace root's own `scripts/` folder is a root of its own, with `scripts/tests/`.
function testRootOf(directory: string): string | undefined {
	const root = packageRootOf(directory);

	if (!root) {
		return undefined;
	}

	const scripts = join(root, 'scripts');
	const inScripts = directory === scripts || directory.startsWith(`${scripts}${sep}`);

	return inScripts && isWorkspaceRoot(root) ? scripts : root;
}

const testFileLocation: Rule = {
	meta: {
		type: 'suggestion',
		messages: {
			misplaced:
				"Tests live in the package's `tests/`, mirroring its source folders. Move this file to `{{expected}}` (AGENTS.md)",
			unmirrored:
				'`tests/{{folder}}/` mirrors no source folder: neither `src/{{folder}}/` nor `{{folder}}/` exists. Move this file to the `tests/` folder mirroring its source, or into `tests/helpers/` or `tests/fixtures/` (AGENTS.md)',
		},
	},
	create(context) {
		const path = resolve(context.cwd, context.filename);

		if (OUT_OF_SCOPE.some((part) => path.includes(part))) {
			return {};
		}

		const root = testRootOf(dirname(path));

		if (!root) {
			return {};
		}

		const segments = relative(root, path).split(sep);

		return {
			Program(node) {
				if (segments[0] !== 'tests') {
					if (!TEST_NAME.test(path)) return;

					const source = segments[0] === 'src' ? segments.slice(1) : segments;

					context.report({
						node,
						messageId: 'misplaced',
						data: { expected: ['tests', ...source].join('/') },
					});

					return;
				}

				const folders = segments.slice(1, -1);

				if (folders.length === 0 || SUPPORT_FOLDERS.has(folders[0] ?? '')) return;

				if (
					isDirectory(join(root, 'src', ...folders)) ||
					isDirectory(join(root, ...folders))
				) {
					return;
				}

				context.report({
					node,
					messageId: 'unmirrored',
					data: { folder: folders.join('/') },
				});
			},
		};
	},
};

export default testFileLocation;
