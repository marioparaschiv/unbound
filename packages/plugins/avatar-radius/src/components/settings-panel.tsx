import Page from '@unbound-plugins/shared/components/page';
import { Discord } from '@unbound-app/api/metro/components';
import { useState } from 'react';

import { MAXIMUM_RADIUS } from '~/constants';
import { storedRadius } from '~/radius';
import { settings } from '~/modules';

function SettingsPanel() {
	const store = settings.useSettingsStore();
	const [radius, setRadius] = useState(String(storedRadius(store.get('radius', undefined))));

	function saveRadius() {
		const value = storedRadius(radius);

		store.set('radius', value);
		setRadius(String(value));
	}

	return (
		<Page>
			<Discord.TextInput
				label='Corner radius'
				description={`How round avatar corners are, from 0 for square to ${MAXIMUM_RADIUS}. A radius past half an avatar's size keeps it a circle.`}
				value={radius}
				onChange={setRadius}
				onEndEditing={saveRadius}
				onSubmitEditing={saveRadius}
				keyboardType='number-pad'
			/>
		</Page>
	);
}

export default SettingsPanel;
