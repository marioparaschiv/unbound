import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

import { openDoom } from '~/game';

/**
 * @description The settings panel: a button that opens the game.
 */
export function SettingsPanel() {
	return (
		<ui.Page>
			<ui.Section title={messages.DOOM}>
				<ui.ButtonRow
					label={messages.PLAY}
					subLabel={messages.PLAY_SUBTITLE}
					onPress={openDoom}
				/>
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
