import { storage, ui } from '@unbound-app/api';
import { useState } from 'react';

import { openLanguagePicker } from '~/components/language-picker-sheet';
import { connectDiscord } from '~/login';

function SettingsPanel() {
	const store = storage.useBucket(addon.id);
	const [connecting, setConnecting] = useState(false);
	const signedIn = Boolean(store.get('refreshToken', ''));
	const sourceLanguage = store.get('sourceLanguage', 'auto');
	const targetLanguage = store.get('targetLanguage', 'en');

	function connect() {
		setConnecting(true);
		void connectDiscord().finally(() => setConnecting(false));
	}

	return (
		<ui.Page>
			<ui.Section title='Translate API'>
				<ui.Row
					label={
						connecting
							? 'Connecting Discord account…'
							: signedIn
								? 'Reconnect Discord account'
								: 'Connect Discord account'
					}
					subLabel={
						connecting
							? 'Finishing Discord authorization'
							: signedIn
								? 'Re-authenticate with Discord'
								: 'Sign in to enable translation'
					}
					disabled={connecting}
					onPress={connect}
				/>
			</ui.Section>
			<ui.Section title='Languages'>
				<ui.Row
					label='Source Language'
					subLabel={sourceLanguage}
					arrow
					disabled={!signedIn}
					onPress={() =>
						openLanguagePicker({
							title: 'Select source language',
							current: sourceLanguage,
							includeAuto: true,
							onSelect: (code) => store.set('sourceLanguage', code),
						})
					}
				/>
				<ui.Row
					label='Target Language'
					subLabel={targetLanguage}
					arrow
					disabled={!signedIn}
					onPress={() =>
						openLanguagePicker({
							title: 'Select target language',
							current: targetLanguage,
							onSelect: (code) => store.set('targetLanguage', code),
						})
					}
				/>
			</ui.Section>
		</ui.Page>
	);
}

export default SettingsPanel;
