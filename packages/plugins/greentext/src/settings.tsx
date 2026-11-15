import { settings, useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

import { DEFAULT_COLOR } from '~/lib/greentext';

export default function SettingsPanel() {
	const color = useSetting('color');

	return (
		<ui.Page>
			<ui.Section>
				<ui.ColorRow
					label={messages.COLOR}
					color={color || undefined}
					fallbackColor={DEFAULT_COLOR}
					fallbackLabel={messages.COLOR_FALLBACK}
					onChange={(value) => {
						settings.color = value ?? '';
					}}
				/>
			</ui.Section>
		</ui.Page>
	);
}
