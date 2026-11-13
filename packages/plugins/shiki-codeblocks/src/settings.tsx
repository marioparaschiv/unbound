import { resetSettings, settings, useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

import { THEME_IDS } from '~/lib/constants';
import { isThemeUrl, themeLabel } from '~/lib/themes';

// A custom panel, since the theme picker lists themes the build knows, not ones settings.ts can name.
export function SettingsPanel() {
	const opacity = useSetting('bgOpacity');
	const theme = useSetting('theme');
	const customTheme = useSetting('customTheme');
	const iconMode = useSetting('useDevIcon');
	const overflow = useSetting('lineOverflow');
	const hljs = useSetting('tryHljs');

	return (
		<ui.Page>
			<ui.Section title={messages.APPEARANCE}>
				<ui.PickerRow
					label={messages.THEME}
					value={theme}
					options={THEME_IDS.map((id) => ({ value: id, label: themeLabel(id) }))}
					onChange={(value) => {
						settings.theme = value;
					}}
				/>
				<ui.SegmentedRow
					label={messages.LANGUAGE_ICONS}
					subLabel={messages.LANGUAGE_ICONS_SUBTITLE}
					value={iconMode}
					options={[
						{ value: 'disabled', label: messages.ICONS_DISABLED },
						{ value: 'greyscale', label: messages.ICONS_GREYSCALE },
						{ value: 'colored', label: messages.ICONS_COLORED },
					]}
					onChange={(value) => {
						settings.useDevIcon = value as typeof iconMode;
					}}
				/>
			</ui.Section>
			<ui.Section>
				<ui.InputRow
					label={messages.CUSTOM_THEME_URL}
					subLabel={messages.CUSTOM_THEME_URL_SUBTITLE}
					value={customTheme}
					placeholder={messages.CUSTOM_THEME_URL_PLACEHOLDER}
					keyboardType='url'
					validate={(value) => {
						const url = value.trim();

						return url && !isThemeUrl(url) ? messages.INVALID_THEME_URL : undefined;
					}}
					onChange={(value) => {
						settings.customTheme = value.trim();
					}}
				/>
			</ui.Section>
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
				<ui.SegmentedRow
					label={messages.LONG_LINES}
					subLabel={messages.LONG_LINES_SUBTITLE}
					value={overflow}
					options={[
						{ value: 'wrap', label: messages.LONG_LINES_WRAP },
						{ value: 'scroll', label: messages.LONG_LINES_SCROLL },
					]}
					onChange={(value) => {
						settings.lineOverflow = value as typeof overflow;
					}}
				/>
			</ui.Section>
			<ui.RadioRow
				title={messages.HIGHLIGHTING_PREFERENCE}
				description={messages.HIGHLIGHTING_PREFERENCE_SUBTITLE}
				value={hljs}
				options={[
					{ value: 'never', label: messages.HLJS_NEVER },
					{ value: 'secondary', label: messages.HLJS_SECONDARY },
					{ value: 'primary', label: messages.HLJS_PRIMARY },
					{ value: 'always', label: messages.HLJS_ALWAYS },
				]}
				onChange={(value) => {
					settings.tryHljs = value as typeof hljs;
				}}
			/>
			<ui.ResetRow onReset={resetSettings} />
		</ui.Page>
	);
}
