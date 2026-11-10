import { createHash } from 'node:crypto';
import { dirname } from 'node:path';

import type { ModuleEntry } from './entry-types';

import { buildRoot, buildGlobal, normalizeForHash } from './emit';
import { importGeneratedModules } from './generated-modules';
import { BANNER, GLOBAL_OUT, INTERNAL_OUT } from './config';
import { buildHoistFiles, type HoistFile } from './bundle';
import { bundleInWorkers } from './bundle-pool';
import { buildOwnership } from './ownership';
import { buildEntries } from './entries';
import { strip } from './transform';

export type GeneratedSdk = {
	/** Every generated file's text, banner included, by absolute output path. */
	files: Map<string, string>;
	/** The module entries the manifest's `exports` map is built from. */
	modules: ModuleEntry[];
};

/**
 * @description Fails when two producers claim one output path: a barrel namespace named like a
 * reserved file (`global`, a hoist file) or a duplicated subpath would silently overwrite it.
 * @param reserved Each reserved output path and the producer that owns it.
 * @param modules The module entries, each claiming its `out`.
 */
export function assertOneProducerPerOutput(reserved: Map<string, string>, modules: ModuleEntry[]) {
	const producers = new Map(reserved);

	for (const entry of modules) {
		const producer = producers.get(entry.out);

		if (producer) {
			throw new Error(
				`Module '${entry.name}' output '${entry.out}' collides with ${producer}.`,
			);
		}

		producers.set(entry.out, `module '${entry.name}'`);
	}
}

/**
 * @description Picks the hoist files to emit: `_internal` always (`global.d.ts` re-exports it), plus
 * every file a module imports from and, transitively, every file those import from.
 * @param hoistFiles Every hoist file built.
 * @param usedOwners The hoist-file paths the modules import from.
 * @returns The hoist files to emit, in their built order.
 */
export function emittedHoistFiles(hoistFiles: HoistFile[], usedOwners: Set<string>): HoistFile[] {
	const emitted = new Set<string>([INTERNAL_OUT, ...usedOwners]);

	for (let added = true; added;) {
		added = false;

		for (const file of hoistFiles) {
			if (!emitted.has(file.out)) {
				continue;
			}

			for (const dep of file.deps) {
				if (emitted.has(dep)) {
					continue;
				}

				emitted.add(dep);
				added = true;
			}
		}
	}

	return hoistFiles.filter((file) => emitted.has(file.out));
}

/**
 * @description Derives the SDK version from the client version and a hash of the files' structural
 * surface, so comment and formatting edits keep the version.
 * @param clientVersion The client manifest's version.
 * @param files The generated files' formatted text, by path.
 * @returns `<clientVersion>-<sha256>`.
 */
export function sdkVersion(clientVersion: string, files: Map<string, string>): string {
	const hash = createHash('sha256');

	for (const path of [...files.keys()].sort()) {
		hash.update(normalizeForHash(files.get(path)!));
	}

	return `${clientVersion}-${hash.digest('hex')}`;
}

/**
 * @description Builds the plugin SDK's `.d.ts` tree in memory from the client's api barrel.
 * @returns The generated files and the module entries behind them.
 */
export async function generateSdk(): Promise<GeneratedSdk> {
	const { root, modules, aliases } = buildEntries();
	const bundling = bundleInWorkers(modules.map((entry) => entry.source));
	const ownedByModule = buildOwnership(modules);
	const { files: hoistFiles, ownerByName, hoistedValues } = buildHoistFiles();

	assertOneProducerPerOutput(
		new Map([
			[GLOBAL_OUT, 'the globals file'],
			[root.out, 'the root barrel'],
			...hoistFiles.map((file) => [file.out, 'a hoist file'] as [string, string]),
		]),
		modules,
	);

	const internal = hoistFiles.find((file) => file.out === INTERNAL_OUT);

	if (!internal) {
		throw new Error(
			`The '@unbound-app/types' bundle surfaced no declarations for '${INTERNAL_OUT}'.`,
		);
	}

	const usedOwners = new Set<string>();
	const outputs = new Map<string, string>();
	const bundled = await bundling;

	for (const entry of modules) {
		// A folder module's direct children (`metro/common` under `metro`) become `export * as` imports
		// instead of inlined namespaces.
		const children = new Map<string, ModuleEntry>();

		for (const candidate of modules) {
			if (dirname(candidate.name) === entry.name) {
				children.set(candidate.name.slice(entry.name.length + 1), candidate);
			}
		}

		const stripped = strip(bundled.get(entry.source)!, {
			out: entry.out,
			children,
			ownerByName,
			usedOwners,
			owned: ownedByModule.get(entry.out) ?? new Set<string>(),
			hoistedValues,
		});

		outputs.set(entry.out, importGeneratedModules(stripped));
	}

	outputs.set(root.out, buildRoot(modules, aliases));

	for (const file of emittedHoistFiles(hoistFiles, usedOwners)) {
		outputs.set(file.out, file.text);
	}

	outputs.set(GLOBAL_OUT, buildGlobal(modules, internal.exportedNames, ownerByName, aliases));

	const files = new Map<string, string>();

	for (const [path, text] of outputs) {
		files.set(path, `${BANNER}\n\n${text.trimStart()}`);
	}

	return { files, modules };
}
