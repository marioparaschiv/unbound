import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

import {
	logger,
	API_SRC,
	INTERNAL_OUT,
	BANNER,
	ROOT,
	CLIENT,
	relativeSpecifier,
	type ModuleEntry,
} from './paths';
import { buildRoot, buildGlobal, writeManifest, normalizeForHash } from './emit';
import { buildHoistFiles, bundle } from './bundle';
import { buildOwnership } from './ownership';
import { buildEntries } from './entries';
import { strip } from './transform';

async function generate() {
	const start = performance.now();

	logger.debug('Generating plugin SDK...');

	rmSync(API_SRC, { recursive: true, force: true });
	mkdirSync(API_SRC, { recursive: true });

	const entries = buildEntries();

	const ownedByModule = buildOwnership(entries);

	const { files: hoistFiles, ownerByName } = buildHoistFiles();

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
	// ones are dropped. A hoist file that another emitted hoist file imports from is pulled in too, so
	// `_internal.d.ts`'s import of the utils names always brings `utils.d.ts` along.
	const emitted = new Set<string>([INTERNAL_OUT, ...usedOwners]);
	for (let added = true; added; ) {
		added = false;
		for (const file of hoistFiles) {
			if (!emitted.has(file.out)) continue;

			for (const other of hoistFiles) {
				if (emitted.has(other.out)) continue;
				if (!file.text.includes(`'${relativeSpecifier(file.out, other.out)}'`)) continue;

				emitted.add(other.out);
				added = true;
			}
		}
	}

	const internal = hoistFiles.find((file) => file.out === INTERNAL_OUT)!;
	for (const file of hoistFiles) {
		if (emitted.has(file.out)) outputs.set(file.out, file.text);
	}

	outputs.set(join(API_SRC, 'global.d.ts'), buildGlobal(entries, internal.names));

	for (const [path, text] of outputs) {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, `${BANNER}\n\n${text.trimStart()}`);
	}

	execSync(
		`oxfmt --config .oxfmtrc.json ${[...outputs.keys()].map((path) => `"${path}"`).join(' ')}`,
		{
			cwd: ROOT,
			stdio: 'inherit',
		},
	);

	const hash = createHash('sha256');
	for (const path of [...outputs.keys()].sort()) {
		hash.update(normalizeForHash(readFileSync(path, 'utf8')));
	}

	const clientVersion = JSON.parse(readFileSync(join(CLIENT, 'package.json'), 'utf8')).version;
	const version = `${clientVersion}-${hash.digest('hex')}`;

	writeManifest(version, entries);

	execSync(`oxfmt --config .oxfmtrc.json "${join(ROOT, 'packages', 'api', 'package.json')}"`, {
		cwd: ROOT,
		stdio: 'inherit',
	});

	const duration = (performance.now() - start).toFixed(2);

	logger.success(`Generated plugin SDK v${version} in ${duration}ms`);
}

if (import.meta.main) {
	generate().catch((error) => {
		logger.error('Failed to generate plugin SDK:', error);
		process.exit(1);
	});
}
