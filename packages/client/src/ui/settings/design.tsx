import { ScrollView } from 'react-native';

import AddonList from '~/ui/addons/addon-list';
import { ManagerKind } from '~/lib/constants';
import { Empty } from '~/ui/components';
import { useAddons } from '~/ui/hooks';
import { format } from '~/api/i18n';

/**
 * @description Settings page listing installed themes.
 */
function DesignPage() {
	const addons = useAddons(ManagerKind.Themes);

	if (!addons.length) {
		return <Empty>{format('UNBOUND_NO_ADDONS', { type: 'themes' })}</Empty>;
	}

	return (
		<ScrollView>
			<AddonList addons={addons} kind={ManagerKind.Themes} />
		</ScrollView>
	);
}

export default DesignPage;
