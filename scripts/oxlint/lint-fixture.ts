import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

export type Finding = { file: string; message: string };

type Files = Record<string, string>;

type Diagnostic = { filename: string; message: string; code: string };

type Report = { diagnostics: Diagnostic[] };

type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

export type JsonObject = { [key: string]: JsonValue };

// UNKNOWN: oxlint's JSON report is external output, narrowed here before use.
function isReport(value: unknown): value is Report {
	return (
		typeof value === 'object' &&
		value !== null &&
		'diagnostics' in value &&
		Array.isArray(value.diagnostics)
	);
}

const root = resolve(import.meta.dir, '../..');
const plugin = join(import.meta.dir, 'plugin.ts');

/**
 * @description Lints a set of fixture files with one `unbound/*` rule through the real oxlint binary.
 * @param rule The rule name without the `unbound/` prefix.
 * @param files Fixture contents keyed by path relative to the fixture root.
 * @param options The rule's options, if it takes any.
 * @returns Every finding that rule reported, with the file it reported in.
 */
export async function lintFixture(
	rule: string,
	files: Files,
	options?: JsonObject,
): Promise<Finding[]> {
	const directory = await mkdtemp(join(tmpdir(), 'unbound-oxlint-'));
	const setting = options ? ['error', options] : 'error';
	const config = {
		jsPlugins: [{ name: 'unbound', specifier: plugin }],
		rules: { [`unbound/${rule}`]: setting },
	};

	try {
		await writeFile(join(directory, '.oxlintrc.json'), JSON.stringify(config));

		await Promise.all(
			Object.entries(files).map(async ([path, code]) => {
				await mkdir(dirname(join(directory, path)), { recursive: true });
				await writeFile(join(directory, path), code);
			}),
		);

		const child = Bun.spawn(
			[
				join(root, 'node_modules/.bin/oxlint'),
				'-A',
				'all',
				'-D',
				`unbound/${rule}`,
				'-f',
				'json',
				'.',
			],
			{
				cwd: directory,
				stdout: 'pipe',
				stderr: 'pipe',
			},
		);
		const output = await new Response(child.stdout).text();

		await child.exited;

		const report: unknown = JSON.parse(output);

		if (!isReport(report)) {
			throw new Error(`oxlint printed no JSON report:\n${output}`);
		}

		return report.diagnostics
			.filter((diagnostic) => diagnostic.code === `unbound(${rule})`)
			.map((diagnostic) => ({ file: diagnostic.filename, message: diagnostic.message }));
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

/**
 * @description Lists the fixture files a rule reported in, sorted, for comparison against the expected set.
 * @param findings The findings from `lintFixture`.
 * @returns The sorted, unique file paths.
 */
export function flaggedFiles(findings: Finding[]): string[] {
	return [...new Set(findings.map((finding) => finding.file))].sort();
}
