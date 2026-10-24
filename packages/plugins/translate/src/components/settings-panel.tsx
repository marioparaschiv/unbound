import Page from '@unbound-plugins/shared/components/page';
import { Discord } from '@unbound-app/api/metro/components';
import { useState } from 'react';

import { openLanguagePicker } from '~/components/language-picker-sheet';
import { connectDiscord } from '~/login';
import { settings } from '~/modules';

function SettingsPanel() {
	const store = settings.useSettingsStore();
	const [connecting, setConnecting] = useState(false);
	const signedIn = Boolean(store.get('refreshToken', ''));
	const sourceLanguage = store.get('sourceLanguage', 'auto');
	const targetLanguage = store.get('targetLanguage', 'en');

	function connect() {
		setConnecting(true);
		void connectDiscord().finally(() => setConnecting(false));
	}

	return (
		<Page>
			<Discord.TableRowGroup title='Translate API'>
				<Discord.TableRow
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
			</Discord.TableRowGroup>
			<Discord.TableRowGroup title='Languages'>
				<Discord.TableRow
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
				<Discord.TableRow
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
			</Discord.TableRowGroup>
		</Page>
	);
}

export default SettingsPanel;
