import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { Plugin } from 'rollup';

import { reportProblem } from './diagnostic.ts';
import { reportLine } from './report-line.ts';
import { cleanSvg } from './svg-clean.ts';

/** An SVG whose cleaned markup passes this many bytes still inlines, with a warning that it weighs on the bundle. */
export const SVG_WARN_BYTES = 32 * 1024;

/** The module every SVG module builds its component with, once per bundle. */
export const SVG_ICON_MODULE = '\0unbound-svg-icon';

const PREFIX = '\0unbound-svg:';

/** The `ubd check` id this plugin reports under. */
export const CHECK = 'assets';

/**
 * @description The source of {@link SVG_ICON_MODULE}. `createSvgIcon(xml)` makes a component with the props of
 * Discord's own icons: `size` on their scale or in points, and `color` as a theme token or a colour, which
 * `currentColor` draws and which defaults to the theme's icon colour. `react-native-svg` and Discord's
 * `useToken` are read when a component first renders, so creating one does no lookup.
 * @returns The module's source.
 */
export function svgIconModuleSource(): string {
	return [
		"import { createElement } from 'react';",
		"import * as Svg from 'react-native-svg';",
		"import { Discord } from '@unbound-app/api/metro/components';",
		"import { Theme } from '@unbound-app/api/metro/common';",
		// Discord's icon sizes, from its `BaseIconImage`.
		'const SIZES = { xxs: 12, xs: 16, sm: 18, md: 24, lg: 32, refresh_sm: 18 };',
		'export function createSvgIcon(xml) {',
		"\treturn function SvgIcon({ size = 'md', color, width, height, ...props }) {",
		'\t\tconst token = color ?? Theme.colors.INTERACTIVE_ICON_DEFAULT;',
		'\t\tconst resolved = Discord.useToken(token);',
		"\t\tconst length = typeof size === 'number' ? size : SIZES[size];",
		"\t\tconst tint = resolved ?? (typeof token === 'string' ? token : undefined);",
		'\t\treturn createElement(',
		'\t\t\tSvg.SvgXml,',
		'\t\t\tObject.assign({}, props, { xml, width: width ?? length, height: height ?? length, color: tint }),',
		'\t\t);',
		'\t};',
		'}',
	].join('\n');
}

function svgModule(xml: string): string {
	return [
		`import { createSvgIcon } from ${JSON.stringify(SVG_ICON_MODULE)};`,
		`export default createSvgIcon(${JSON.stringify(xml)});`,
	].join('\n');
}

/**
 * @description Resolves a relative or `~/` import of an SVG to a React component drawing it with Discord's
 * `react-native-svg`, through the client's shim, with the props of Discord's icons. The cleaned markup is inlined
 * once per file contents. An SVG that is not well-formed fails the build.
 * @param pluginRoot The plugin's directory.
 * @returns The rollup plugin.
 */
export function svgImports(pluginRoot: string): Plugin {
	const paths = new Map<string, string>();
	// The cleaned markup's size per module, for the build report.
	const inlined = new Map<string, number>();

	return {
		name: 'unbound-svg-imports',
		resolveId(source, importer) {
			if (source === SVG_ICON_MODULE) {
				return source;
			}

			const local = source.startsWith('.') || source.startsWith('~/');

			if (local && source.toLowerCase().includes('.svg?')) {
				reportProblem(this, CHECK, pluginRoot, {
					file: importer ?? '',
					severity: 'error',
					message: `${source}: an SVG import takes no query. It is an icon component`,
					fix: 'pass it as IconComponent={Icon} or icon={<Icon />}',
				});
			}

			if (!local || !source.toLowerCase().endsWith('.svg')) return null;

			const path = source.startsWith('~/')
				? resolve(pluginRoot, 'src', source.slice(2))
				: resolve(importer ? dirname(importer) : pluginRoot, source);

			if (!existsSync(path)) {
				reportProblem(this, CHECK, pluginRoot, {
					file: importer ?? '',
					severity: 'error',
					message: `${source}, imported from ${importer ?? 'the entry'}, does not exist`,
				});
			}

			const digest = createHash('sha256')
				.update(readFileSync(path))
				.digest('hex')
				.slice(0, 16);
			const id = `${PREFIX}${digest}`;

			if (!paths.has(id)) {
				paths.set(id, path);
			}

			return id;
		},
		load(id) {
			if (id === SVG_ICON_MODULE) {
				return svgIconModuleSource();
			}

			const path = paths.get(id);

			if (!path) return null;

			let xml = '';

			this.addWatchFile(path);

			try {
				xml = cleanSvg(readFileSync(path, 'utf8'));
			} catch (error) {
				reportProblem(this, CHECK, pluginRoot, {
					file: path,
					severity: 'error',
					message: `${path} is not a valid SVG: ${(error as Error).message}`,
				});
			}

			if (Buffer.byteLength(xml) > SVG_WARN_BYTES) {
				reportProblem(this, CHECK, pluginRoot, {
					file: path,
					severity: 'warning',
					message: `${path} is ${Buffer.byteLength(xml)} bytes after cleaning`,
					fix: 'simplify it or export it as a PNG to keep the bundle small',
				});
			}

			inlined.set(id, Buffer.byteLength(xml));

			return svgModule(xml);
		},
		// In `transform`, so rollup's cache replays the line on a rebuild that skips this module.
		transform(_code, id) {
			const bytes = inlined.get(id);

			if (bytes === undefined) return null;

			this.emitFile(reportLine({ section: 'inlined', label: 'svg', unit: '', bytes }));

			return null;
		},
	};
}

export default { CHECK, SVG_WARN_BYTES, SVG_ICON_MODULE, svgIconModuleSource, svgImports };
