import type { ReactNode } from 'react';

import { createPatcher } from '~/patcher/create-patcher';
import { onModuleLoaded } from '~/metro/wait';
import { byFilePath } from '~/metro/filters';
import ThemeStore from '~/themes/state';

const Patcher = createPatcher('unbound::themes::dm-greeting');

/** The wave prompt at the end of a new DM, drawn on a solid panel that fades in from the chat above it. */
const GREETING_PATH = 'modules/messages/native/DMMessageStickerGreeting.tsx';
/** Discord's client theme helpers: `useGradientValue` hands the greeting its panel colour on a gradient theme. */
const CLIENT_THEMES_PATH = 'modules/client_themes/native/ClientThemesUtils.tsx';
const CLEAR = '#00000000';

type Component = () => ReactNode;

type GreetingModule = { default: Component };

type ClientThemesModule = { useGradientValue: (...args: never[]) => string | null };

// True only while the greeting renders; its hooks run synchronously inside that render.
let renderingGreeting = false;

function watchGreeting(mdl: GreetingModule) {
	Patcher.before(mdl, 'default', () => {
		renderingGreeting = true;
	});
	Patcher.after(mdl, 'default', ({ result }) => {
		renderingGreeting = false;

		return result;
	});
}

// Without a gradient theme the greeting falls back to a solid panel; over a chat background it goes clear instead.
function clearPanel(mdl: ClientThemesModule) {
	Patcher.after(mdl, 'useGradientValue', ({ result }) => {
		if (!renderingGreeting || result !== null || !ThemeStore.getState().background) {
			return result;
		}

		return CLEAR;
	});
}

/**
 * @description Clears the solid panel behind a new DM's wave prompt while a chat background shows, so the background
 * runs under it. Patches each module once it loads.
 * @returns A function that stops waiting and restores Discord's panel.
 */
export function clearDMGreeting(): () => void {
	const stops = [
		onModuleLoaded(byFilePath(GREETING_PATH), watchGreeting),
		onModuleLoaded(byFilePath(CLIENT_THEMES_PATH), clearPanel),
	];

	return () => {
		for (const stop of stops) stop();

		Patcher.unpatchAll();
	};
}
