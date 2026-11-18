import { openLanguagePicker } from '~/components/language-picker-sheet';
import { messages } from '@unbound-app/i18n';
import { settings, useSetting } from '@unbound-app/settings';
import { connectDiscord } from '~/lib/login';
import { useState } from 'react';
import { ui } from '@unbound-app/api';
import { servicesToTry } from '~/lib/providers';

/**
 * @description The plugin's settings screen: sign in to the translate service, pick the source and target languages, and choose where translations show.
 */
export function SettingsPanel() {
	const [connecting, setConnecting] = useState(false);
	const signedIn = Boolean(useSetting('refreshToken'));
	const service = useSetting('service');
	const needsAccount = servicesToTry(service, signedIn)[0] === 'unbound' && !signedIn;
	const usesAccount = service === 'auto' || service === 'unbound';
	const sourceLanguage = useSetting('sourceLanguage');
	const targetLanguage = useSetting('targetLanguage');
	const display = useSetting('display');
	const showLanguages = useSetting('showLanguages');
	const languageFlags = useSetting('languageFlags');

	function connect() {
		setConnecting(true);
		void connectDiscord().finally(() => setConnecting(false));
	}

	return (
		<ui.Page>
			<ui.RadioRow
				title={messages.SERVICE}
				value={service}
				options={[
					{
						value: 'auto',
						label: messages.SERVICE_AUTO,
						subLabel: messages.SERVICE_AUTO_SUBTITLE,
					},
					{
						value: 'unbound',
						label: messages.SERVICE_UNBOUND,
						subLabel: messages.SERVICE_UNBOUND_SUBTITLE,
					},
					{
						value: 'google',
						label: messages.SERVICE_GOOGLE,
						subLabel: messages.SERVICE_NO_ACCOUNT,
					},
					{
						value: 'mymemory',
						label: messages.SERVICE_MYMEMORY,
						subLabel: messages.SERVICE_NO_ACCOUNT,
					},
				]}
				onChange={(value) => (settings.service = value as typeof service)}
			/>
			{usesAccount ? (
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
			) : null}
			<ui.Section title={messages.LANGUAGES}>
				<ui.Row
					label={messages.SOURCE_LANGUAGE}
					subLabel={sourceLanguage}
					arrow
					disabled={needsAccount}
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
					disabled={needsAccount}
					onPress={() =>
						openLanguagePicker({
							title: messages.SELECT_TARGET_LANGUAGE,
							current: targetLanguage,
							onSelect: (code) => (settings.targetLanguage = code),
						})
					}
				/>
			</ui.Section>
			<ui.RadioRow
				title={messages.DISPLAY}
				value={display}
				options={[
					{
						value: 'toast',
						label: messages.SHOW_IN_TOAST,
						subLabel: messages.SHOW_IN_TOAST_SUBTITLE,
					},
					{
						value: 'inline',
						label: messages.SHOW_INLINE,
						subLabel: messages.SHOW_INLINE_SUBTITLE,
					},
				]}
				onChange={(value) => (settings.display = value as typeof display)}
			/>
			{display === 'inline' ? (
				<ui.Section>
					<ui.SwitchRow
						label={messages.SHOW_LANGUAGES}
						subLabel={messages.SHOW_LANGUAGES_SUBTITLE}
						value={showLanguages}
						onValueChange={(value) => (settings.showLanguages = value)}
					/>
					<ui.SwitchRow
						label={messages.LANGUAGE_FLAGS}
						subLabel={messages.LANGUAGE_FLAGS_SUBTITLE}
						value={languageFlags}
						disabled={!showLanguages}
						onValueChange={(value) => (settings.languageFlags = value)}
					/>
				</ui.Section>
			) : null}
		</ui.Page>
	);
}
