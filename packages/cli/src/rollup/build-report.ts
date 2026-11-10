import { listAddonFiles, type AddonFileKind } from '@unbound-app/contracts/addon-files';
import { ASSETS_DIRECTORY, ASSET_TYPES } from '@unbound-app/contracts/addon-assets';
import type { OutputAsset, OutputBundle, OutputChunk, Plugin } from 'rollup';
import { readBytecodeVersion } from '@unbound-app/contracts/version-layout';
import { LOCALES_DIRECTORY } from '@unbound-app/contracts/addon-locales';
import libraries from '@unbound-app/client-build/shim-libraries.ts';
import { basename, isAbsolute, relative } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';
import { gzipSync } from 'node:zlib';

import type { BudgetName, BuildReport, ReportWarning } from './build-report-schema.ts';
import type { ReportEntry } from './report-line.ts';
import type { ByteSize } from './byte-size.ts';

import { mergeEntries, takeReportEntries } from './report-line.ts';
import { parseByteSize } from './byte-size.ts';

export type BudgetOptions = Partial<Record<BudgetName, ByteSize>>;

export type BuildReportOptions = {
	pluginRoot: string;
	budget?: BudgetOptions;
	/** Where to write the report as JSON; `ubd` sets it through {@link BUILD_REPORT_ENV}. Nothing is written without it. */
	reportFile?: string;
};

type Budgets = Record<BudgetName, number>;

/** The variable through which `ubd build` and `ubd dev` tell the preset where to write the report. */
export const BUILD_REPORT_ENV = 'UNBOUND_BUILD_REPORT';

export const DEFAULT_BUDGET = { bundle: '50kb', assets: '500kb' } satisfies Required<BudgetOptions>;

const TOP_MODULES = 5;

// A shipped folder whose files are counted with a noun, such as `i18n (2 locales)`.
const SHIPPED_UNITS: Record<string, string> = { i18n: 'locale' };

// The dist manifest fields the report reads: the version, and what `listAddonFiles` lists beside the bundle.
const manifestSchema = Type.Object({
	main: Type.String(),
	version: Type.Optional(Type.String()),
	assets: Type.Optional(
		Type.Record(
			Type.String(),
			Type.Object({
				type: Type.Union(ASSET_TYPES.map((type) => Type.Literal(type))),
				scales: Type.Record(Type.String(), Type.String()),
			}),
		),
	),
	locales: Type.Optional(Type.Record(Type.String(), Type.String())),
});

type DistManifest = Static<typeof manifestSchema>;

// Each kind of extra file is one shipped line, named after the folder it ships in.
const SHIPPED_LABELS: Record<AddonFileKind, string> = {
	asset: ASSETS_DIRECTORY,
	locale: LOCALES_DIRECTORY,
};

function sizeOf(file: OutputAsset | OutputChunk): number {
	if (file.type === 'chunk') {
		return Buffer.byteLength(file.code);
	}

	return typeof file.source === 'string'
		? Buffer.byteLength(file.source)
		: file.source.byteLength;
}

function cleanId(id: string): string {
	return id.replace(/^\0/, '').replace(/\?.*$/, '');
}

function displayId(id: string, pluginRoot: string): string {
	const path = cleanId(id);
	const nodeModules = path.lastIndexOf('/node_modules/');

	if (nodeModules !== -1) {
		return path.slice(nodeModules + 1);
	}

	return isAbsolute(path) ? relative(pluginRoot, path) : path;
}

/**
 * @description Reads the package a bundled module belongs to from its path.
 * @param id The module id.
 * @returns The package name, such as `lodash` or `@scope/name`, when the module is in `node_modules`.
 */
export function packageOf(id: string): string | undefined {
	const path = cleanId(id);
	const nodeModules = path.lastIndexOf('/node_modules/');

	if (nodeModules === -1) {
		return void 0;
	}

	const [first, second] = path.slice(nodeModules + '/node_modules/'.length).split('/');

	return first?.startsWith('@') && second ? `${first}/${second}` : first;
}

function readManifest(bundle: OutputBundle): DistManifest | undefined {
	const manifest = bundle['manifest.json'];

	if (manifest?.type !== 'asset') {
		return void 0;
	}

	// UNKNOWN: the manifest as the plugin wrote it, until the check below.
	const parsed: unknown = JSON.parse(String(manifest.source));

	return Value.Check(manifestSchema, parsed) ? parsed : void 0;
}

// The files the manifest lists beside the bundle, by `listAddonFiles` as publish and install read them, then any other emitted file.
function shippedEntries(
	bundle: OutputBundle,
	entry: OutputChunk,
	manifest: DistManifest | undefined,
): ReportEntry[] {
	const entries: ReportEntry[] = [];
	const listed = new Set<string>();

	for (const file of manifest ? listAddonFiles(manifest) : []) {
		const output = bundle[file.path];

		listed.add(file.path);

		if (!output) {
			continue;
		}

		const label = SHIPPED_LABELS[file.kind];

		entries.push({
			section: 'shipped',
			label,
			unit: SHIPPED_UNITS[label] ?? '',
			bytes: sizeOf(output),
		});
	}

	for (const file of Object.values(bundle)) {
		if (
			file === entry ||
			listed.has(file.fileName) ||
			file.fileName === 'manifest.json' ||
			readBytecodeVersion(file.fileName, entry.fileName)
		) {
			continue;
		}

		entries.push({ section: 'shipped', label: 'files', unit: '', bytes: sizeOf(file) });
	}

	return entries;
}

function bytecodeSizes(bundle: OutputBundle, entry: OutputChunk) {
	return Object.values(bundle)
		.flatMap((file) => {
			const version = readBytecodeVersion(file.fileName, entry.fileName);

			return version ? [{ version: Number(version), bytes: sizeOf(file) }] : [];
		})
		.toSorted((a, b) => a.version - b.version);
}

function shimWarnings(entry: OutputChunk, pluginRoot: string): ReportWarning[] {
	const bundled = new Map<string, string[]>();

	for (const id of Object.keys(entry.modules)) {
		const library = packageOf(id);

		if (!library || !Object.hasOwn(libraries, library)) {
			continue;
		}

		bundled.set(library, [...(bundled.get(library) ?? []), displayId(id, pluginRoot)]);
	}

	return [...bundled].map(([library, modules]) => ({ kind: 'shim', library, modules }));
}

function budgetWarnings(sizes: Budgets, budgets: Budgets): ReportWarning[] {
	return (Object.keys(budgets) as BudgetName[])
		.filter((budget) => sizes[budget] > budgets[budget])
		.map((budget) => ({
			kind: 'budget',
			budget,
			bytes: sizes[budget],
			limit: budgets[budget],
		}));
}

/**
 * @description Measures a written plugin bundle: its size, what features inlined into it, the files shipped beside it, and what breaks a budget.
 * @param bundle The output bundle, with the report entries already taken out.
 * @param entries The entries feature plugins contributed with `reportLine`.
 * @param options The plugin's directory and its budgets in bytes.
 * @returns The report, or `undefined` when the bundle has no entry chunk.
 */
export function createReport(
	bundle: OutputBundle,
	entries: ReportEntry[],
	{ pluginRoot, budgets }: { pluginRoot: string; budgets: Budgets },
): BuildReport | undefined {
	const entry = Object.values(bundle).find(
		(file): file is OutputChunk => file.type === 'chunk' && file.isEntry,
	);

	if (!entry) {
		return void 0;
	}

	const bytes = sizeOf(entry);
	const manifest = readManifest(bundle);
	const shipped = mergeEntries(
		[...shippedEntries(bundle, entry, manifest), ...entries],
		'shipped',
	);
	const assets = shipped.find((group) => group.label === 'assets')?.bytes ?? 0;
	const modules = Object.entries(entry.modules)
		.map(([id, module]) => ({ id: displayId(id, pluginRoot), bytes: module.renderedLength }))
		.toSorted((a, b) => b.bytes - a.bytes)
		.slice(0, TOP_MODULES);

	return {
		name: basename(pluginRoot),
		version: manifest?.version ?? '',
		bundle: {
			file: entry.fileName,
			bytes,
			gzip: gzipSync(entry.code).byteLength,
			bytecode: bytecodeSizes(bundle, entry),
		},
		inlined: mergeEntries(entries, 'inlined'),
		shipped,
		metro: mergeEntries(entries, 'metro'),
		modules,
		budgets,
		warnings: [
			...budgetWarnings({ bundle: bytes, assets }, budgets),
			...shimWarnings(entry, pluginRoot),
		],
	};
}

/**
 * @description Collects the entries feature plugins add with `reportLine`, keeps them out of `dist`, and writes the build report after the bundle is written.
 * @param options The plugin's directory, its budgets, and where to write the report.
 * @returns The rollup plugin. Its `generateBundle` runs last, so it sees the bytecode and every emitted file.
 */
export function buildReport({ pluginRoot, budget = {}, reportFile }: BuildReportOptions): Plugin {
	const budgets: Budgets = {
		bundle: parseByteSize(budget.bundle ?? DEFAULT_BUDGET.bundle),
		assets: parseByteSize(budget.assets ?? DEFAULT_BUDGET.assets),
	};
	let entries: ReportEntry[] = [];

	return {
		name: 'build-report',
		generateBundle: {
			order: 'post',
			handler(_options, bundle) {
				entries = takeReportEntries(bundle, (message) => this.warn(message));
			},
		},
		async writeBundle(_options, bundle) {
			if (!reportFile) return;

			const report = createReport(bundle, entries, { pluginRoot, budgets });

			if (report) {
				await writeFile(reportFile, JSON.stringify(report));
			}
		},
	};
}

export default { BUILD_REPORT_ENV, DEFAULT_BUDGET, packageOf, createReport, buildReport };
