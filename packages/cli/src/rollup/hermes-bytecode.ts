import { hermescBinary, resolveHermesTargets } from '@unbound-app/rollup-plugin-hermes/manifest';
import type { HermesTarget } from '@unbound-app/rollup-plugin-hermes/manifest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { getBytecodePath } from '@unbound-app/contracts/version-layout';
import { ADDON_SCOPE_GLOBALS } from '@unbound-app/types/addons';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type { Plugin } from 'rollup';
import { tmpdir } from 'node:os';

import { BYTECODE_DIGESTS_FILENAME, type BytecodeDigests } from './bytecode-digests-schema.ts';

type BytecodeOptions = { versions: number[]; sourceName: string };

const run = promisify(execFile);

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

async function compile(hermesc: string, directory: string, source: string, output: string) {
	await run(
		hermesc,
		[
			'--emit-binary',
			'-O',
			'-g1',
			'-Wno-direct-eval',
			'-Wno-undefined-variable',
			'--out',
			output,
			source,
		],
		{ cwd: directory },
	);

	return readFile(output);
}

async function sha512(path: string) {
	return createHash('sha512')
		.update(await readFile(path))
		.digest('hex');
}

/**
 * @description Compiles each plugin bundle to Hermes bytecode for exactly the bytecode versions the client ships.
 * Once written, it records each bundle's digest and its bytecode's in {@link BYTECODE_DIGESTS_FILENAME}, so a
 * reader takes only this build's bytecode, never a leftover from an earlier build.
 * @param options The bytecode versions to compile for, and the name the bytecode's source locations use.
 * @returns The rollup plugin.
 */
export function hermesBytecode({ versions, sourceName }: BytecodeOptions): Plugin {
	let targets: HermesTarget[] | undefined;
	// Each bundle's bytecode file names, by version, from the last generateBundle.
	let emitted = new Map<string, Map<number, string>>();

	return {
		name: 'hermes-bytecode',
		async generateBundle(_outputOptions, bundle) {
			emitted = new Map();

			targets ??= await resolveHermesTargets(this, { versions });

			const directory = await mkdtemp(join(tmpdir(), 'plugin-bytecode-'));

			try {
				for (const chunk of Object.values(bundle)) {
					if (chunk.type !== 'chunk') {
						continue;
					}

					const source = `unbound-plugin/${sourceName}.js`;

					await mkdir(join(directory, 'unbound-plugin'), { recursive: true });
					await writeFile(join(directory, source), bytecodeSource(chunk.code));

					for (const { version, dir } of targets) {
						if (!dir) {
							this.warn(
								`hermesc for bytecode version ${version} is unavailable, skipping it.`,
							);
							continue;
						}

						const hermesc = hermescBinary(dir);
						const output = join(directory, `${version}.hbc`);
						const compiled = await compile(hermesc, directory, source, output).catch(
							(error) => {
								this.warn(
									`hermesc ${version} could not compile ${chunk.fileName}, so that runtime loads its source: ${firstError(error)}`,
								);
							},
						);

						if (compiled) {
							const fileName = getBytecodePath(chunk.fileName, version);

							this.emitFile({ type: 'asset', fileName, source: compiled });
							emitted.set(
								chunk.fileName,
								(emitted.get(chunk.fileName) ?? new Map()).set(version, fileName),
							);
						}
					}
				}
			} finally {
				await rm(directory, { recursive: true, force: true });
			}
		},
		// Hashes the files as written, so the digests hold whatever later plugins did to the chunks.
		async writeBundle(outputOptions, bundle) {
			const directory = outputOptions.dir ?? dirname(outputOptions.file ?? '');
			const digests: BytecodeDigests = {};

			for (const chunk of Object.values(bundle)) {
				if (chunk.type !== 'chunk') {
					continue;
				}

				const bytecode: Record<string, string> = {};

				for (const [version, fileName] of emitted.get(chunk.fileName) ?? []) {
					bytecode[version] = await sha512(join(directory, fileName));
				}

				digests[chunk.fileName] = {
					sha512: await sha512(join(directory, chunk.fileName)),
					bytecode,
				};
			}

			await writeFile(
				join(directory, BYTECODE_DIGESTS_FILENAME),
				`${JSON.stringify(digests, null, '\t')}\n`,
			);
		},
	};
}

export default { bytecodeSource, hermesBytecode };
