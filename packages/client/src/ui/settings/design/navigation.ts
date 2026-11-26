import { createContext, type Context, type ReactNode } from 'react';

import { findByProps } from '~/metro/lookups';

/** What React Navigation passes a header button renderer. */
type HeaderButtonProps = { tintColor?: string; canGoBack?: boolean };

/** The header options the Design page reads or overrides; the rest pass through `navigation.setOptions` as set. */
export type HeaderOptions = {
	headerTransparent?: boolean;
	headerRight?: (props: HeaderButtonProps) => ReactNode;
};

/** The slice of a React Navigation `navigation` object the Design page uses. */
export type Navigation = {
	setOptions: (options: HeaderOptions) => void;
};

type NavigationModule = { NavigationContext: Context<Navigation | undefined> };

type HeaderModule = {
	HeaderHeightContext: Context<number | undefined>;
};

/** React Navigation's core: its context is what `useNavigation` reads. */
export const NavigationCore: NavigationModule | undefined = findByProps(
	'NavigationContext',
	'useNavigation',
);

// Stands in when Discord moved the header elements, so the Design page still renders.
const NoHeaderElements: HeaderModule = {
	HeaderHeightContext: createContext<number | undefined>(undefined),
};

/** `@react-navigation/elements`: the context Discord's theme picker reads its top inset from. */
export const HeaderElements: HeaderModule =
	findByProps('HeaderHeightContext', 'useHeaderHeight') ?? NoHeaderElements;
