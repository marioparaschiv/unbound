import type { DebugCardRequest, DebugCardResponse } from '@unbound-app/contracts/debug-cards';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

import { debugAltText, debugCardSvg, layoutDebugCard } from '~/lib/debug-card/layout';

const FONT_PATH = fileURLToPath(import.meta.resolve('@unbound-app/web/debug-card-font'));

/**
 * @description Draws the `/debug` card for a report and renders it as a PNG at the card's scale.
 * @param info The report the client sent.
 * @param now When the report was taken, shown in the title bar.
 * @returns The PNG as base64, its pixel size and the report as alt text JSON.
 */
export function renderDebugCard(info: DebugCardRequest, now = new Date()): DebugCardResponse {
	const card = layoutDebugCard(info, now);
	const rendered = new Resvg(debugCardSvg(card), {
		fitTo: { mode: 'zoom', value: card.scale },
		font: {
			loadSystemFonts: false,
			fontFiles: [FONT_PATH],
			defaultFontFamily: 'JetBrains Mono',
			monospaceFamily: 'JetBrains Mono',
		},
	}).render();

	return {
		image: Buffer.from(rendered.asPng()).toString('base64'),
		width: rendered.width,
		height: rendered.height,
		altText: debugAltText(info),
	};
}

export default renderDebugCard;
