import type { NativeBridge } from '@unbound-app/api/native';
import { fs } from '@unbound-app/api';

import { rasterizeSvg } from '~/native/rasterize';
import { SVG_FOLDER } from '~/lib/folder';

const SAMPLE =
	'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32" viewBox="0 0 64 32"><rect width="64" height="32" rx="8" fill="#5865f2"/></svg>';

/**
 * @description Draws a small built-in SVG the way chat SVGs are drawn, and reports whether a picture came out.
 * @param native The plugin's native bridge.
 * @returns The self-test result.
 */
export async function selfTestRaster(
	native: NativeBridge,
): Promise<{ ok: boolean; detail: string }> {
	await fs.writeFile(`${SVG_FOLDER}/self-test.svg`, SAMPLE);

	const raster = await rasterizeSvg(
		native,
		`${fs.documentsPath}/${SVG_FOLDER}/self-test.svg`,
		`${fs.documentsPath}/${SVG_FOLDER}/self-test.png`,
	);
	const written = raster ? await fs.exists(`${SVG_FOLDER}/self-test.png`) : false;

	return raster && written
		? { ok: true, detail: `drew a ${raster.width}×${raster.height} picture` }
		: { ok: false, detail: 'the sample SVG did not draw' };
}

export default selfTestRaster;
