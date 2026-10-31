import {
	docsManifestSchema,
	docsVersionSchema,
	getDocsKey,
	getDocsManifestKey,
	type DocsManifest,
	type DocsPackage,
	type DocsVersion,
} from '@unbound-app/contracts/docs';
import { Application, LogLevel, OptionDefaults, normalizePath, type TypeDocOptions } from 'typedoc';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createLogger } from '@unbound-app/logger';
import { dirname, join } from 'node:path';

import { mergeDocsManifest } from './docs-manifest';
import { API_SRC, ROOT } from './paths';

const logger = createLogger('SDK', 'Docs');

/** The gitignored tree the docs are written to; below it, paths match the public bucket keys. */
export const DOCS_OUT = join(ROOT, 'apps', 'sdk-generator', 'dist');

/** Block tags the SDK's comments use beyond TypeDoc's defaults. An unknown tag warns, which fails the run. */
export const CUSTOM_BLOCK_TAGS = ['@description'] as const;

const DOCS_PACKAGE: DocsPackage = 'api';

/** Entry points sort by rank, then by name; unlisted modules rank 1. */
const ENTRY_POINT_RANKS: Record<string, number> = { 'global.d.ts': 0, '_internal.d.ts': 2 };

const WEAK_REF_URL =
	'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/WeakRef';

export type GenerateDocsOptions = {
	/** The generated SDK tree, `packages/api/src` by default. */
	apiSrc?: string;
	/** Where `docs/<package>/` is written, {@link DOCS_OUT} by default. */
	outDir?: string;
};

export type GeneratedDocs = {
	path: string;
	manifest: DocsManifest;
};

/**
 * @description Lists the SDK's modules as TypeDoc entry points: every top-level `.d.ts` but the barrel, and
 * each directory's `index.d.ts`. `global.d.ts` comes first so the types it re-exports are documented there,
 * and `_internal.d.ts` last so it only keeps what no public module exports.
 * @param apiSrc The generated SDK tree.
 * @returns The entry point paths.
 */
export function listDocsEntryPoints(apiSrc: string): string[] {
	const files = [
		...new Bun.Glob('*.d.ts').scanSync({ cwd: apiSrc }),
		...new Bun.Glob('*/index.d.ts').scanSync({ cwd: apiSrc }),
	].filter((file) => file !== 'index.d.ts');

	const rank = (file: string) => ENTRY_POINT_RANKS[file] ?? 1;

	return files
		.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
		.map((file) => join(apiSrc, file));
}

/**
 * @description Builds the TypeDoc options for the SDK: JSON only, every warning an error.
 * @param apiSrc The generated SDK tree.
 * @returns The options.
 */
export function createDocsOptions(apiSrc: string): Partial<TypeDocOptions> {
	return {
		name: '@unbound-app/api',
		entryPoints: listDocsEntryPoints(apiSrc),
		tsconfig: join(apiSrc, '..', 'tsconfig.json'),
		blockTags: [...OptionDefaults.blockTags, ...CUSTOM_BLOCK_TAGS],
		disableSources: true,
		// `typeof import('react')` re-exports would otherwise pull all of React into the docs.
		excludeExternals: true,
		externalSymbolLinkMappings: { typescript: { WeakRef: WEAK_REF_URL } },
		// Inlined helpers the generated `.d.ts` keep file-local are referenced but never exported.
		validation: { notExported: false, invalidLink: true, rewrittenLink: true },
		treatWarningsAsErrors: true,
		logLevel: LogLevel.Warn,
	};
}

/**
 * @description Reads a docs manifest written earlier, parsing it at the boundary.
 * @param path The manifest's path.
 * @returns The manifest, or `undefined` when none exists.
 */
export function readDocsManifest(path: string): DocsManifest | undefined {
	if (!existsSync(path)) return;

	return docsManifestSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

/**
 * @description Runs TypeDoc over the generated SDK and writes `docs/api/<version>.json`, adding the version
 * to the local `docs/api/versions.json`.
 * @param version `main` or a client release tag.
 * @param options The SDK tree and output directory.
 * @returns The JSON's path and the merged manifest.
 */
export async function generateDocs(
	version: DocsVersion,
	{ apiSrc = API_SRC, outDir = DOCS_OUT }: GenerateDocsOptions = {},
): Promise<GeneratedDocs> {
	const app = await Application.bootstrap(createDocsOptions(apiSrc));
	const project = await app.convert();

	if (project) {
		app.validate(project);
	}

	const problems = app.logger.errorCount + app.logger.warningCount;

	if (!project || problems > 0) {
		throw new Error(`TypeDoc reported ${problems} problems documenting ${apiSrc}.`);
	}

	const path = join(outDir, getDocsKey(DOCS_PACKAGE, version));
	const manifestPath = join(outDir, getDocsManifestKey(DOCS_PACKAGE));
	const manifest = mergeDocsManifest(readDocsManifest(manifestPath), DOCS_PACKAGE, version);

	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(
		path,
		JSON.stringify(app.serializer.projectToObject(project, normalizePath(outDir))),
	);
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, '\t')}\n`);

	return { path, manifest };
}

if (import.meta.main) {
	const version = docsVersionSchema.parse(process.argv[2]);

	try {
		const { path } = await generateDocs(version);

		logger.success(`Wrote the ${version} docs to ${path}.`);
	} catch (error) {
		logger.error(`Failed to generate the ${version} docs:`, error);
		process.exit(1);
	}
}
