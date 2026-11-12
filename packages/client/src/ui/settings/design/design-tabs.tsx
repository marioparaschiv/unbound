import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useMemo, useState, type ReactNode } from 'react';
import noop from '@unbound-app/utils/noop';

import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';

import type { PickerKind } from './picker-report';

import { HeaderElements } from './navigation';
import useStyles from './design-tabs.style';
import HeaderInset from './header-inset';
import ChatTab from './chat-tab';
import FontsTab from './fonts';

export type DesignTab = (typeof TABS)[number]['id'];

type DesignTabsProps = {
	/** Renders the Themes or Icons page; called once per tab, when the tabs mount. */
	renderPage: (kind: PickerKind) => ReactNode;
	onTabChange?: (tab: DesignTab) => void;
};

const TABS = [
	{ id: 'theme', label: () => messages.UNBOUND_THEMES },
	{ id: 'icon-pack', label: () => messages.UNBOUND_ICONS },
	{ id: 'font', label: () => messages.UNBOUND_FONTS },
	{ id: 'chat', label: () => messages.UNBOUND_CHAT },
] as const;

function renderTab(id: DesignTab, renderPage: DesignTabsProps['renderPage']) {
	switch (id) {
		case 'theme':
		case 'icon-pack':
			return renderPage(id);
		case 'font':
			return (
				<HeaderInset>
					<FontsTab />
				</HeaderInset>
			);
		case 'chat':
			return (
				<HeaderInset>
					<ChatTab />
				</HeaderInset>
			);
	}
}

/**
 * @description The Design page's frame: Discord's large segmented control over Themes, Icons, Fonts and Chat, floating
 * below a transparent header over full-screen pages, which inset past both through the header height. Discord keeps
 * each page frozen until a swipe or press first reaches it, so it mounts as it slides in. Themes and Icons are
 * Discord's theme picker; Fonts is the shared override list; Chat holds the chat's look, such as its background.
 */
function DesignTabs({ renderPage, onTabChange = noop }: DesignTabsProps) {
	const styles = useStyles();
	const headerHeight = HeaderElements.useHeaderHeight();
	const [tabsHeight, setTabsHeight] = useState(0);
	const { width } = useWindowDimensions();

	const items = useMemo(
		() =>
			TABS.map(({ id, label }) => ({
				id,
				label: label(),
				page: renderTab(id, renderPage),
			})),
		[],
	);

	const state = Discord.useSegmentedControlState({
		items,
		pageWidth: width,
		defaultIndex: 0,
		onPageChange: (index: number) => onTabChange(TABS[index]?.id ?? 'theme'),
	});

	return (
		<View style={styles.frame}>
			<HeaderElements.HeaderHeightContext.Provider value={headerHeight + tabsHeight}>
				<View style={StyleSheet.absoluteFill}>
					<Discord.SegmentedControlPages state={state} />
				</View>
			</HeaderElements.HeaderHeightContext.Provider>
			<View
				onLayout={(event) => setTabsHeight(event.nativeEvent.layout.height)}
				style={[styles.tabs, { top: headerHeight }]}
			>
				<Discord.SegmentedControl state={state} variant='experimental_Large' />
			</View>
		</View>
	);
}

export default DesignTabs;
