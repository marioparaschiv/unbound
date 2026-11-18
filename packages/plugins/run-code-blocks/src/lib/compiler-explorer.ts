const API = 'https://godbolt.org/api';
const MAX_OUTPUT = 1500;
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;

/** What running a block produced. */
export type RunResult = { output: string; exitCode: number };

type OutputLine = { text?: string };

type CompileResponse = {
	code?: number;
	didExecute?: boolean;
	stdout?: OutputLine[];
	stderr?: OutputLine[];
	buildResult?: { code?: number; stderr?: OutputLine[] };
};

type LanguageEntry = { id?: string; defaultCompiler?: string };

let compilers: Promise<Map<string, string>> | undefined;

function lines(output: OutputLine[] | undefined): string {
	return (output ?? []).map((line) => (line.text ?? '').replace(ANSI, '')).join('\n');
}

function isCompileResponse(value: unknown): value is CompileResponse {
	return Boolean(value) && typeof value === 'object';
}

/**
 * @description Reads what a Compiler Explorer run printed: the build's errors when it didn't build, otherwise the
 * program's output and errors, cut to 1500 characters.
 * @param response The parsed compile response.
 * @returns The output and exit code.
 */
export function readRun(response: CompileResponse): RunResult {
	const built = response.didExecute !== false || (response.buildResult?.code ?? 0) === 0;
	const text = built
		? [lines(response.stdout), lines(response.stderr)].filter(Boolean).join('\n')
		: lines(response.buildResult?.stderr);

	return { output: text.trim().slice(0, MAX_OUTPUT), exitCode: response.code ?? -1 };
}

async function defaultCompilers(): Promise<Map<string, string>> {
	const response = await fetch(`${API}/languages?fields=id,defaultCompiler`, {
		headers: { Accept: 'application/json' },
	});
	const payload: unknown = response.ok ? await response.json() : [];
	const entries = (Array.isArray(payload) ? payload : []) as LanguageEntry[];

	return new Map(
		entries.flatMap((entry) =>
			entry.id && entry.defaultCompiler ? [[entry.id, entry.defaultCompiler] as const] : [],
		),
	);
}

/**
 * @description Runs code on Compiler Explorer with the language's default compiler.
 * @param language The Compiler Explorer language id.
 * @param code The source.
 * @returns What it printed, or throws when Compiler Explorer can't run it.
 */
export async function runCode(language: string, code: string): Promise<RunResult> {
	compilers ??= defaultCompilers().catch((error: unknown) => {
		compilers = undefined;
		throw error;
	});

	const compiler = (await compilers).get(language);

	if (!compiler) throw new Error(`Compiler Explorer has no compiler for ${language}`);

	const response = await fetch(`${API}/compiler/${compiler}/compile`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({
			source: code,
			options: {
				compilerOptions: { executorRequest: true },
				filters: { execute: true },
				tools: [],
			},
		}),
	});
	const payload: unknown = await response.json();

	if (!response.ok || !isCompileResponse(payload)) {
		throw new Error(`Compiler Explorer answered ${response.status}`);
	}

	return readRun(payload);
}
