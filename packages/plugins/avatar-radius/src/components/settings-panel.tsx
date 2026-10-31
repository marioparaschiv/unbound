import Page from '@unbound-plugins/shared/components/page';
import SliderRow from '@unbound-plugins/shared/components/slider-row';
import ResetRow from '@unbound-plugins/shared/components/reset-row';
import { Discord } from '@unbound-app/api/metro/components';

import { DEFAULT_RADIUS, MAXIMUM_RADIUS } from '~/constants';
import { storedRadius } from '~/radius';
import { settings } from '~/modules';

function SettingsPanel() {
	const store = settings.useSettingsStore();

	return (
		<Page>
			<Discord.TableRowGroup
				title='Avatars'
				description={`From 0 for square to ${MAXIMUM_RADIUS}. A radius past half an avatar's size keeps it a circle.`}
			>
				<SliderRow
					label='Corner radius'
					value={storedRadius(store.get('radius', undefined))}
					defaultValue={DEFAULT_RADIUS}
					minimum={0}
					maximum={MAXIMUM_RADIUS}
					unit=' pt'
					onChange={(value) => store.set('radius', value)}
				/>
			</Discord.TableRowGroup>
			<ResetRow onReset={() => store.set('radius', DEFAULT_RADIUS)} />
		</Page>
	);
}

export default SettingsPanel;
