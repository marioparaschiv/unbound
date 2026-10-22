import { useState } from 'react';

import { metro, storage, toasts } from '@unbound-app/api';

import {
	getSourceLanguage,
	getTargetLanguage,
	hasRefreshToken,
	setSourceLanguage,
	setTargetLanguage,
} from '@translate/api';
import { openDiscordLoginFlow } from '@translate/oauth';
import LanguagePickerSheet from '@translate/sheets/LanguagePickerSheet';
import { SettingsRow, SettingsScrollView, SettingsSection } from '@shared/settings-ui';

const STORE = storage.getStore('unbound.translate');

function openLanguageSheet(options: {
	title: string;
	current: string;
	includeAuto?: boolean;
	onSelect: (code: string) => void;
}) {
	const sheets =
		typeof metro?.findByProps === 'function'
			? metro.findByProps('openLazy', 'hideActionSheet')
			: null;
	if (!sheets) {
		toasts.showToast({ title: 'Translate', content: 'Language picker is unavailable.' });
		return;
	}
	const key = `unbound-translate-${options.title}-${options.current}`;

	sheets.openLazy(Promise.resolve({ default: LanguagePickerSheet }), key, {
		title: options.title,
		current: options.current,
		includeAuto: options.includeAuto,
		onSelect: options.onSelect,
		onClose: () => sheets.hideActionSheet(key),
	});
}

export function TranslateSettingsScreen() {
	const state = STORE.useSettingsStore();
	const refreshConfigured = hasRefreshToken() || !!state.get('refreshToken', '');
	const targetLanguage = getTargetLanguage();
	const sourceLanguage = getSourceLanguage();
	const [connecting, setConnecting] = useState(false);

	return (
		<SettingsScrollView>
			<SettingsSection title='Translate API'>
				<SettingsRow
					label={
						connecting
							? 'Connecting Discord account…'
							: refreshConfigured
								? 'Reconnect Discord account'
								: 'Connect Discord account'
					}
					description={
						connecting
							? 'Finishing Discord authorization'
							: refreshConfigured
								? 'Re-authenticate with Discord'
								: 'Sign in to enable translation'
					}
					disabled={connecting}
					onPress={() => {
						setConnecting(true);
						openDiscordLoginFlow(() => setConnecting(false));
					}}
				/>
			</SettingsSection>

			<SettingsSection title='Languages'>
				<SettingsRow
					label='Source Language'
					description={sourceLanguage}
					arrow
					disabled={!refreshConfigured}
					onPress={() =>
						refreshConfigured &&
						openLanguageSheet({
							title: 'Select source language',
							current: sourceLanguage,
							includeAuto: true,
							onSelect: setSourceLanguage,
						})
					}
				/>
				<SettingsRow
					label='Target Language'
					description={targetLanguage}
					arrow
					disabled={!refreshConfigured}
					onPress={() =>
						refreshConfigured &&
						openLanguageSheet({
							title: 'Select target language',
							current: targetLanguage,
							onSelect: setTargetLanguage,
						})
					}
				/>
			</SettingsSection>
		</SettingsScrollView>
	);
}
