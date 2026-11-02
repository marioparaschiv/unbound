import { View } from 'react-native';

import InstallButton from '~/ui/addons/install-button';
import AddonTab from '~/ui/settings/addon-tab';
import { SafeArea } from '~/metro/components';

/**
 * @description The Plugins settings page: the shared addon list bound to the Plugins manager, with a
 * floating install button. The list scrolls inside a full-height container so the button stays pinned
 * to the bottom of the screen and the empty state can center. The card holds the richness, so this
 * page is thin.
 */
function PluginsPage() {
	return (
		<SafeArea.SafeAreaPaddingView bottom style={{ flex: 1 }}>
			<View style={{ flex: 1 }}>
				<AddonTab kind={'plugin'} />
				<InstallButton kind={'plugin'} />
			</View>
		</SafeArea.SafeAreaPaddingView>
	);
}

export default PluginsPage;
