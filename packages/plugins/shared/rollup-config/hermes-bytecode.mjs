import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import hermesManifest from '@unbound-app/rollup-plugin-hermes/dist/manifest.js';

const run = promisify(execFile);
const { resolveHermesTargets } = hermesManifest;

/**
 * Wraps a plugin bundle the way the client evaluates its source, so the compiled program's completion value is the same factory.
 * @param code The plugin's final bundle expression.
 */
export function bytecodeSource(code) {
	return `((React) => { return ${code} })`;
}

/**
 * Names the compiled bundle beside a source bundle, matching the loader's lookup.
 * @param fileName The source bundle's file name, such as `index.js`.
 * @param version The Hermes bytecode version.
 */
export function bytecodeFileName(fileName, version) {
	return `${fileName.replace(/\.[^.]+$/, '')}.${version}.hbc`;
}

function firstError(error) {
	const output = String(error?.stderr ?? error?.message ?? error);

	return (
		output
			.split('\n')
			.find((line) => line.includes('error:'))
			?.trim() ?? output.trim()
	);
}

async function compile(hermesc, source, output) {
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
 * Compiles each plugin bundle to Hermes bytecode for the newest bytecode versions the client supports.
 * @param {{ versions: number }} options How many of the newest bytecode versions to compile for.
 */
export function hermesBytecode({ versions }) {
	let targets;

	return {
		name: 'hermes-bytecode',
		async generateBundle(_outputOptions, bundle) {
			targets ??= await resolveHermesTargets(this, { versions });
			const executable = process.platform === 'win32' ? 'hermesc.exe' : 'hermesc';
			const directory = await mkdtemp(join(tmpdir(), 'plugin-bytecode-'));

			try {
				for (const chunk of Object.values(bundle)) {
					if (chunk.type !== 'chunk') continue;

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
