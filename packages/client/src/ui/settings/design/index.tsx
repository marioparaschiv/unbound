import type { ManagerKind } from '@unbound-app/types/addons';
import { Dimensions, View } from 'react-native';
import type { ComponentType } from 'react';
import { useMemo, useState } from 'react';

import { Discord, SafeArea } from '~/api/metro/components';
import InstallButton from '~/ui/addons/install-button';
import storage from '~/api/storage';

import ThemesTab from './themes';
import FontsTab from './fonts';
import IconsTab from './icons';

type DesignTab = {
	id: ManagerKind;
	label: string;
	Page: ComponentType;
};

/** The segmented tabs in order; each tab's id is the manager kind its install button targets. */
const TABS: DesignTab[] = [
	{ id: 'themes', label: 'Themes', Page: ThemesTab },
	{ id: 'icons', label: 'Icons', Page: IconsTab },
	{ id: 'fonts', label: 'Fonts', Page: FontsTab },
];

/**
 * @description The Design settings page: a segmented Themes / Icons / Fonts control over swipeable
 * pages, with a floating install button that targets the active tab. The selected tab persists.
 */
function DesignPage() {
	const [tab, setTab] = useState(storage.get('design', 'tab', 0));

	const items = useMemo(
		() => TABS.map(({ id, label, Page }) => ({ id, label, page: <Page /> })),
		[],
	);
	const kind = TABS[tab]?.id;

	const state = Discord.useSegmentedControlState({
		items,
		pageWidth: Dimensions.get('window').width,
		defaultIndex: tab,
		onPageChange: (index: number) => {
			setTab(index);
			storage.set('design', 'tab', index);
		},
	});

	return (
		<SafeArea.SafeAreaPaddingView bottom style={{ flex: 1 }}>
			<View style={{ flex: 1 }}>
				<View style={{ flexGrow: 0, flexShrink: 0, paddingHorizontal: 16, paddingTop: 16 }}>
					<Discord.SegmentedControl state={state} />
				</View>
				<View style={{ flex: 1 }}>
					<Discord.SegmentedControlPages state={state} />
					{!kind || kind === 'fonts' ? null : <InstallButton kind={kind} />}
				</View>
			</View>
		</SafeArea.SafeAreaPaddingView>
	);
}

export default DesignPage;
