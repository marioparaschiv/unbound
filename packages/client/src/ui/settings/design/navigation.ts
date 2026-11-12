import { createContext, type Context, type ReactNode } from 'react';

import { findByProps } from '~/metro/lookups';

/** What React Navigation passes a header button renderer. */
type HeaderButtonProps = { tintColor?: string; canGoBack?: boolean };

/** The header options the Design page reads or overrides; the rest pass through `navigation.setOptions` as set. */
export type HeaderOptions = {
	headerRight?: (props: HeaderButtonProps) => ReactNode;
};

/** The slice of a React Navigation `navigation` object the Design page uses. */
export type Navigation = {
	setOptions: (options: HeaderOptions) => void;
};

type NavigationModule = { NavigationContext: Context<Navigation | undefined> };

type HeaderModule = {
	HeaderHeightContext: Context<number | undefined>;
	useHeaderHeight: () => number;
};

/** React Navigation's core: its context is what `useNavigation` reads. */
export const NavigationCore: NavigationModule | undefined = findByProps(
	'NavigationContext',
	'useNavigation',
);

// Stands in when Discord moved the header elements, so the Design page's hooks still run, with no inset.
const NoHeaderElements: HeaderModule = {
	HeaderHeightContext: createContext<number | undefined>(undefined),
	useHeaderHeight: () => 0,
};

/** `@react-navigation/elements`: the header height a transparent header leaves screens to inset by. */
export const HeaderElements: HeaderModule =
	findByProps('HeaderHeightContext', 'useHeaderHeight') ?? NoHeaderElements;
