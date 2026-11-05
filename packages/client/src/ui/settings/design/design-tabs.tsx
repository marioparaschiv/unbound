import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useMemo, useState, type ReactNode } from 'react';
import noop from '@unbound-app/utils/noop';

import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';

import type { PickerKind } from './picker-report';

import DeferredPage, { ActiveTab } from './deferred-page';
import { HeaderElements } from './navigation';
import useStyles from './design-tabs.style';
import HeaderInset from './header-inset';
import FontsTab from './fonts';

export type DesignTab = (typeof TABS)[number]['id'];

type DesignTabsProps = {
	/** Renders the Themes or Icons page; called once per tab, the first time it is shown. */
	renderPage: (kind: PickerKind) => ReactNode;
	onTabChange?: (tab: DesignTab) => void;
};

const TABS = [
	{ id: 'theme', label: () => messages.UNBOUND_THEMES },
	{ id: 'font', label: () => messages.UNBOUND_FONTS },
	{ id: 'icon-pack', label: () => messages.UNBOUND_ICONS },
] as const;

/**
 * @description The Design page's frame: Discord's large segmented control over Themes, Fonts and Icons, floating
 * below a transparent header over full-screen pages, which inset past both through the header height. Each page
 * mounts the first time its tab opens. Fonts is the shared override list.
 */
function DesignTabs({ renderPage, onTabChange = noop }: DesignTabsProps) {
	const styles = useStyles();
	const headerHeight = HeaderElements.useHeaderHeight();
	const [tab, setTab] = useState(0);
	const [tabsHeight, setTabsHeight] = useState(0);
	const { width } = useWindowDimensions();

	const items = useMemo(
		() =>
			TABS.map(({ id, label }, index) => ({
				id,
				label: label(),
				page: (
					<DeferredPage index={index}>
						{id === 'font' ? (
							<HeaderInset>
								<FontsTab />
							</HeaderInset>
						) : (
							renderPage(id)
						)}
					</DeferredPage>
				),
			})),
		[],
	);

	const state = Discord.useSegmentedControlState({
		items,
		pageWidth: width,
		defaultIndex: 0,
		onPageChange: (index: number) => {
			setTab(index);
			onTabChange(TABS[index]?.id ?? 'theme');
		},
	});

	return (
		<ActiveTab.Provider value={tab}>
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
		</ActiveTab.Provider>
	);
}

export default DesignTabs;
