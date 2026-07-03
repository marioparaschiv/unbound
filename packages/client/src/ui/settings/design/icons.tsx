import { ScrollView } from 'react-native';

import { ManagerKind } from '~/lib/constants';
import { AddonList } from '~/ui/addons';

/** The Icons tab: the shared addon list bound to the Icons manager. */
function IconsTab() {
	return (
		<ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
			<AddonList kind={ManagerKind.Icons} />
		</ScrollView>
	);
}

export default IconsTab;
