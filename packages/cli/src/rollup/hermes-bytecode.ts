import hermesManifest from '@unbound-app/rollup-plugin-hermes/dist/manifest.js';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { ADDON_SCOPE_GLOBALS } from '@unbound-app/types/addons';
import { execFile } from 'node:child_process';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { Plugin } from 'rollup';
import { tmpdir } from 'node:os';

type HermesTarget = { version: number; dir: string | null };

type BytecodeOptions = { versions: number[] };

const run = promisify(execFile);
const { fetchManifest, resolveHermesTargets } = hermesManifest;

const FALL_BACK_TO_GLOBAL = new Set([
	'unbound',
	'setTimeout',
	'setInterval',
	'clearTimeout',
	'clearInterval',
]);

const parameters = ADDON_SCOPE_GLOBALS.map((name) =>
	FALL_BACK_TO_GLOBAL.has(name) ? `${name} = globalThis.${name}` : name,
).join(', ');

/**
 * @description Wraps a plugin bundle the way the client evaluates its source, so the compiled program's completion value is the same factory.
 * @param code The plugin's final bundle expression.
 * @returns The wrapped source.
 */
export function bytecodeSource(code: string): string {
	return `((${parameters}) => { return ${code} })`;
}

/**
 * @description Names the compiled bundle beside a source bundle, matching the loader's lookup.
 * @param fileName The source bundle's file name, such as `index.js`.
 * @param version The Hermes bytecode version.
 * @returns The bytecode file name, such as `index.98.hbc`.
 */
export function bytecodeFileName(fileName: string, version: number): string {
	return `${fileName.replace(/\.[^.]+$/, '')}.${version}.hbc`;
}

// UNKNOWN: execFile rejects with whatever the child process failure carries.
function firstError(error: unknown) {
	const stderr =
		error instanceof Error && 'stderr' in error && typeof error.stderr === 'string'
			? error.stderr
			: void 0;
	const output = stderr ?? (error instanceof Error ? error.message : String(error));

	return (
		output
			.split('\n')
			.find((line) => line.includes('error:'))
			?.trim() ?? output.trim()
	);
}

async function compile(hermesc: string, source: string, output: string) {
	await run(hermesc, [
		'--emit-binary',
		'-O',
		'-g0',
		'-Wno-direct-eval',
		'-Wno-undefined-variable',
		'--out',
		output,
		source,
	]);

	return readFile(output);
}

/**
 * @description Counts how many of hermesc's newest versions to resolve so every wanted version is among them.
 * @param latest hermesc's versions, newest first.
 * @param wanted The bytecode versions to compile for.
 * @returns The number of newest versions to resolve.
 */
export function hermescCount(latest: number[], wanted: number[]): number {
	const missing = wanted.filter((version) => !latest.includes(version));

	if (missing.length) {
		throw new Error(`hermesc does not publish bytecode ${missing.join(', ')}.`);
	}

	return Math.max(...wanted.map((version) => latest.indexOf(version)), 0) + 1;
}

/**
 * @description Compiles each plugin bundle to Hermes bytecode for exactly the bytecode versions the client ships.
 * @param options The bytecode versions to compile for.
 * @returns The rollup plugin.
 */
export function hermesBytecode({ versions }: BytecodeOptions): Plugin {
	let targets: HermesTarget[] | undefined;

	return {
		name: 'hermes-bytecode',
		async generateBundle(_outputOptions, bundle) {
			targets ??= (
				(await resolveHermesTargets(this, {
					versions: hermescCount((await fetchManifest(this)).latest, versions),
				})) as HermesTarget[]
			).filter((target) => versions.includes(target.version));

			const executable = process.platform === 'win32' ? 'hermesc.exe' : 'hermesc';
			const directory = await mkdtemp(join(tmpdir(), 'plugin-bytecode-'));

			try {
				for (const chunk of Object.values(bundle)) {
					if (chunk.type !== 'chunk') {
						continue;
					}

					const source = join(directory, 'bundle.js');

					await writeFile(source, bytecodeSource(chunk.code));

					for (const { version, dir } of targets) {
						if (!dir) {
							this.warn(
								`hermesc for bytecode version ${version} is unavailable, skipping it.`,
							);
							continue;
						}

						const hermesc = resolve(dir, process.platform, executable);
						const output = join(directory, `${version}.hbc`);
						const compiled = await compile(hermesc, source, output).catch((error) => {
							this.warn(
								`hermesc ${version} could not compile ${chunk.fileName}, so that runtime loads its source: ${firstError(error)}`,
							);
						});

						if (compiled) {
							this.emitFile({
								type: 'asset',
								fileName: bytecodeFileName(chunk.fileName, version),
								source: compiled,
							});
						}
					}
				}
			} finally {
				await rm(directory, { recursive: true, force: true });
			}
		},
	};
}

export default { bytecodeSource, bytecodeFileName, hermescCount, hermesBytecode };
