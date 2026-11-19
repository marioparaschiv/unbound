const ROOT = new URL('..', import.meta.url).pathname;
const CLIENT = `${ROOT}packages/client`;
const EXCEPTIONS_FILE = `${CLIENT}/min-loader-exceptions.json`;
const NATIVE_TYPINGS = /^packages\/types\/typings\/(native[^/]*|unbound-native)\.ts$/;
const DEVELOPER_ONLY = /^tests\/|\.dev\.tsx?$/;
const TSC_ERROR = /^(?<file>[^(]+)\(\d+,\d+\): error (?<code>TS\d+): (?<message>.+)$/;

export type MinLoaderFinding = { file: string; error: string };

export type MinLoaderException = MinLoaderFinding & { reason: string };

type ExceptionsFile = { loader: string; exceptions: MinLoaderException[] };

type Comparison = { unreviewed: MinLoaderFinding[]; stale: MinLoaderException[] };

/**
 * @description Reads TypeScript's plain output into findings, dropping line numbers and duplicates.
 * @param output The compiler's output with `--pretty false`.
 * @returns Each distinct error, by file and message.
 */
export function parseFindings(output: string): MinLoaderFinding[] {
	const seen = new Map<string, MinLoaderFinding>();

	for (const line of output.split('\n')) {
		const groups = TSC_ERROR.exec(line.trim())?.groups;

		if (!groups) {
			continue;
		}

		const finding = { file: groups.file, error: `${groups.code}: ${groups.message}` };

		seen.set(`${finding.file}\n${finding.error}`, finding);
	}

	return [...seen.values()];
}

/**
 * @description Whether a finding is in code that reaches users' loaders: tests and `*.dev.ts(x)` files never do.
 * @param finding The finding.
 * @returns Whether it ships in the release bundle.
 */
export function shipsToUsers({ file }: MinLoaderFinding): boolean {
	return !DEVELOPER_ONLY.test(file);
}

/**
 * @description Splits findings into those no exception covers, and exceptions that no longer match anything.
 * @param findings The client's errors against the older typings.
 * @param exceptions The reviewed exceptions for that loader.
 * @returns The unreviewed findings and the stale exceptions.
 */
export function compareFindings(
	findings: MinLoaderFinding[],
	exceptions: MinLoaderException[],
): Comparison {
	const key = ({ file, error }: MinLoaderFinding) => `${file}\n${error}`;
	const found = new Set(findings.map(key));
	const covered = new Set(exceptions.map(key));

	return {
		unreviewed: findings.filter((finding) => !covered.has(key(finding))),
		stale: exceptions.filter((exception) => !found.has(key(exception))),
	};
}

// UNKNOWN: one entry of the hand-edited exceptions file.
function isException(value: unknown): value is MinLoaderException {
	return (
		typeof value === 'object' &&
		value !== null &&
		'file' in value &&
		typeof value.file === 'string' &&
		'error' in value &&
		typeof value.error === 'string' &&
		'reason' in value &&
		typeof value.reason === 'string'
	);
}

// UNKNOWN: the parsed exceptions file.
function isExceptionsFile(value: unknown): value is ExceptionsFile {
	return (
		typeof value === 'object' &&
		value !== null &&
		'loader' in value &&
		typeof value.loader === 'string' &&
		'exceptions' in value &&
		Array.isArray(value.exceptions) &&
		value.exceptions.every(isException)
	);
}

/**
 * @description Reads the exceptions file, which only counts for the loader version it names.
 * @param text The file's contents.
 * @param loader The current `minLoaderVersion`.
 * @returns The exceptions for that version, or none when the file names another one.
 */
export function readExceptions(text: string, loader: string): MinLoaderException[] {
	const value: unknown = JSON.parse(text);

	if (!isExceptionsFile(value)) {
		throw new Error(
			`${EXCEPTIONS_FILE} needs a "loader" version and an "exceptions" list of { file, error, reason }.`,
		);
	}

	const { loader: version, exceptions } = value;

	return version === loader ? exceptions : [];
}

function run(command: string[], cwd = ROOT) {
	const result = Bun.spawnSync(command, { cwd, stdout: 'pipe', stderr: 'pipe' });

	return {
		ok: result.exitCode === 0,
		output: `${result.stdout.toString()}${result.stderr.toString()}`,
	};
}

function ensureTag(tag: string) {
	if (run(['git', 'rev-parse', '--verify', '--quiet', `refs/tags/${tag}`]).ok) {
		return;
	}

	const fetched = run([
		'git',
		'fetch',
		'--no-tags',
		'--depth=1',
		'origin',
		`refs/tags/${tag}:refs/tags/${tag}`,
	]);

	if (!fetched.ok) {
		throw new Error(`Failed to fetch loader tag ${tag}:\n${fetched.output}`);
	}
}

async function findingsAgainst(tag: string): Promise<MinLoaderFinding[]> {
	const listed = run(['git', 'ls-tree', '--name-only', tag, 'packages/types/typings/']);
	const files = listed.output.split('\n').filter((path) => NATIVE_TYPINGS.test(path));
	const originals = new Map<string, string | undefined>();

	try {
		for (const path of files) {
			const current = Bun.file(`${ROOT}${path}`);

			originals.set(path, (await current.exists()) ? await current.text() : undefined);
			await Bun.write(`${ROOT}${path}`, run(['git', 'show', `${tag}:${path}`]).output);
		}

		return parseFindings(
			run(
				[
					'bunx',
					'tsc',
					'-p',
					'.',
					'--noEmit',
					'--pretty',
					'false',
					'--incremental',
					'false',
				],
				CLIENT,
			).output,
		);
	} finally {
		for (const [path, text] of originals) {
			if (text === undefined) {
				await Bun.file(`${ROOT}${path}`).delete();
			} else {
				await Bun.write(`${ROOT}${path}`, text);
			}
		}
	}
}

function describe(finding: MinLoaderFinding) {
	return `  ${finding.file}: ${finding.error}`;
}

if (import.meta.main) {
	const manifest = await Bun.file(`${CLIENT}/package.json`).json();
	const loader = String(manifest.unbound?.minLoaderVersion ?? manifest.minLoaderVersion ?? '');

	if (!loader) {
		throw new Error('packages/client/package.json declares no minLoaderVersion');
	}

	const tag = `loader-v${loader}`;
	const exceptionsFile = Bun.file(EXCEPTIONS_FILE);
	const exceptions = (await exceptionsFile.exists())
		? readExceptions(await exceptionsFile.text(), loader)
		: [];

	ensureTag(tag);

	const { unreviewed, stale } = compareFindings(
		(await findingsAgainst(tag)).filter(shipsToUsers),
		exceptions,
	);

	for (const exception of stale) {
		console.warn(`Stale exception, nothing matches it any more:\n${describe(exception)}`);
	}

	if (unreviewed.length) {
		console.error(
			[
				`The client uses native members loader ${loader} (minLoaderVersion) does not have:`,
				...unreviewed.map(describe),
				'',
				`Raise minLoaderVersion, guard the call, or list it in packages/client/min-loader-exceptions.json`,
				`with the reason it degrades safely on ${loader}.`,
			].join('\n'),
		);
		process.exit(1);
	}

	console.log(`The client runs on loader ${loader}: ${exceptions.length} reviewed exception(s).`);
}
