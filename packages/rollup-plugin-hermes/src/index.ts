import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

import type { ManifestContext, ManifestOptions } from './manifest';

import { hermescBinary, resolveHermesTargets } from './manifest';

export type HermesOptions = ManifestOptions & {
	/** A directory of per-platform hermesc binaries to compile with, instead of the versions on npm. */
	hermesc?: string;
	/** Extra hermesc flags, passed before the input file. */
	flags?: string[];
};

export type EmittedAsset = { type: 'asset'; fileName: string; source: string | Uint8Array };

/** The slice of a rollup or rolldown plugin context the plugin calls. */
export type HermesContext = ManifestContext & {
	info(message: string): void;
	debug(message: string): void;
	emitFile(file: EmittedAsset): string;
};

/** The slice of the output options the plugin reads. */
export type OutputOptions = { file?: string };

/** A bundle entry; chunks carry `code`, assets do not. */
export type BundleEntry = { type: string; code?: string };

export type HermesPlugin = {
	name: string;
	generateBundle(
		this: HermesContext,
		options: OutputOptions,
		bundle: Record<string, BundleEntry>,
		isWrite: boolean,
	): Promise<void>;
};

type Target = { version: number | null; dir: string | null };

type Compiled = { bytecode: Buffer; map: string | undefined };

type Exit = { code: number | null; stderr: string };

function tempFile(directory: string, extension: string): string {
	return join(directory, `${randomBytes(8).readUint32LE(0)}${extension}`);
}

async function compile(
	ctx: HermesContext,
	dir: string,
	js: string,
	flags: string[],
): Promise<Compiled | undefined> {
	const binary = hermescBinary(dir);

	if (!existsSync(binary)) {
		ctx.warn(`hermesc is unsupported on this platform or missing at ${binary}, skipping it.`);

		return undefined;
	}

	const bytecode = tempFile(dirname(js), '.bundle');
	const args = [
		'--emit-binary',
		'--out',
		bytecode,
		'-Wno-direct-eval',
		'-Wno-undefined-variable',
		...flags,
		js,
	];

	const { code, stderr } = await new Promise<Exit>((resolve, reject) => {
		const child = spawn(binary, args, { shell: true });
		let stderr = '';

		child.stdout.setEncoding('utf8');
		child.stdout.on('data', (chunk: string) => ctx.debug(chunk));

		child.stderr.setEncoding('utf8');
		child.stderr.on('data', (chunk: string) => (stderr += chunk));

		child.on('error', reject);
		child.on('close', (code) => resolve({ code, stderr }));
	});

	if (code !== 0) {
		ctx.error(
			`Failed to compile ${js} with hermesc:\n${stderr.trim() || `hermesc exited with code ${code}.`}`,
		);
	}

	if (stderr.trim()) {
		ctx.warn(stderr.trim());
	}

	const asset = await readFile(bytecode);

	await rm(bytecode, { force: true });

	const sourceMap = `${bytecode}.map`;

	if (!existsSync(sourceMap)) {
		if (flags.includes('-output-source-map')) {
			ctx.error(`hermesc was passed -output-source-map but wrote no map at ${sourceMap}.`);
		}

		return { bytecode: asset, map: undefined };
	}

	const map = await readFile(sourceMap, 'utf-8');

	await rm(sourceMap, { force: true });

	return { bytecode: asset, map };
}

type Job = { directory: string; file: string; name: string; outputFile: string; code: string };

async function compileTargets(
	ctx: HermesContext,
	targets: Target[],
	flags: string[],
	{ directory, file, name, outputFile, code }: Job,
): Promise<void> {
	const js = tempFile(directory, '.js');

	await writeFile(js, code, 'utf-8');

	for (const target of targets) {
		if (!target.dir) {
			ctx.warn(
				`hermesc for bytecode ${target.version} could not be downloaded, skipping it.`,
			);
			continue;
		}

		const fileName =
			target.version === null ? `${name}.bundle` : `${name}.${target.version}.bundle`;

		ctx.info(`${outputFile} -> ${outputFile.replace(file, fileName)}...`);

		const compiled = await compile(ctx, target.dir, js, flags);

		if (!compiled) {
			continue;
		}

		ctx.emitFile({ type: 'asset', fileName, source: compiled.bytecode });

		if (compiled.map) {
			const map = { ...JSON.parse(compiled.map), sources: [file] };

			ctx.emitFile({
				type: 'asset',
				fileName: `${fileName}.map`,
				source: JSON.stringify(map),
			});
		}

		ctx.info(`( ͡° ͜ʖ ͡°) Bytecode compiled to ${fileName}`);
	}
}

/**
 * @description Compiles the bundle's output file to Hermes bytecode, once per held hermesc version, as `<name>.<version>.bundle` beside it.
 * Each build uses its own temporary folder, so builds running side by side never delete each other's files.
 * @param options A fixed hermesc directory, or which of npm's bytecode versions to hold; plus extra hermesc flags.
 * @returns The rollup plugin, which rolldown also accepts.
 */
export default function hermes(options: HermesOptions = {}): HermesPlugin {
	let targets: Target[] | undefined;

	return {
		name: 'hermesc',

		async generateBundle(output, bundle) {
			const outputFile = output.file;
			const file = outputFile?.split('/').pop();

			if (!outputFile || !file) return;

			const chunk = bundle[file];

			if (typeof chunk?.code !== 'string') return;

			const name = file.split('.')[0] ?? file;

			targets ??= options.hermesc
				? [{ version: null, dir: options.hermesc }]
				: await resolveHermesTargets(this, options);

			const directory = await mkdtemp(join(tmpdir(), 'hermesc-'));

			try {
				await compileTargets(this, targets, options.flags ?? [], {
					directory,
					file,
					name,
					outputFile,
					code: chunk.code,
				});
			} finally {
				await rm(directory, { recursive: true, force: true });
			}
		},
	};
}
