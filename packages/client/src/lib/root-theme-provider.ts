import type { ReactElement, ReactNode } from 'react';
import { cloneElement, isValidElement } from 'react';

import { findByFilePath } from '~/api/metro';

/** The props of Discord's root theme provider that Unbound reads or rewrites. */
export type RootThemeProps = {
	enabledExperiments?: string[];
	children?: ReactNode;
};

export type RootThemeElement = ReactElement<RootThemeProps>;

type RootThemeModule = {
	RootThemeContextProvider: (...args: never[]) => RootThemeElement;
};

const ROOT_THEME_PROVIDER_PATH = 'modules/themes/RootThemeContextProvider.native.tsx';

/**
 * @description Finds the module whose `RootThemeContextProvider` wraps the whole app in Discord's theme context.
 * @returns The module to patch, or `undefined` when this Discord build lacks it.
 */
export function findRootThemeProvider(): RootThemeModule | undefined {
	const root = findByFilePath(ROOT_THEME_PROVIDER_PATH, { interop: false });

	return typeof root?.RootThemeContextProvider === 'function' ? root : undefined;
}

/**
 * @description Rewrites the theme provider inside the root's rendered tree, the first element that takes
 * `enabledExperiments`; the root wraps it in a gate, so it is not the returned element itself.
 * @param element What the root rendered.
 * @param update Returns the replacement for the theme provider element.
 * @returns The rendered tree with the provider replaced, or unchanged when no provider is found.
 */
export function mapThemeProvider(
	element: RootThemeElement,
	update: (provider: RootThemeElement) => RootThemeElement,
): RootThemeElement {
	const { enabledExperiments, children } = element.props;

	if (Array.isArray(enabledExperiments)) {
		return update(element);
	}

	if (!isValidElement<RootThemeProps>(children)) {
		return element;
	}

	return cloneElement(element, { children: mapThemeProvider(children, update) });
}

export default { findRootThemeProvider, mapThemeProvider };
