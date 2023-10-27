import { React, ReactNative as RN } from '@metro/common';
import Icons from '@managers/icons';

import { Addons } from '@ui/settings/components';
import { showInstallAlert } from '@ui/settings/components/install-modal';

function IconsPage() {
	const addons = Icons.useEntities();

	return <RN.View style={{ flex: 1 }}>
		<Addons
			type='icons'
			addons={addons}
		/>
	</RN.View>
}

export const callback = ({ ref }) => showInstallAlert({ type: 'icons', ref })
export default { page: <IconsPage />, callback }