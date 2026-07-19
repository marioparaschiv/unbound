import { View, ScrollView } from 'react-native';

import { AddonList, InstallButton } from '~/ui/addons';
import { SafeArea } from '~/api/metro/components';
import { ManagerKind } from '~/lib/constants';

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
				<ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, gap: 12 }}>
					<AddonList kind={ManagerKind.Plugins} />
				</ScrollView>
				<InstallButton kind={ManagerKind.Plugins} />
			</View>
		</SafeArea.SafeAreaPaddingView>
	);
}

export default PluginsPage;
