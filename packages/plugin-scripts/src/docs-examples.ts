import { createProcessor } from '@mdx-js/mdx';
import remarkFrontmatter from 'remark-frontmatter';
import { mkdir, rm } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { REPO_ROOT } from './paths';

/** The plugin the examples are checked inside: it supplies `@unbound-app/settings` and `@unbound-app/i18n`. */
export const FIXTURE_DIR = resolve(REPO_ROOT, 'packages/plugin-scripts/docs-fixture');

/** The plugin the guide quotes. Its own typecheck and tests cover the code a `quoted` or `excerpt` block copies. */
export const REFERENCE_PLUGIN_DIR = resolve(REPO_ROOT, 'packages/plugins/character-counter');

/**
 * The words a code fence's info string can carry after the language, and what each promises:
 * `partial` is a fragment that is not a program, so nothing checks it. `quoted` is a whole file of the
 * reference plugin, named by the block's title, and must equal it. `excerpt` is lines of that file, and
 * must appear in it unchanged. Any other block in ts or tsx is typechecked.
 */
export const FENCE_FLAGS = ['partial', 'quoted', 'excerpt'] as const;

export type FenceFlag = (typeof FENCE_FLAGS)[number];

const CHECKED_LANGUAGES = new Set(['ts', 'tsx']);

type MdastNode = {
	type: string;
	lang?: string | null;
	meta?: string | null;
	value?: string;
	children?: MdastNode[];
	position?: { start: { line: number } };
};

/** One fenced code block of a page. */
export type CodeExample = {
	/** The page's path, relative to the repository root. */
	page: string;
	/** The line of the opening fence. */
	line: number;
	lang: string;
	/** The fence's text after the language, without the flag: the file the code belongs to. */
	title: string | undefined;
	flag: FenceFlag | undefined;
	code: string;
};

/** A problem in a block, placed on the line of the MDX page that holds it. */
export type ExampleError = { page: string; line: number; message: string };

/** What checking one page found. */
export type PageReport = {
	page: string;
	checked: number;
	partial: number;
	quoted: number;
	errors: ExampleError[];
};

type Snippet = { example: CodeExample; file: string };

function isFenceFlag(word: string): word is FenceFlag {
	return FENCE_FLAGS.some((flag) => flag === word);
}

function collect(node: MdastNode, page: string, found: CodeExample[]): void {
	if (node.type === 'code') {
		const words = (node.meta ?? '').split(' ').filter(Boolean);

		found.push({
			page,
			line: node.position?.start.line ?? 0,
			lang: node.lang ?? '',
			title: words.filter((word) => !isFenceFlag(word)).join(' ') || undefined,
			flag: words.find(isFenceFlag),
			code: node.value ?? '',
		});
	}

	for (const child of node.children ?? []) {
		collect(child, page, found);
	}
}

/**
 * @description Lists every fenced code block of an MDX page, including those inside JSX such as `<Step>`.
 * @param source The page's MDX source.
 * @param page The page's path, kept on each block for reports.
 * @returns The blocks in page order.
 */
export function extractExamples(source: string, page: string): CodeExample[] {
	const tree = createProcessor({ remarkPlugins: [remarkFrontmatter] }).parse(source);
	const found: CodeExample[] = [];

	collect(tree, page, found);

	return found;
}

function isTypeScriptFile(title: string | undefined): title is string {
	return (
		title !== undefined &&
		!title.includes(' ') &&
		(title.endsWith('.ts') || title.endsWith('.tsx'))
	);
}

/**
 * @description Names the file each checked block is written to. A block titled with a path goes at that path,
 * so `~/` imports and relative imports between a page's blocks resolve. When a title repeats, only the last
 * block takes the path; earlier ones go under `snippets/`, where they are still checked.
 * @param examples The checked blocks of one page, in page order.
 * @returns Each block with its file, relative to the sandbox.
 */
export function assignFiles(examples: CodeExample[]): Snippet[] {
	const lastWithTitle = new Map<string, CodeExample>();

	for (const example of examples) {
		if (isTypeScriptFile(example.title)) lastWithTitle.set(example.title, example);
	}

	return examples.map((example, index) => {
		const { title } = example;

		if (isTypeScriptFile(title) && lastWithTitle.get(title) === example) {
			return { example, file: title };
		}

		const name = isTypeScriptFile(title) ? basename(title) : `example.${example.lang}`;

		return { example, file: `snippets/${String(index).padStart(2, '0')}-${name}` };
	});
}

/**
 * @description Compares a `quoted` or `excerpt` block with the reference plugin's file named by its title.
 * @param example The block.
 * @returns What differs, or `undefined` when the block matches.
 */
export async function quoteProblem(example: CodeExample): Promise<string | undefined> {
	const { title, flag, code } = example;

	if (!title) return `A ${flag} block needs a title naming a file of the reference plugin.`;

	const file = Bun.file(join(REFERENCE_PLUGIN_DIR, title));

	if (!(await file.exists())) return `${title} is not a file of the reference plugin.`;

	const text = (await file.text()).trimEnd();

	if (flag === 'quoted' && text !== code.trimEnd()) {
		return `The block differs from ${title} in the reference plugin. Copy the file again.`;
	}

	if (flag === 'excerpt' && !text.includes(code.trimEnd())) {
		return `The block's lines are not in ${title} of the reference plugin. Copy them again.`;
	}
}

// An `export {}` makes a block with no import or export a module, so two blocks can both declare `const Messages`.
function moduleSource(code: string): string {
	return `${code}\n\nexport {};\n`;
}

function sandboxConfig(): string {
	return JSON.stringify(
		{
			extends: '../../tsconfig.json',
			compilerOptions: { paths: { '~/*': ['./src/*'] } },
			include: ['.', '../../src/*.d.ts'],
		},
		null,
		'\t',
	);
}

function placeError(line: string, snippets: Snippet[], page: string): ExampleError {
	const open = line.indexOf('(');
	const file = line.slice(0, open);
	const [row] = line.slice(open + 1, line.indexOf(')')).split(',');
	const message = line.slice(line.indexOf('error TS'));
	const snippet = snippets.find((candidate) => candidate.file === file);

	if (!snippet || open < 0) return { page, line: 0, message: line };

	return { page, line: snippet.example.line + Number(row), message: `${message} (${file})` };
}

/**
 * @description Reads the errors out of `tsc --pretty false` output.
 * @param output The compiler's output.
 * @param snippets The files that were written, to map each error to its page line.
 * @param page The page's path.
 * @returns One entry per error, with the continuation lines of a multi-line message joined to it.
 */
export function parseErrors(output: string, snippets: Snippet[], page: string): ExampleError[] {
	const errors: ExampleError[] = [];

	for (const line of output.split('\n')) {
		if (line.includes('error TS')) {
			errors.push(placeError(line, snippets, page));
		} else if (line.startsWith(' ') && errors.length) {
			errors.at(-1)!.message += `\n${line.trim()}`;
		}
	}

	return errors;
}

async function typecheck(snippets: Snippet[], page: string): Promise<ExampleError[]> {
	const sandbox = join(FIXTURE_DIR, '.sandbox', page.replaceAll('/', '-').replace('.mdx', ''));

	await rm(sandbox, { recursive: true, force: true });

	try {
		await Promise.all(
			snippets.map(async ({ example, file }) => {
				await mkdir(dirname(join(sandbox, file)), { recursive: true });
				await Bun.write(join(sandbox, file), moduleSource(example.code));
			}),
		);
		await Bun.write(join(sandbox, 'tsconfig.json'), sandboxConfig());

		const child = Bun.spawn(['bunx', 'tsc', '-p', sandbox, '--noEmit', '--pretty', 'false'], {
			cwd: FIXTURE_DIR,
			stdout: 'pipe',
			stderr: 'pipe',
		});
		const [stdout, stderr] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
		const output = (stdout + stderr).replaceAll(`${relative(FIXTURE_DIR, sandbox)}/`, '');

		return parseErrors(output, snippets, page);
	} finally {
		await rm(sandbox, { recursive: true, force: true });
	}
}

/**
 * @description Checks every code block of a page. A ts or tsx block is typechecked inside the fixture plugin,
 * against `@unbound-app/api` and the plugin's generated `@unbound-app/settings` and `@unbound-app/i18n`. A
 * `quoted` or `excerpt` block is compared with the reference plugin. A `partial` block is counted and left out.
 * @param source The page's MDX source.
 * @param page The page's path, relative to the repository root.
 * @returns How many blocks each kind of check covered, and every problem.
 */
export async function checkPage(source: string, page: string): Promise<PageReport> {
	const examples = extractExamples(source, page);
	const checked = examples.filter(
		(example) => CHECKED_LANGUAGES.has(example.lang) && !example.flag,
	);
	const quoted = examples.filter(
		(example) => example.flag === 'quoted' || example.flag === 'excerpt',
	);
	const problems = await Promise.all(quoted.map(quoteProblem));
	const errors: ExampleError[] = quoted.flatMap((example, index) =>
		problems[index] ? [{ page, line: example.line, message: problems[index] }] : [],
	);

	if (checked.length) errors.push(...(await typecheck(assignFiles(checked), page)));

	return {
		page,
		checked: checked.length,
		partial: examples.filter((example) => example.flag === 'partial').length,
		quoted: quoted.length,
		errors,
	};
}

/**
 * @description Lists the guide pages whose examples are checked.
 * @returns Each page's path relative to the repository root, sorted.
 */
export function examplePages(): string[] {
	const pages = ['docs/developer/concepts.mdx'];

	for (const folder of ['addons', 'plugins']) {
		pages.push(...new Bun.Glob(`docs/developer/${folder}/*.mdx`).scanSync({ cwd: REPO_ROOT }));
	}

	return pages.sort();
}
