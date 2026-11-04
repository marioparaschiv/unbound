import { storage, ui } from '@unbound-app/api';

import { DISCORD_PLAYING_LIMIT, SETTINGS } from '~/constants';
import { SETTINGS_BUCKET } from '~/modules';
import { playingLimit } from '~/settings';

function SettingsPanel() {
	const store = storage.useBucket(SETTINGS_BUCKET);

	return (
		<ui.Page>
			<ui.Section title='Reaction Picker'>
				<ui.SwitchRow
					label='Super React by Default'
					subLabel='The reaction picker opens on Super Reactions. Needs Nitro.'
					value={store.get('superReactByDefault', SETTINGS.superReactByDefault)}
					onValueChange={(value) => store.set('superReactByDefault', value)}
				/>
			</ui.Section>
			<ui.Section
				title='Animations'
				description={`How many Super Reaction animations play at once on one message. 0 plays none, and ${DISCORD_PLAYING_LIMIT} leaves Discord's own limit in charge.`}
			>
				<ui.SliderRow
					label='Playing Limit'
					value={playingLimit(store.get('superReactionPlayingLimit', undefined))}
					defaultValue={SETTINGS.superReactionPlayingLimit}
					minimum={0}
					maximum={DISCORD_PLAYING_LIMIT}
					onChange={(value) => store.set('superReactionPlayingLimit', value)}
				/>
			</ui.Section>
			<ui.ResetRow
				onReset={() => {
					store.set('superReactByDefault', SETTINGS.superReactByDefault);
					store.set('superReactionPlayingLimit', SETTINGS.superReactionPlayingLimit);
				}}
			/>
		</ui.Page>
	);
}

export default SettingsPanel;
