import { ScrollView } from 'react-native';

import AddonList from '~/ui/addons/addon-list';

type AddonTabProps = {
	/** The manager kind the list is bound to, the Themes or the Icons one. */
	kind: 'theme' | 'icon-pack';
};

/** One Design tab: the shared addon list, scrolling inside the segmented control's page. */
function AddonTab({ kind }: AddonTabProps) {
	return (
		<ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, gap: 12 }}>
			<AddonList kind={kind} />
		</ScrollView>
	);
}

export default AddonTab;
