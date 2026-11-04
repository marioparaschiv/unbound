import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { join, resolve } from 'node:path';

import { pluginIcon, readPluginManifests } from './plugin-manifests';
import { PLUGIN_ICONS_DIR, PLUGINS_DIR, REPO_ROOT } from './paths';

const FONTS_DIR = resolve(REPO_ROOT, 'apps/devtools/crates/app/assets/fonts');
const FONT_FILES = ['Inter-Medium.ttf', 'Inter-SemiBold.ttf'].map((name) => join(FONTS_DIR, name));

const BANNER_WIDTH = 1200;
const BANNER_HEIGHT = 400;
const BANNER_PATH = 'media/banner.png';
const MARKER_KEYWORD = 'Software';
const MARKER_VALUE = 'unbound generate-plugin-banners';
const FONT_STACK = 'Inter, sans-serif';
const TEXT_X = 310;
const TEXT_WIDTH = 800;
const NAME_SIZE = 64;
const DESCRIPTION_SIZE = 28;
const DESCRIPTION_LINES = 3;
const AVERAGE_GLYPH_WIDTH = 0.56;

const PNG_SIGNATURE_LENGTH = 8;
const PNG_IHDR_END = PNG_SIGNATURE_LENGTH + 4 + 4 + 13 + 4;

type BannerContent = {
	name: string;
	description: string;
	iconBase64: string;
};

function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

/**
 * @description Wraps text into at most `maxLines` lines of `limit` characters, ending the last line with an ellipsis when text is cut.
 * @param value The text to wrap.
 * @param limit The most characters per line.
 * @param maxLines The most lines to return.
 * @returns The wrapped lines.
 */
export function wrapLines(value: string, limit: number, maxLines: number): string[] {
	const lines: string[] = [];
	let line = '';

	for (const word of value.split(/\s+/).filter(Boolean)) {
		const candidate = line ? `${line} ${word}` : word;

		if (candidate.length > limit && line) {
			lines.push(line);
			line = word;
			continue;
		}

		line = candidate;
	}

	if (line) lines.push(line);
	if (lines.length <= maxLines) return lines;

	const kept = lines.slice(0, maxLines);
	const last = kept[maxLines - 1];
	kept[maxLines - 1] = `${last.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
	return kept;
}

/**
 * @description Builds the 1200x400 banner SVG: a Discord-dark card with the plugin icon, name and description.
 * @param content The plugin's display name, description, and base64 PNG icon.
 * @returns The SVG markup.
 */
export function bannerSvg({ name, description, iconBase64 }: BannerContent): string {
	const descriptionLimit = Math.floor(TEXT_WIDTH / (DESCRIPTION_SIZE * AVERAGE_GLYPH_WIDTH));
	const nameSize = Math.min(
		NAME_SIZE,
		Math.floor(TEXT_WIDTH / (name.length * AVERAGE_GLYPH_WIDTH)),
	);
	const lines = wrapLines(description, descriptionLimit, DESCRIPTION_LINES);
	const lineHeight = DESCRIPTION_SIZE * 1.4;
	const blockHeight = NAME_SIZE + 24 + lines.length * lineHeight;
	const top = (BANNER_HEIGHT - blockHeight) / 2;
	const nameBaseline = top + NAME_SIZE * 0.8;
	const descriptionTop = top + NAME_SIZE + 24;

	const descriptionMarkup = lines.map(
		(line, index) =>
			`<text x="${TEXT_X}" y="${descriptionTop + index * lineHeight + DESCRIPTION_SIZE}" fill="#b5bac1" font-family="${FONT_STACK}" font-size="${DESCRIPTION_SIZE}" font-weight="500">${escapeXml(line)}</text>`,
	);

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" viewBox="0 0 ${BANNER_WIDTH} ${BANNER_HEIGHT}">`,
		`<defs><radialGradient id="glow" cx="0.2" cy="0.5" r="0.7"><stop offset="0" stop-color="#5865f2" stop-opacity="0.28"/><stop offset="1" stop-color="#5865f2" stop-opacity="0"/></radialGradient></defs>`,
		`<rect width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" fill="#121316"/>`,
		`<rect width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" fill="url(#glow)"/>`,
		`<rect x="60" y="100" width="200" height="200" rx="44" fill="#1e1f22" stroke="#2a2d33" stroke-width="2"/>`,
		`<image x="100" y="140" width="120" height="120" xlink:href="data:image/png;base64,${iconBase64}"/>`,
		`<text x="${TEXT_X}" y="${nameBaseline}" fill="#f5f5f7" font-family="${FONT_STACK}" font-size="${nameSize}" font-weight="600">${escapeXml(name)}</text>`,
		...descriptionMarkup,
		`<rect x="0" y="${BANNER_HEIGHT - 6}" width="${BANNER_WIDTH}" height="6" fill="#5865f2"/>`,
		`</svg>`,
	].join('\n');
}

function crc32(bytes: Uint8Array): number {
	return Bun.hash.crc32(bytes);
}

function textChunk(keyword: string, value: string): Uint8Array {
	const body = new TextEncoder().encode(`${keyword}\0${value}`);
	const chunk = new Uint8Array(12 + body.length);
	const view = new DataView(chunk.buffer);

	view.setUint32(0, body.length);
	chunk.set(new TextEncoder().encode('tEXt'), 4);
	chunk.set(body, 8);
	view.setUint32(8 + body.length, crc32(chunk.subarray(4, 8 + body.length)));
	return chunk;
}

/**
 * @description Inserts the generator's tEXt marker chunk right after a PNG's IHDR.
 * @param png The PNG bytes.
 * @returns The PNG with the marker.
 */
export function markGenerated(png: Uint8Array): Uint8Array {
	const chunk = textChunk(MARKER_KEYWORD, MARKER_VALUE);
	const marked = new Uint8Array(png.length + chunk.length);

	marked.set(png.subarray(0, PNG_IHDR_END));
	marked.set(chunk, PNG_IHDR_END);
	marked.set(png.subarray(PNG_IHDR_END), PNG_IHDR_END + chunk.length);
	return marked;
}

/**
 * @description Tells whether a PNG carries the generator's marker chunk.
 * @param png The PNG bytes.
 * @returns True when the generator produced it.
 */
export function isGeneratedBanner(png: Uint8Array): boolean {
	const marker = textChunk(MARKER_KEYWORD, MARKER_VALUE);
	return Buffer.from(png.subarray(PNG_IHDR_END, PNG_IHDR_END + marker.length)).equals(marker);
}

/**
 * @description Adds `banner: media/banner.png` frontmatter to an ADDON.md that has none, leaving the body as is.
 * @param source The ADDON.md text.
 * @returns The text with the frontmatter, or the same text when it already starts with frontmatter.
 */
export function withBannerFrontmatter(source: string): string {
	if (source.startsWith('---')) return source;
	return `---\nbanner: ${BANNER_PATH}\n---\n\n${source}`;
}

/**
 * @description Renders a banner SVG to a marked 1200x400 PNG.
 * @param svg The banner SVG.
 * @returns The PNG bytes.
 */
export function renderBanner(svg: string): Uint8Array {
	const resvg = new Resvg(svg, {
		fitTo: { mode: 'width', value: BANNER_WIDTH },
		font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Inter' },
	});

	return markGenerated(resvg.render().asPng());
}

function main(): void {
	let written = 0;
	let kept = 0;

	for (const { folder, manifest } of readPluginManifests(PLUGINS_DIR)) {
		const directory = join(PLUGINS_DIR, folder);
		const bannerPath = join(directory, BANNER_PATH);

		if (existsSync(bannerPath) && !isGeneratedBanner(readFileSync(bannerPath))) {
			kept++;
		} else {
			const iconBase64 = readFileSync(
				join(PLUGIN_ICONS_DIR, `${pluginIcon(manifest)}.png`),
			).toString('base64');
			const svg = bannerSvg({
				name: manifest.name,
				description: manifest.description,
				iconBase64,
			});

			mkdirSync(join(directory, 'media'), { recursive: true });
			writeFileSync(bannerPath, renderBanner(svg));
			written++;
		}

		const pagePath = join(directory, 'ADDON.md');
		if (!existsSync(pagePath)) continue;

		const page = readFileSync(pagePath, 'utf8');
		const updated = withBannerFrontmatter(page);
		if (updated !== page) writeFileSync(pagePath, updated);
	}

	console.log(`Banners: ${written} generated, ${kept} hand-made kept.`);
}

if (import.meta.main) main();
