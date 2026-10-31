import { ScrollView } from 'react-native';

import AddonList from '~/ui/addons/addon-list';

/** The Icons tab: the shared addon list bound to the Icons manager. */
function IconsTab() {
	return (
		<ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, gap: 12 }}>
			<AddonList kind={'icon-pack'} />
		</ScrollView>
	);
}

export default IconsTab;
