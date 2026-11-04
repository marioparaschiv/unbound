import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

import { createTempDir, type TempDir } from './ubd';

const ROLLUP_ENTRY = pathToFileURL(
	join(import.meta.dir, '..', '..', 'src', 'rollup', 'index.ts'),
).href;
const ROLLUP_BIN = require.resolve('rollup/dist/bin/rollup');

/** The build command of the fixture workspace: the rollup CLI, under Bun so the preset's TypeScript loads. */
export const FIXTURE_BUILD = `"${process.execPath}" "${ROLLUP_BIN}" -c`;

export const FIXTURE_ID = 'unbound.report-fixture';

// A feature plugin that adds lines through `reportLine` from three hooks, and ships files beside the bundle.
const featureSource = `
import { reportLine } from '${ROLLUP_ENTRY}';

export function fakeFeature() {
	return {
		name: 'fake-feature',
		transform(_code, id) {
			if (!id.endsWith('index.ts')) return null;

			this.emitFile(reportLine({ section: 'inlined', label: 'svg', unit: '', bytes: 100 }));
			this.emitFile(reportLine({ section: 'inlined', label: 'svg', unit: '', bytes: 50 }));

			return null;
		},
		renderChunk() {
			this.emitFile(reportLine({ section: 'metro', label: 'filters', tally: 'keyed' }));
			this.emitFile(reportLine({ section: 'metro', label: 'filters', tally: 'keyed' }));
			this.emitFile(
				reportLine({
					section: 'metro',
					label: 'filters',
					tally: 'uncached',
					location: 'src/index.ts:3',
					issue: 'uncached filter',
				}),
			);

			return null;
		},
		generateBundle(_options, bundle) {
			const star = 'a'.repeat(64);
			const manifest = bundle['manifest.json'];

			this.emitFile({ type: 'asset', fileName: 'i18n/fr.json', source: '{"hello":"bonjour"}' });
			this.emitFile({ type: 'asset', fileName: 'i18n/de.json', source: '{"hello":"hallo"}' });
			this.emitFile({ type: 'asset', fileName: \`assets/\${star}.png\`, source: new Uint8Array(300) });
			this.emitFile({ type: 'asset', fileName: 'index.96.hbc', source: new Uint8Array(700) });
			// The report counts what the manifest lists, as publish and install do.
			manifest.source = JSON.stringify({
				...JSON.parse(String(manifest.source)),
				assets: { star: { type: 'png', scales: { 1: star } } },
				locales: { fr: 'f'.repeat(64), de: 'd'.repeat(64) },
			});
		},
	};
}
`;

// `tinycolor2` is a client shim library; importing a file of it by path bundles it instead of using the shim.
const entrySource = `
import tinycolor from 'tinycolor2/tinycolor.js';

export function start() {
	return [tinycolor(), '${'padding '.repeat(200)}'];
}
`;

/**
 * @description Creates a workspace holding one plugin built with the Unbound preset, a fake feature plugin and a bundled shim library.
 * @param budget The `budget` option the plugin's rollup config passes.
 * @returns The workspace.
 */
export function createReportWorkspace(budget: Record<string, string> = { bundle: '1kb' }): TempDir {
	const config = `
import { unbound } from '${ROLLUP_ENTRY}';

import { fakeFeature } from './fake-feature.mjs';

const config = unbound(import.meta.url, { bytecode: false, budget: ${JSON.stringify(budget)} });

config.plugins.push(fakeFeature());

export default config;
`;

	return createTempDir({
		'unbound.config.json': JSON.stringify({
			addons: ['plugins/*'],
			build: FIXTURE_BUILD,
			output: 'dist',
		}),
		'plugins/report-fixture/manifest.json': JSON.stringify({
			id: FIXTURE_ID,
			name: 'Report Fixture',
			description: 'Measures a build.',
			authors: [{ name: 'Wumpus', id: '123456789012345678' }],
			version: '1.2.0',
			main: 'index.ts',
		}),
		'plugins/report-fixture/package.json': JSON.stringify({
			scripts: { build: FIXTURE_BUILD },
		}),
		'plugins/report-fixture/rollup.config.mjs': config,
		'plugins/report-fixture/fake-feature.mjs': featureSource,
		'plugins/report-fixture/src/index.ts': entrySource,
		'plugins/report-fixture/node_modules/tinycolor2/package.json': JSON.stringify({
			name: 'tinycolor2',
			type: 'module',
			main: 'tinycolor.js',
		}),
		'plugins/report-fixture/node_modules/tinycolor2/tinycolor.js':
			'export default function tinycolor() { return "color"; }\n',
	});
}

export default createReportWorkspace;
