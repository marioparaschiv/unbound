import { React, ReactNative as RN } from '@metro/common';
import { Addons } from '@ui/settings/components';
import { showInstallAlert } from '@ui/settings/components/install-modal';
import Icons from '@managers/icons';

function IconsPage() {
	const addons = Icons.useEntities();

	return <RN.View style={{ flex: 1 }}>
		<Addons
			showHeaderRight={false}
			type='icons'
			addons={addons}
		/>
	</RN.View>
}

export const callback = ({ type, ref }) => showInstallAlert({ type, ref })
export default { page: <IconsPage />, callback }