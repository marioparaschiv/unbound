import type { ReactElement, ReactNode } from 'react';
import { cloneElement, isValidElement } from 'react';

import type { AnyProps } from '~/api/metro';
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

function isRootThemeModule(mdl: AnyProps | undefined): mdl is RootThemeModule {
	return typeof mdl?.RootThemeContextProvider === 'function';
}

/**
 * @description Finds the module whose `RootThemeContextProvider` wraps the whole app in Discord's theme context.
 * @returns The module to patch, or `undefined` when this Discord build lacks it.
 */
export function findRootThemeProvider(): RootThemeModule | undefined {
	// The module object itself, not a copy: the patcher replaces the export on it.
	const root = findByFilePath(ROOT_THEME_PROVIDER_PATH, { interop: false });

	return isRootThemeModule(root) ? root : undefined;
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
