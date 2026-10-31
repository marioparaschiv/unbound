import { Discord } from '@unbound-app/api/metro/components';
import { storage, ui } from '@unbound-app/api';
import { View } from 'react-native';
import { useState } from 'react';

import { DEFAULT_THEME, HLJS_PREFERENCES, ICON_MODES, THEME_IDS } from '~/constants';
import { isThemeUrl, themeLabel } from '~/themes';

const DEFAULT_OPACITY = 100;

const DEFAULT_SETTINGS = {
	theme: DEFAULT_THEME,
	customTheme: '',
	bgOpacity: DEFAULT_OPACITY,
	useDevIcon: 'greyscale',
	lineOverflow: 'wrap',
	tryHljs: 'secondary',
};

function SettingsPanel() {
	const store = storage.useBucket(addon.id);
	const [themePickerOpen, setThemePickerOpen] = useState(false);
	const [hljsPickerOpen, setHljsPickerOpen] = useState(false);
	const [themeQuery, setThemeQuery] = useState('');
	const [customTheme, setCustomTheme] = useState(String(store.get('customTheme', '')));
	const storedOpacity = Number(store.get('bgOpacity', DEFAULT_OPACITY));
	const opacity = Number.isFinite(storedOpacity)
		? Math.max(0, Math.min(100, Math.round(storedOpacity)))
		: DEFAULT_OPACITY;
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

	return (
		<ui.Page>
			<ui.Section title='Appearance'>
				<ui.Row
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
				<ui.Row
					label='Theme'
					subLabel='Choose a VS Code theme for syntax colors.'
					trailing={<Discord.TableRow.TrailingText text={themeLabel(theme)} />}
					onPress={() => setThemePickerOpen(!themePickerOpen)}
				/>
			</ui.Section>
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
				label='Custom theme URL'
				description='An HTTPS link to a VS Code theme JSON file overrides the selected theme.'
				value={customTheme}
				onChange={setCustomTheme}
				onEndEditing={saveCustomTheme}
				onSubmitEditing={saveCustomTheme}
				autoCapitalize='none'
				placeholder='https://example.com/theme.json'
			/>
			<ui.Section title='Card'>
				<ui.SliderRow
					label='Background opacity'
					value={opacity}
					defaultValue={DEFAULT_OPACITY}
					minimum={0}
					maximum={100}
					unit='%'
					onChange={(value) => store.set('bgOpacity', value)}
				/>
			</ui.Section>
			<ui.Section title='Highlighting'>
				<ui.Row
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
				<ui.Row
					label='Highlighting preference'
					subLabel='Choose when Highlight.js takes priority over Shiki.'
					trailing={
						<Discord.TableRow.TrailingText
							text={HLJS_PREFERENCES.find(({ value }) => value === hljs)?.label ?? ''}
						/>
					}
					onPress={() => setHljsPickerOpen(!hljsPickerOpen)}
				/>
			</ui.Section>
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
			<ui.ResetRow
				onReset={() => {
					for (const [key, value] of Object.entries(DEFAULT_SETTINGS))
						store.set(key, value);

					setCustomTheme('');
				}}
			/>
		</ui.Page>
	);
}

export default SettingsPanel;
