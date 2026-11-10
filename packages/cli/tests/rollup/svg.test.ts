import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { AddonAsset } from '@unbound-app/types/addons';
import type { OutputAsset, RollupLog } from 'rollup';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { rollup } from 'rollup';

import { SVG_WARN_BYTES } from '../src/rollup/svg-assets';
import { cleanSvg } from '../src/rollup/svg-clean';
import { unbound } from '../src/rollup/preset';

type Built = {
	code: string;
	manifest: { assets?: Record<string, AddonAsset> };
	files: number;
	warnings: string[];
};

type Token = { token: string };

type Props = Record<string, string | number | Token>;

type Element = { type: () => null; props: Props };

type Component = (props: Props) => Element | null;

// What a recorded stand-in holds: react-native-svg's `SvgXml`, Discord's design module or its theme.
type StandIn = {
	SvgXml?: () => null;
	Discord?: { useToken: (color: Token | string) => string | null };
	Theme?: { colors: Record<string, Token> };
};

type Runtime = {
	reads: string[];
	SvgXml: () => null;
	plugin: { start: () => Component[] };
};

const STAR = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<!-- Exported by an editor -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     width="24" height="24" viewBox="0 0 24 24" inkscape:version="1.3">
	<metadata><rdf>editor data</rdf></metadata>
	<sodipodi:namedview id="view"/>
	<path d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 16.5 5.5 21l2-7.5L2 9h7z" fill="#F5C518"/>
</svg>
`;

const CLEAN_STAR =
	'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" color="#f5c518"><path d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 16.5 5.5 21l2-7.5L2 9h7z" fill="currentColor"/></svg>';

const ICON_DEFAULT: Token = { token: 'INTERACTIVE_ICON_DEFAULT' };
const TEXT_LINK: Token = { token: 'TEXT_LINK' };

let pluginRoot = '';

beforeEach(async () => {
	pluginRoot = await mkdtemp(join(tmpdir(), 'rollup-svg-'));
	await mkdir(join(pluginRoot, 'src'));
	await writeFile(join(pluginRoot, 'manifest.json'), '{"id":"svg.test","main":"index.ts"}');
});

afterEach(async () => {
	await rm(pluginRoot, { recursive: true, force: true });
});

async function file(path: string, text: string) {
	await mkdir(dirname(join(pluginRoot, path)), { recursive: true });
	await writeFile(join(pluginRoot, path), text);
}

async function build(entry: string): Promise<Built> {
	await writeFile(join(pluginRoot, 'src', 'index.ts'), entry);

	const warnings: string[] = [];
	const { output: outputOptions, ...config } = unbound(
		pathToFileURL(join(pluginRoot, 'rollup.config.mjs')).href,
		{ bytecode: false },
	);
	const bundle = await rollup({
		...config,
		onwarn: (warning: RollupLog) => void warnings.push(warning.message),
	});
	const { output } = await bundle.generate(
		Array.isArray(outputOptions) ? {} : (outputOptions ?? {}),
	);

	await bundle.close();

	const assets = output.filter((out): out is OutputAsset => out.type === 'asset');
	const manifest = assets.find((out) => out.fileName === 'manifest.json');

	return {
		code: output[0].code,
		manifest: JSON.parse(String(manifest?.source)),
		files: assets.length - 1,
		warnings,
	};
}

// Runs the bundle with stand-ins that record every read of react-native-svg and Discord's design module,
// as the client's lazy lookups would search on them.
function run(code: string): Runtime {
	const reads: string[] = [];
	const SvgXml = () => null;

	function record<T extends StandIn>(name: string, value: T): T {
		return new Proxy(value, {
			get: (target, key) => {
				reads.push(`${name}.${String(key)}`);

				return Reflect.get(target, key);
			},
		});
	}
	const React = {
		createElement: (type: () => null, props: Props): Element => ({ type, props }),
	};
	const unbound = {
		shims: { libraries: { 'react-native-svg': record('svg', { SvgXml }) } },
		metro: {
			components: record('components', {
				Discord: {
					// Discord's `useToken` resolves a theme token, and gives `null` for a plain colour.
					useToken: (color: Token | string) =>
						typeof color === 'string' ? null : `resolved ${color.token}`,
				},
			}),
			common: record('common', {
				Theme: { colors: { INTERACTIVE_ICON_DEFAULT: ICON_DEFAULT } },
			}),
		},
	};
	const plugin = runInNewContext(`(${code})`, { unbound, React }).__load();

	return { reads, SvgXml, plugin };
}

async function star(): Promise<Runtime & { component: Component }> {
	await file('assets/star.svg', STAR);

	const built = await build(
		"import Star from '../assets/star.svg'; export function start() { return [Star]; }",
	);
	const runtime = run(built.code);
	const [component] = runtime.plugin.start();

	if (!component) {
		throw new Error('The bundle exported no component.');
	}

	return { ...runtime, component };
}

describe('svg imports', () => {
	test('a default import is a component, which reads react-native-svg and the theme only when it renders', async () => {
		const { reads, SvgXml, component } = await star();

		expect(reads).toEqual([]);

		const element = component({});

		expect(element?.type).toBe(SvgXml);
		expect(reads).toContain('svg.SvgXml');
		expect(reads).toContain('components.Discord');
	});

	test("draws the cleaned XML at Discord's default icon size, in the theme's icon colour", async () => {
		const { component } = await star();

		expect(component({})?.props).toEqual({
			xml: CLEAN_STAR,
			width: 24,
			height: 24,
			color: 'resolved INTERACTIVE_ICON_DEFAULT',
		});
	});

	test("sizes like Discord's icons: its scale, points, or an explicit width and height", async () => {
		const { component } = await star();

		function size(props: Props) {
			const rendered = component(props)?.props;

			return [rendered?.width, rendered?.height];
		}

		expect(size({ size: 'xxs' })).toEqual([12, 12]);
		expect(size({ size: 'xs' })).toEqual([16, 16]);
		expect(size({ size: 'sm' })).toEqual([18, 18]);
		expect(size({ size: 'lg' })).toEqual([32, 32]);
		expect(size({ size: 20 })).toEqual([20, 20]);
		expect(size({ size: 'custom' })).toEqual([undefined, undefined]);
		expect(size({ width: 40, height: 10 })).toEqual([40, 10]);
	});

	test('tints with a theme token through useToken, or with a plain colour as given', async () => {
		const { component } = await star();

		expect(component({ color: TEXT_LINK })?.props.color).toBe('resolved TEXT_LINK');
		expect(component({ color: '#ed4245' })?.props.color).toBe('#ed4245');
	});

	test('bundles no react-native-svg code and ships no file', async () => {
		await file('src/star.svg', STAR);

		const built = await build(
			"import Star from './star.svg'; export function start() { return [Star]; }",
		);

		expect(built.code).toContain('unbound.shims.libraries["react-native-svg"]');
		expect(built.code).not.toContain('RNSVG');
		expect(built.code.length).toBeLessThan(2_500);
		expect(built.files).toBe(0);
		expect(built.manifest.assets).toBeUndefined();
	});

	test('two imports of equal files share one module', async () => {
		await file('assets/a.svg', STAR);
		await file('src/b.svg', STAR);

		const built = await build(
			"import A from '../assets/a.svg'; import B from './b.svg'; export function start() { return [A, B]; }",
		);
		const [a, b] = run(built.code).plugin.start();

		expect(a).toBe(b);
		expect(built.code.split('M12 2l3 7h7').length).toBe(2);
	});

	test(`warns about an SVG over ${SVG_WARN_BYTES} bytes, and still inlines it`, async () => {
		const dots = Array.from(
			{ length: 1200 },
			(_, index) => `<circle cx="${index}" cy="${index}" r="1"/>`,
		).join('');

		await file('assets/big.svg', `<svg xmlns="http://www.w3.org/2000/svg">${dots}</svg>`);

		const built = await build(
			"import Big from '../assets/big.svg'; export function start() { return [Big]; }",
		);

		expect(built.warnings.join('\n')).toContain('big.svg is');
		expect(built.code).toContain('cx="1199"');
	});

	test('an SVG import with a query, such as the old ?asset, fails the build and names the component props', async () => {
		await file('src/star.svg', STAR);

		expect(
			build(
				"import star from './star.svg?asset'; export function start() { return [star]; }",
			),
		).rejects.toThrow('pass it as IconComponent={Icon} or icon={<Icon />}');
	});

	test('an SVG that is not well-formed fails the build, naming the file and why', async () => {
		await file(
			'src/broken.svg',
			'<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"></svg>',
		);

		expect(
			build(
				"import Broken from './broken.svg'; export function start() { return [Broken]; }",
			),
		).rejects.toThrow(/broken\.svg is not a valid SVG: <\/svg> closes <path> at line 1/);
	});
});

describe('cleanSvg', () => {
	test('a shape with the default fill tints through currentColor, keeping black until a color is set', () => {
		expect(cleanSvg('<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>')).toBe(
			'<svg viewBox="0 0 1 1" fill="currentColor" color="#000000"><path d="M0 0"/></svg>',
		);
	});

	test('an SVG in two colours, or with a gradient, is left alone', () => {
		const two = '<svg><path d="M0 0" fill="#f00"/><path d="M1 1" fill="#00f"/></svg>';
		const gradient =
			'<svg><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs><path d="M0 0" fill="url(#g)"/></svg>';

		expect(cleanSvg(two)).toBe(two);
		expect(cleanSvg(gradient)).toBe(gradient);
	});

	test('one colour used for fill, stroke and a style counts as one', () => {
		expect(
			cleanSvg(
				'<svg><path d="M0 0" fill="#F00" stroke="red"/><path d="M1 1" style="fill: #ff0000"/></svg>',
			),
		).toBe(
			'<svg><path d="M0 0" fill="#F00" stroke="red"/><path d="M1 1" style="fill: #ff0000"/></svg>',
		);
		expect(
			cleanSvg(
				'<svg><path d="M0 0" fill="#F00" stroke="#f00"/><path d="M1 1" style="fill: #ff0000"/></svg>',
			),
		).toBe(
			'<svg color="#ff0000"><path d="M0 0" fill="currentColor" stroke="currentColor"/><path d="M1 1" style="fill:currentColor"/></svg>',
		);
	});

	test('keeps whitespace inside text and entity references', () => {
		expect(cleanSvg('<svg> <text fill="#000">a &amp; <tspan>b</tspan></text> </svg>')).toBe(
			'<svg color="#000000"><text fill="currentColor">a &amp; <tspan>b</tspan></text></svg>',
		);
	});

	test('names the first well-formedness error', () => {
		expect(() => cleanSvg('<svg a="1" a="2"/>')).toThrow('duplicate attribute a at line 1');
		expect(() => cleanSvg('<svg>&nbsp</svg>')).toThrow('"&" that starts no entity reference');
		expect(() => cleanSvg('<svg><g></svg>')).toThrow('</svg> closes <g>');
		expect(() => cleanSvg('<html/>')).toThrow('its root element is <html>, not <svg>');
		expect(() => cleanSvg('<svg/><svg/>')).toThrow('content after the root element');
	});
});
