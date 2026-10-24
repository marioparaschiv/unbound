import Page from '@unbound-plugins/shared/components/page';
import { Discord } from '@unbound-app/api/metro/components';
import { View } from 'react-native';
import { useState } from 'react';

import { DEFAULT_THEME, HLJS_PREFERENCES, ICON_MODES, THEME_IDS } from '~/constants';
import { isThemeUrl, themeLabel } from '~/themes';
import { settings } from '~/modules';

function SettingsPanel() {
	const store = settings.useSettingsStore();
	const [themePickerOpen, setThemePickerOpen] = useState(false);
	const [hljsPickerOpen, setHljsPickerOpen] = useState(false);
	const [themeQuery, setThemeQuery] = useState('');
	const [customTheme, setCustomTheme] = useState(String(store.get('customTheme', '')));
	const [opacity, setOpacity] = useState(String(store.get('bgOpacity', 100)));
	const theme = String(store.get('theme', DEFAULT_THEME));
	const iconMode = String(store.get('useDevIcon', 'greyscale'));
	const overflow = store.get('lineOverflow', 'wrap');
	const hljs = String(store.get('tryHljs', 'secondary'));
	const themes = THEME_IDS.filter((id) =>
		themeLabel(id).toLowerCase().includes(themeQuery.toLowerCase()),
	);

	function saveCustomTheme() {
		const url = customTheme.trim();

		if (url && !isThemeUrl(url)) return;

		store.set('customTheme', url);
	}

	function saveOpacity() {
		const value = Number(opacity);

		if (!Number.isFinite(value)) return;

		const clamped = Math.max(0, Math.min(100, Math.round(value)));

		store.set('bgOpacity', clamped);
		setOpacity(String(clamped));
	}

	return (
		<Page>
			<Discord.TableRowGroup title='Appearance'>
				<Discord.TableRow
					label='Language icons'
					subLabel='Show Devicon language marks in the code-block header.'
					trailing={<Discord.TableRow.TrailingText text={iconMode} />}
					onPress={() =>
						store.set(
							'useDevIcon',
							ICON_MODES[(ICON_MODES.indexOf(iconMode) + 1) % ICON_MODES.length],
						)
					}
				/>
				<Discord.TableRow
					label='Theme'
					subLabel='Choose a VS Code theme for syntax colors.'
					trailing={<Discord.TableRow.TrailingText text={themeLabel(theme)} />}
					onPress={() => setThemePickerOpen(!themePickerOpen)}
				/>
			</Discord.TableRowGroup>
			{themePickerOpen ? (
				<View style={{ gap: 12 }}>
					<Discord.TextInput
						value={themeQuery}
						onChange={setThemeQuery}
						placeholder='Search themes'
					/>
					<Discord.TableRadioGroup
						title='Theme'
						value={theme}
						onChange={(value: string) => {
							store.set('theme', value);
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
				title='Custom theme URL'
				helpText='An HTTPS link to a VS Code theme JSON file overrides the selected theme.'
				value={customTheme}
				onChange={setCustomTheme}
				onEndEditing={saveCustomTheme}
				onSubmitEditing={saveCustomTheme}
				autoCapitalize='none'
				placeholder='https://example.com/theme.json'
			/>
			<Discord.TextInput
				title='Background opacity (%)'
				value={opacity}
				onChange={setOpacity}
				onEndEditing={saveOpacity}
				onSubmitEditing={saveOpacity}
				keyboardType='number-pad'
			/>
			<Discord.TableRowGroup title='Highlighting'>
				<Discord.TableRow
					label='Long lines'
					subLabel='Choose between wrapping code and scrolling horizontally.'
					trailing={
						<Discord.TableRow.TrailingText
							text={overflow === 'scroll' ? 'Horizontal scroll' : 'Wrap'}
						/>
					}
					onPress={() =>
						store.set('lineOverflow', overflow === 'scroll' ? 'wrap' : 'scroll')
					}
				/>
				<Discord.TableRow
					label='Highlighting preference'
					subLabel='Choose when Highlight.js takes priority over Shiki.'
					trailing={
						<Discord.TableRow.TrailingText
							text={HLJS_PREFERENCES.find(({ value }) => value === hljs)?.label ?? ''}
						/>
					}
					onPress={() => setHljsPickerOpen(!hljsPickerOpen)}
				/>
			</Discord.TableRowGroup>
			{hljsPickerOpen ? (
				<Discord.TableRadioGroup
					title='Highlighting preference'
					value={hljs}
					onChange={(value: string) => {
						store.set('tryHljs', value);
						setHljsPickerOpen(false);
					}}
				>
					{HLJS_PREFERENCES.map(({ label, value }) => (
						<Discord.TableRadioRow key={value} label={label} value={value} />
					))}
				</Discord.TableRadioGroup>
			) : null}
		</Page>
	);
}

export default SettingsPanel;
