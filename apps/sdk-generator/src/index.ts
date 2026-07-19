import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

import {
	logger,
	API_SRC,
	INTERNAL_OUT,
	BANNER,
	ROOT,
	CLIENT,
	readJson,
	type ModuleEntry,
} from './paths';
import { buildRoot, buildGlobal, writeManifest, normalizeForHash } from './emit';
import { buildHoistFiles, bundle } from './bundle';
import { buildOwnership } from './ownership';
import { buildEntries } from './entries';
import { strip } from './transform';

function format(paths: string[]) {
	execFileSync('oxfmt', ['--config', '.oxfmtrc.json', ...paths], { cwd: ROOT, stdio: 'inherit' });
}

/**
 * @description Applies oxlint's autofixes to the generated files (import/export ordering the emitters
 * leave for the linter to own), then verifies the result lints clean. The fix pass exits non-zero when
 * it reports the violations it just fixed, so it is run tolerantly; the follow-up check must pass, and
 * throws otherwise, so any unfixable violation still fails generation.
 * @param paths The absolute file paths to lint.
 */
function lint(paths: string[]) {
	try {
		execFileSync('oxlint', ['--config', '.oxlintrc.json', '--fix-dangerously', ...paths], {
			cwd: ROOT,
			stdio: 'inherit',
		});
	} catch {
		// Non-zero here means oxlint reported the violations it just autofixed; the check below is the
		// gate that fails generation on anything left unfixed.
	}

	execFileSync('oxlint', ['--config', '.oxlintrc.json', ...paths], {
		cwd: ROOT,
		stdio: 'inherit',
	});
}

async function generate() {
	const start = performance.now();

	logger.debug('Generating plugin SDK...');

	rmSync(API_SRC, { recursive: true, force: true });
	mkdirSync(API_SRC, { recursive: true });

	const entries = buildEntries();

	const ownedByModule = buildOwnership(entries);

	const { files: hoistFiles, ownerByName } = buildHoistFiles();

	// Every output path must have exactly one producer; a barrel namespace named like a reserved
	// file (`global`, a hoist file) or a duplicated additional subpath would silently overwrite it.
	const producers = new Map<string, string>([
		[join(API_SRC, 'global.d.ts'), 'the globals file'],
		...hoistFiles.map((file) => [file.out, 'a hoist file'] as [string, string]),
	]);

	for (const entry of entries) {
		const producer = producers.get(entry.out);
		if (producer) {
			throw new Error(
				`Module '${entry.name}' output '${entry.out}' collides with ${producer}.`,
			);
		}

		producers.set(entry.out, `module '${entry.name}'`);
	}

	const internal = hoistFiles.find((file) => file.out === INTERNAL_OUT);
	if (!internal) {
		throw new Error(
			`The '@unbound-app/types' bundle surfaced no declarations for '${INTERNAL_OUT}'.`,
		);
	}

	const usedOwners = new Set<string>();
	const outputs = new Map<string, string>();

	for (const entry of entries) {
		if (entry.name === '.') continue;

		// A folder module's direct children (`metro/common` under `metro`) become `export * as` imports
		// instead of inlined namespaces.
		const children = new Map<string, ModuleEntry>();
		for (const candidate of entries) {
			if (dirname(candidate.name) === entry.name) {
				children.set(candidate.name.slice(entry.name.length + 1), candidate);
			}
		}

		outputs.set(
			entry.out,
			strip(
				bundle(entry.source),
				entry.out,
				children,
				ownerByName,
				usedOwners,
				ownedByModule.get(entry.out) ?? new Set<string>(),
			),
		);
	}

	const root = entries.find((entry) => entry.name === '.')!;
	outputs.set(root.out, buildRoot(entries));

	// The `_internal` file is always emitted (`global.d.ts` re-exports it); any other hoist file
	// (including `utils.d.ts`) is kept only when a module actually imports from it, so unreferenced
	// ones are dropped. A hoist file another emitted hoist file imports from is pulled in through its
	// structural deps, so `_internal.d.ts`'s import of the utils names always brings `utils.d.ts` along.
	const emitted = new Set<string>([INTERNAL_OUT, ...usedOwners]);
	for (let added = true; added; ) {
		added = false;
		for (const file of hoistFiles) {
			if (!emitted.has(file.out)) continue;

			for (const dep of file.deps) {
				if (emitted.has(dep)) continue;

				emitted.add(dep);
				added = true;
			}
		}
	}

	for (const file of hoistFiles) {
		if (emitted.has(file.out)) outputs.set(file.out, file.text);
	}

	outputs.set(
		join(API_SRC, 'global.d.ts'),
		buildGlobal(entries, internal.exportedNames, ownerByName),
	);

	for (const [path, text] of outputs) {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, `${BANNER}\n\n${text.trimStart()}`);
	}

	const paths = [...outputs.keys()];

	// Lint then format so import/export ordering and any autofixable violations land in the hashed
	// output, matching how the rest of the repo is linted then formatted.
	lint(paths);
	format(paths);

	const hash = createHash('sha256');
	for (const path of [...outputs.keys()].sort()) {
		hash.update(normalizeForHash(readFileSync(path, 'utf8')));
	}

	const clientVersion = readJson(join(CLIENT, 'package.json')).version;
	if (typeof clientVersion !== 'string' || clientVersion.length === 0) {
		throw new Error(`The client manifest at '${join(CLIENT, 'package.json')}' has no version.`);
	}

	const version = `${clientVersion}-${hash.digest('hex')}`;

	writeManifest(version, entries);

	format([join(ROOT, 'packages', 'api', 'package.json')]);

	const duration = (performance.now() - start).toFixed(2);

	logger.success(`Generated plugin SDK v${version} in ${duration}ms`);
}

if (import.meta.main) {
	generate().catch((error) => {
		logger.error('Failed to generate plugin SDK:', error);
		process.exit(1);
	});
}
