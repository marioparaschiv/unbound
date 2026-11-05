import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import type { ComponentType } from 'react';
import { createElement } from 'react';

import { isRenderable } from '~/metro/components';
import { findByName } from '~/metro/search';
import { icons } from '~/assets/api';

import FallbackEmptyState from './fallback-empty-state';
import useStyles from './empty-state.style';

/** The props of Discord's `design/void/EmptyState`, which the design barrel does not export. */
type DiscordEmptyStateProps = {
	title?: string;
	body?: string;
	lightSource?: ImageSourcePropType;
	darkSource?: ImageSourcePropType;
	style?: StyleProp<ViewStyle>;
};

type EmptyStateProps = {
	children: string;
	/** The illustration's asset name; the generic empty-state image when omitted. */
	image?: string;
};

// `null` once looked up and missing, so builds without it search only once.
let discordEmptyState: ComponentType<DiscordEmptyStateProps> | null | undefined;

function readDiscordEmptyState() {
	if (discordEmptyState === undefined) {
		const found: ComponentType<DiscordEmptyStateProps> | undefined = findByName('EmptyState');

		discordEmptyState = isRenderable(found) ? found : null;
	}

	return discordEmptyState;
}

/**
 * @description A centered illustration and message: Discord's `EmptyState`, or Unbound's on builds without it.
 */
function EmptyState({ children, image = 'empty_state_image' }: EmptyStateProps) {
	const styles = useStyles();
	const DiscordEmptyState = readDiscordEmptyState();

	if (!DiscordEmptyState) {
		return <FallbackEmptyState image={image}>{children}</FallbackEmptyState>;
	}

	const source = icons[image] ?? 0;

	// The component is looked up once and cached, so it keeps its identity across renders.
	return createElement(DiscordEmptyState, {
		body: children,
		lightSource: source,
		darkSource: source,
		style: styles.container,
	});
}

export default EmptyState;
