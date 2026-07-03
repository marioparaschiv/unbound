import { ScrollView } from 'react-native';

import { ManagerKind } from '~/lib/constants';
import { AddonList } from '~/ui/addons';

/** The Themes tab: the shared addon list bound to the Themes manager. */
function ThemesTab() {
	return (
		<ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
			<AddonList kind={ManagerKind.Themes} />
		</ScrollView>
	);
}

export default ThemesTab;
