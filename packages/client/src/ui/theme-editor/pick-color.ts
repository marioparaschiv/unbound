import { createLogger } from '@unbound-app/logger';
import type { View } from 'react-native';

import ThemeEditorStore from '~/themes/editor-state';
import { ActionSheets } from '~/metro/api';
import ThemeStore from '~/themes/state';
import { messages } from '~/i18n/api';
import { show } from '~/toasts/api';

import { keyTokenColors, matchTokens, type PickedColor } from './token-matches';
import { elementAt, rootOf, type FiberRoot } from './element-at-point';
import { resolveTokenColor, tokenNames } from './token-colors';
import PickedColorsSheet from './picked-colors-sheet';
import { BASIC_CATEGORIES } from './token-groups';
import { sampleColors } from './element-colors';

const Logger = createLogger('Themes', 'ColorPicker');

const SHEET_KEY = 'unbound-picked-colors';

const CURATED = new Set(
	BASIC_CATEGORIES.flatMap(({ colors }) => colors.flatMap(({ tokens }) => tokens)),
);

// React commits the overlay's removal before the next frame, so the search then sees what was under it.
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

// Token colours are read on each pick, since the draft changes them.
function currentTokenColors() {
	return keyTokenColors(
		tokenNames().flatMap((name) => {
			const color = resolveTokenColor(name);

			return color ? [[name, color] as const] : [];
		}),
	);
}

async function identifyAt(
	root: FiberRoot,
	x: number,
	y: number,
): Promise<PickedColor[] | undefined> {
	await nextFrame();

	const chain = await elementAt(root, x, y);

	if (!chain) {
		return undefined;
	}

	const tokens = currentTokenColors();
	const edited = new Set(Object.keys(ThemeStore.getState().preview?.semantic ?? {}));

	return sampleColors(chain).map((sample) =>
		matchTokens(sample, tokens, { edited, curated: CURATED, limit: Infinity }),
	);
}

/**
 * @description Lists the colours of the element under a tap in a sheet, each opening the theme editor on it.
 * @param overlay The overlay that took the tap. It hides before the search, so the search finds what is under it.
 * @param x The tap's distance from the window's left edge.
 * @param y The tap's distance from the window's top edge.
 */
export async function pickColorAt(overlay: View, x: number, y: number): Promise<void> {
	const store = ThemeEditorStore.getState();
	const root = rootOf(overlay);

	store.setPicker('reading');

	let colors: PickedColor[] | undefined;

	try {
		colors = root && (await identifyAt(root, x, y));
	} catch (error) {
		Logger.error(`Failed to identify the colours at ${x},${y}:`, error);
	}

	store.setPicker('idle');

	if (!colors?.length) {
		show({
			content: colors
				? messages.UNBOUND_THEME_PICK_NONE
				: messages.UNBOUND_THEME_PICK_UNAVAILABLE,
			icon: 'CircleXIcon',
		});

		return;
	}

	ActionSheets.openLazy(Promise.resolve({ default: PickedColorsSheet }), SHEET_KEY, {
		colors,
		onClose: () => ActionSheets.hideActionSheet(SHEET_KEY),
	});
}
