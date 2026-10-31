import { ui } from '@unbound-app/api';

import { DEFAULT_RADIUS, MAXIMUM_RADIUS } from '~/constants';
import { storedRadius } from '~/radius';
import { settings } from '~/modules';

function SettingsPanel() {
	const store = settings.useSettingsStore();

	return (
		<ui.Page>
			<ui.Section
				title='Avatars'
				description={`From 0 for square to ${MAXIMUM_RADIUS}. A radius past half an avatar's size keeps it a circle.`}
			>
				<ui.SliderRow
					label='Corner radius'
					value={storedRadius(store.get('radius', undefined))}
					defaultValue={DEFAULT_RADIUS}
					minimum={0}
					maximum={MAXIMUM_RADIUS}
					unit=' pt'
					onChange={(value) => store.set('radius', value)}
				/>
			</ui.Section>
			<ui.ResetRow onReset={() => store.set('radius', DEFAULT_RADIUS)} />
		</ui.Page>
	);
}

export default SettingsPanel;
