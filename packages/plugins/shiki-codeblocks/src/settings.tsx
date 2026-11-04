import { resetSettings, settings, useSetting } from '@unbound-app/settings';
import { Discord } from '@unbound-app/api/metro/components';
import { messages, type MessageKey } from '@unbound-app/i18n';
import { View } from 'react-native';
import { useState } from 'react';
import { ui } from '@unbound-app/api';

import { HLJS_PREFERENCES, ICON_MODES, THEME_IDS } from '~/constants';
import { isThemeUrl, themeLabel } from '~/codeblocks/themes';

const ICON_MODE_LABELS: Record<(typeof ICON_MODES)[number], MessageKey> = {
	disabled: 'ICONS_DISABLED',
	greyscale: 'ICONS_GREYSCALE',
	colored: 'ICONS_COLORED',
};

const HLJS_LABELS: Record<(typeof HLJS_PREFERENCES)[number], MessageKey> = {
	never: 'HLJS_NEVER',
	secondary: 'HLJS_SECONDARY',
	primary: 'HLJS_PRIMARY',
	always: 'HLJS_ALWAYS',
};

// A custom panel, since the generated one has no search for the 61 themes.
export function SettingsPanel() {
	const [themePickerOpen, setThemePickerOpen] = useState(false);
	const [hljsPickerOpen, setHljsPickerOpen] = useState(false);
	const [themeQuery, setThemeQuery] = useState('');
	const [customTheme, setCustomTheme] = useState(settings.customTheme);
	const opacity = useSetting('bgOpacity');
	const theme = useSetting('theme');
	const iconMode = useSetting('useDevIcon');
	const overflow = useSetting('lineOverflow');
	const hljs = useSetting('tryHljs');
	const themes = THEME_IDS.filter((id) =>
		themeLabel(id).toLowerCase().includes(themeQuery.toLowerCase()),
	);

	function saveCustomTheme() {
		const url = customTheme.trim();

		if (url && !isThemeUrl(url)) return;

		settings.customTheme = url;
	}

	return (
		<ui.Page>
			<ui.Section title={messages.APPEARANCE}>
				<ui.Row
					label={messages.LANGUAGE_ICONS}
					subLabel={messages.LANGUAGE_ICONS_SUBTITLE}
					trailing={
						<Discord.TableRow.TrailingText
							text={messages[ICON_MODE_LABELS[iconMode]]}
						/>
					}
					onPress={() => {
						settings.useDevIcon =
							ICON_MODES[(ICON_MODES.indexOf(iconMode) + 1) % ICON_MODES.length];
					}}
				/>
				<ui.Row
					label={messages.THEME}
					subLabel={messages.THEME_SUBTITLE}
					trailing={<Discord.TableRow.TrailingText text={themeLabel(theme)} />}
					onPress={() => setThemePickerOpen(!themePickerOpen)}
				/>
			</ui.Section>
			{themePickerOpen ? (
				<View style={{ gap: 12 }}>
					<Discord.TextInput
						value={themeQuery}
						onChange={setThemeQuery}
						placeholder={messages.SEARCH_THEMES}
					/>
					<Discord.TableRadioGroup
						title={messages.THEME}
						value={theme}
						onChange={(value: string) => {
							settings.theme = value;
							setThemePickerOpen(false);
						}}
					>
						{themes.map((id) => (
							<Discord.TableRadioRow key={id} label={themeLabel(id)} value={id} />
						))}
					</Discord.TableRadioGroup>
				</View>
			) : null}
			<Discord.TextInput
				label={messages.CUSTOM_THEME_URL}
				description={messages.CUSTOM_THEME_URL_SUBTITLE}
				value={customTheme}
				onChange={setCustomTheme}
				onEndEditing={saveCustomTheme}
				onSubmitEditing={saveCustomTheme}
				autoCapitalize='none'
				placeholder={messages.CUSTOM_THEME_URL_PLACEHOLDER}
			/>
			<ui.Section title={messages.CARD}>
				<ui.SliderRow
					label={messages.BACKGROUND_OPACITY}
					value={opacity}
					defaultValue={100}
					minimum={0}
					maximum={100}
					unit='%'
					onChange={(value) => {
						settings.bgOpacity = Math.round(value);
					}}
				/>
			</ui.Section>
			<ui.Section title={messages.HIGHLIGHTING}>
				<ui.Row
					label={messages.LONG_LINES}
					subLabel={messages.LONG_LINES_SUBTITLE}
					trailing={
						<Discord.TableRow.TrailingText
							text={
								overflow === 'scroll'
									? messages.LONG_LINES_SCROLL
									: messages.LONG_LINES_WRAP
							}
						/>
					}
					onPress={() => {
						settings.lineOverflow = overflow === 'scroll' ? 'wrap' : 'scroll';
					}}
				/>
				<ui.Row
					label={messages.HIGHLIGHTING_PREFERENCE}
					subLabel={messages.HIGHLIGHTING_PREFERENCE_SUBTITLE}
					trailing={<Discord.TableRow.TrailingText text={messages[HLJS_LABELS[hljs]]} />}
					onPress={() => setHljsPickerOpen(!hljsPickerOpen)}
				/>
			</ui.Section>
			{hljsPickerOpen ? (
				<Discord.TableRadioGroup
					title={messages.HIGHLIGHTING_PREFERENCE}
					value={hljs}
					onChange={(value: (typeof HLJS_PREFERENCES)[number]) => {
						settings.tryHljs = value;
						setHljsPickerOpen(false);
					}}
				>
					{HLJS_PREFERENCES.map((value) => (
						<Discord.TableRadioRow
							key={value}
							label={messages[HLJS_LABELS[value]]}
							value={value}
						/>
					))}
				</Discord.TableRadioGroup>
			) : null}
			<ui.ResetRow
				onReset={() => {
					resetSettings();
					setCustomTheme('');
				}}
			/>
		</ui.Page>
	);
}
