import { Dimensions, View } from 'react-native';
import { useMemo, useState } from 'react';

import { Discord, SafeArea } from '~/api/metro/components';
import InstallButton from '~/ui/addons/install-button';
import { ManagerKind } from '~/lib/constants';
import storage from '~/api/storage';

import ThemesTab from './themes';
import FontsTab from './fonts';
import IconsTab from './icons';

/** Maps the active segmented tab index to the manager kind the install button should target. */
const TAB_KINDS = [ManagerKind.Themes, ManagerKind.Icons, ManagerKind.Fonts];

/**
 * @description The Design settings page: a segmented Themes / Icons / Fonts control over swipeable
 * pages, with a floating install button that targets the active tab. The selected tab persists.
 */
function DesignPage() {
	const [tab, setTab] = useState(storage.get('design', 'tab', 0));

	const items = useMemo(
		() => [
			{ id: 'themes', label: 'Themes', page: <ThemesTab /> },
			{ id: 'icons', label: 'Icons', page: <IconsTab /> },
			{ id: 'fonts', label: 'Fonts', page: <FontsTab /> },
		],
		[],
	);

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
				<Discord.SegmentedControl state={state} />
				<View style={{ flex: 1 }}>
					<Discord.SegmentedControlPages state={state} />
					{tab === 2 ? null : <InstallButton kind={TAB_KINDS[tab]} />}
				</View>
			</View>
		</SafeArea.SafeAreaPaddingView>
	);
}

export default DesignPage;
