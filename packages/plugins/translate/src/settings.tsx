import { openLanguagePicker } from '~/translate/components/language-picker-sheet';
import { messages } from '@unbound-app/i18n';
import { settings, useSetting } from '@unbound-app/settings';
import { connectDiscord } from '~/translate/login';
import { useState } from 'react';
import { ui } from '@unbound-app/api';

/**
 * @description The plugin's settings screen: sign in to the translate service, and pick the source and target languages.
 */
export function SettingsPanel() {
	const [connecting, setConnecting] = useState(false);
	const signedIn = Boolean(useSetting('refreshToken'));
	const sourceLanguage = useSetting('sourceLanguage');
	const targetLanguage = useSetting('targetLanguage');

	function connect() {
		setConnecting(true);
		void connectDiscord().finally(() => setConnecting(false));
	}

	return (
		<ui.Page>
			<ui.Section title={messages.TRANSLATE_API}>
				<ui.Row
					label={
						connecting
							? messages.CONNECTING_ACCOUNT
							: signedIn
								? messages.RECONNECT_ACCOUNT
								: messages.CONNECT_ACCOUNT
					}
					subLabel={
						connecting
							? messages.CONNECTING_ACCOUNT_SUBTITLE
							: signedIn
								? messages.RECONNECT_ACCOUNT_SUBTITLE
								: messages.CONNECT_ACCOUNT_SUBTITLE
					}
					disabled={connecting}
					onPress={connect}
				/>
			</ui.Section>
			<ui.Section title={messages.LANGUAGES}>
				<ui.Row
					label={messages.SOURCE_LANGUAGE}
					subLabel={sourceLanguage}
					arrow
					disabled={!signedIn}
					onPress={() =>
						openLanguagePicker({
							title: messages.SELECT_SOURCE_LANGUAGE,
							current: sourceLanguage,
							includeAuto: true,
							onSelect: (code) => (settings.sourceLanguage = code),
						})
					}
				/>
				<ui.Row
					label={messages.TARGET_LANGUAGE}
					subLabel={targetLanguage}
					arrow
					disabled={!signedIn}
					onPress={() =>
						openLanguagePicker({
							title: messages.SELECT_TARGET_LANGUAGE,
							current: targetLanguage,
							onSelect: (code) => (settings.targetLanguage = code),
						})
					}
				/>
			</ui.Section>
		</ui.Page>
	);
}
