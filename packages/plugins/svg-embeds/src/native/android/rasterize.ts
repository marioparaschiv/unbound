import type { NativeBridge } from '@unbound-app/api/native';
import { fs } from '@unbound-app/api';

import { finishSvgRender, startSvgRender, svgRenderProgress } from '~/native/android/worklets';
import type { Raster } from '~/native/ios/rasterize';
import { svgSize } from '~/lib/svg-size';

const SCREEN_SCALE = 3;
const MIN_SIDE = 160;
const MAX_SIDE = 1024;
const POLL_MS = 100;
const SETTLE_MS = 250;
const TIMEOUT_MS = 10_000;

let renders = 0;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @description Draws an SVG file as a PNG on Android, through an off-screen web view, since Android has no SVG renderer.
 * @param native The plugin's native bridge.
 * @param svgPath The absolute path of the SVG file.
 * @param pngPath The absolute path to write the PNG to.
 * @returns The picture's size in points, or `undefined` when it could not be drawn.
 */
export async function rasterizeSvgAndroid(
	native: NativeBridge,
	svgPath: string,
	pngPath: string,
): Promise<Raster | undefined> {
	const markup = await fs.readFile(svgPath.slice(fs.documentsPath.length + 1));
	const measured = svgSize(markup);
	const longest = Math.max(measured.width, measured.height);
	const zoom = Math.min(Math.max(1, MIN_SIDE / longest), MAX_SIDE / longest);
	const points = {
		width: Math.round(measured.width * zoom),
		height: Math.round(measured.height * zoom),
	};
	const pixels = { width: points.width * SCREEN_SCALE, height: points.height * SCREEN_SCALE };
	const scope = native.ui.createScope();
	const id = `svg-${++renders}`;

	try {
		if (
			!(await native.ui.call(startSvgRender, scope, id, svgPath, pixels.width, pixels.height))
		)
			return undefined;

		for (let waited = 0; waited < TIMEOUT_MS; waited += POLL_MS) {
			await wait(POLL_MS);

			if ((await native.ui.call(svgRenderProgress, scope, id)) >= 100) {
				await wait(SETTLE_MS);

				const written = await native.ui.call(
					finishSvgRender,
					scope,
					id,
					pixels.width,
					pixels.height,
					pngPath,
				);

				return written ? points : undefined;
			}
		}

		await native.ui.call(finishSvgRender, scope, id, pixels.width, pixels.height, null);

		return undefined;
	} finally {
		scope.dispose();
	}
}

export default rasterizeSvgAndroid;
