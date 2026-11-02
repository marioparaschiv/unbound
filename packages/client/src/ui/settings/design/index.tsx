import { Dimensions, View } from 'react-native';
import { useMemo, useState } from 'react';

import { installsFromManifest } from '~/addons/addons';
import { Discord, SafeArea } from '~/metro/components';
import InstallButton from '~/ui/addons/install-button';
import { getBucket } from '~/storage/api';

import AddonTab from './addon-tab';
import FontsTab from './fonts';

/** The segmented tabs in order; each tab's id is the manager kind its install button targets. */
const TABS: { id: 'theme' | 'icon-pack' | 'font'; label: string }[] = [
	{ id: 'theme', label: 'Themes' },
	{ id: 'icon-pack', label: 'Icons' },
	{ id: 'font', label: 'Fonts' },
];

/**
 * @description The Design settings page: a segmented Themes / Icons / Fonts control over swipeable
 * pages, with a floating install button that targets the active tab. The selected tab persists.
 */
function DesignPage() {
	const [tab, setTab] = useState(getBucket('design').get('tab', 0));

	const items = useMemo(
		() =>
			TABS.map(({ id, label }) => ({
				id,
				label,
				page: id === 'font' ? <FontsTab /> : <AddonTab kind={id} />,
			})),
		[],
	);
	const kind = TABS[tab]?.id;

	const state = Discord.useSegmentedControlState({
		items,
		pageWidth: Dimensions.get('window').width,
		defaultIndex: tab,
		onPageChange: (index: number) => {
			setTab(index);
			getBucket('design').set('tab', index);
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
					{kind && installsFromManifest(kind) ? <InstallButton kind={kind} /> : null}
				</View>
			</View>
		</SafeArea.SafeAreaPaddingView>
	);
}

export default DesignPage;
