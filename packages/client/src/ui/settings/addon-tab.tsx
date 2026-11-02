import { ScrollView } from 'react-native';

import AddonList from '~/ui/addons/addon-list';

type AddonTabProps = {
	/** The manager kind the list is bound to. */
	kind: 'plugin' | 'theme' | 'icon-pack';
};

/** A page of one kind's installed addons, scrolling under whatever pins below it. */
function AddonTab({ kind }: AddonTabProps) {
	return (
		<ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, gap: 12 }}>
			<AddonList kind={kind} />
		</ScrollView>
	);
}

export default AddonTab;
