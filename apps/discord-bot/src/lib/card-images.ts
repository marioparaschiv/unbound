import type { PublicGalleryImage } from '@unbound-app/web/bot';
import { createLogger } from '@unbound-app/logger';
import sharp from 'sharp';

const logger = createLogger('Bot', 'CardImages');

// The strip is laid out at screenshot height, then scaled to the width Discord shows sharply.
const WIDTH = 1600;
const SHOT_HEIGHT = 900;
const PER_ROW = 4;
const RADIUS = 14;
const GAP = 36;
const PAD = 64;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 10 * 1024 * 1024;

const BACKGROUND = '#09090b';
const BRAND = '#c84151';
const TILE = 256;
const TILE_ICON = 150;
const AVATAR = 128;

/** A screenshot scaled to the strip's height, ready to place. */
type Shot = { png: Buffer; width: number };

async function download(url: string): Promise<Buffer> {
	const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`);
	}

	const bytes = await response.arrayBuffer();

	if (bytes.byteLength > MAX_BYTES) {
		throw new Error(`${bytes.byteLength} bytes is over the ${MAX_BYTES} byte limit`);
	}

	return Buffer.from(bytes);
}

function roundedMask(width: number, height: number, radius: number) {
	return Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" fill="#fff"/></svg>`,
	);
}

// A faint outline keeps a dark screenshot from melting into the dark backdrop.
function outline(width: number, height: number) {
	return Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}" rx="${RADIUS}" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="3"/></svg>`,
	);
}

async function toShot(image: PublicGalleryImage): Promise<Shot> {
	const width = Math.round((image.width / image.height) * SHOT_HEIGHT);
	const scaled = await sharp(await download(image.url), { animated: false })
		.resize({ width, height: SHOT_HEIGHT, fit: 'cover' })
		.png()
		.toBuffer();
	const png = await sharp(scaled)
		.composite([
			{ input: roundedMask(width, SHOT_HEIGHT, RADIUS), blend: 'dest-in' },
			{ input: outline(width, SHOT_HEIGHT) },
		])
		.png()
		.toBuffer();

	return { png, width };
}

// The website's `.dotted-bg`: a 16px grid of 1.6px grey dots turned 35°, fading toward the bottom.
function dottedBackground(width: number, height: number, scale: number) {
	const spacing = 16 * scale;
	const dot = spacing * 0.75;

	return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
	<defs>
		<pattern id="d" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
			<circle cx="${dot}" cy="${dot}" r="${1.6 * scale}" fill="hsl(0, 0%, 35%)"/>
		</pattern>
		<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#fff"/>
			<stop offset="1" stop-color="#fff" stop-opacity="0.3"/>
		</linearGradient>
		<mask id="m"><rect width="100%" height="100%" fill="url(#g)"/></mask>
	</defs>
	<rect width="100%" height="100%" fill="${BACKGROUND}"/>
	<rect width="100%" height="100%" fill="url(#d)" fill-opacity="0.25" mask="url(#m)"/>
</svg>`);
}

/**
 * @description Stitches an addon's gallery into centred rows of four on the website's dotted backdrop.
 * @param gallery The store page's gallery, in page order.
 * @param id The addon id, for the log.
 * @returns The PNG, or `undefined` when there is nothing to show or no image loaded.
 */
export async function renderGallery(
	gallery: readonly PublicGalleryImage[],
	id: string,
): Promise<Buffer | undefined> {
	const settled = await Promise.allSettled(gallery.map(toShot));
	const shots: Shot[] = [];

	for (const [index, result] of settled.entries()) {
		if (result.status === 'fulfilled') {
			shots.push(result.value);
		} else {
			logger.warn(
				`Failed to load gallery image ${gallery[index]?.url} of addon ${id}:`,
				result.reason,
			);
		}
	}

	if (shots.length === 0) return;

	// Rows of PER_ROW, each centred, so a short last row sits in the middle under the full ones.
	const rows = Array.from({ length: Math.ceil(shots.length / PER_ROW) }, (_, index) =>
		shots.slice(index * PER_ROW, (index + 1) * PER_ROW),
	);
	const rowWidth = (row: Shot[]) =>
		row.reduce((sum, shot) => sum + shot.width, 0) + GAP * (row.length - 1);
	const content = Math.max(...rows.map(rowWidth));
	const width = content + PAD * 2;
	const height = rows.length * SHOT_HEIGHT + GAP * (rows.length - 1) + PAD * 2;
	// Dots are drawn at the size they end up after the final scale to WIDTH, as on the site.
	const scale = Math.max(1, width / WIDTH);
	const layers = rows.flatMap((row, index) => {
		const top = PAD + index * (SHOT_HEIGHT + GAP);
		let left = PAD + Math.round((content - rowWidth(row)) / 2);

		return row.map((shot) => {
			const layer = { input: shot.png, left, top };

			left += shot.width + GAP;

			return layer;
		});
	});

	// sharp resizes before it composites, so the strip is flattened first and scaled in a second pass.
	const strip = await sharp(dottedBackground(width, height, scale))
		.composite(layers)
		.png()
		.toBuffer();

	return sharp(strip)
		.resize({ width: Math.min(width, WIDTH) })
		.png()
		.toBuffer();
}

/**
 * @description Draws an addon's website icon in white on a brand-red rounded tile.
 * @param svg The icon's `<svg>` markup, drawn in `currentColor`.
 * @returns The PNG tile.
 */
export function renderIconTile(svg: string): Promise<Buffer> {
	const offset = (TILE - TILE_ICON) / 2;
	const icon = svg
		.replaceAll('currentColor', '#fff')
		.replace(/<svg\b/, `<svg x="${offset}" y="${offset}"`)
		.replace(/\swidth="[^"]*"/, ` width="${TILE_ICON}"`)
		.replace(/\sheight="[^"]*"/, ` height="${TILE_ICON}"`);
	const tile = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}"><rect width="${TILE}" height="${TILE}" rx="56" fill="${BRAND}"/>${icon}</svg>`;

	return sharp(Buffer.from(tile)).png().toBuffer();
}

/**
 * @description Downloads an avatar and cuts it into a circle.
 * @param url The avatar's URL.
 * @returns The round PNG.
 */
export async function renderRoundAvatar(url: string): Promise<Buffer> {
	const square = await sharp(await download(url), { animated: false })
		.resize({ width: AVATAR, height: AVATAR, fit: 'cover' })
		.png()
		.toBuffer();

	return sharp(square)
		.composite([{ input: roundedMask(AVATAR, AVATAR, AVATAR / 2), blend: 'dest-in' }])
		.png()
		.toBuffer();
}

export default { renderGallery, renderIconTile, renderRoundAvatar };
