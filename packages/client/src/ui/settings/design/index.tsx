import { useMemo, useState } from 'react';
import { Dimensions } from 'react-native';

import InstallButton from '~/ui/addons/install-button';
import { Discord } from '~/api/metro/components';
import { ManagerKind } from '~/lib/constants';
import { Page } from '~/ui/components';
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
		<Page>
			<Discord.SegmentedControl state={state} />
			<Discord.SegmentedControlPages state={state} />
			{tab === 2 ? null : <InstallButton kind={TAB_KINDS[tab]} />}
		</Page>
	);
}

export default DesignPage;
