import { resetSettings, settings, useSetting } from '@unbound-app/settings';
import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

import { BubbleLayout, BubbleLimits, BubbleStyle } from '~/constants';
import { bubbleLayout, parseHexColor } from '~/bubbles/style';
import { ThemeStore } from '~/bubbles/modules';

type NumberKey = 'radius' | 'horizontalPadding' | 'verticalPadding' | 'opacity';

type NumberSetting = {
	key: NumberKey;
	title: string;
	fallback: number;
	maximum: number;
	unit: string;
	dynamicOnly?: boolean;
};

// Built when the panel renders, so each title and unit follows the user's language.
function numberSettings(): NumberSetting[] {
	return [
		{
			key: 'radius',
			title: messages.CORNER_RADIUS,
			fallback: BubbleStyle.radius,
			maximum: BubbleLimits.radius,
			unit: messages.UNIT_POINTS,
		},
		{
			key: 'horizontalPadding',
			title: messages.HORIZONTAL_PADDING,
			fallback: BubbleStyle.horizontalPadding,
			maximum: BubbleLimits.padding,
			unit: messages.UNIT_POINTS,
			dynamicOnly: true,
		},
		{
			key: 'verticalPadding',
			title: messages.VERTICAL_PADDING,
			fallback: BubbleStyle.verticalPadding,
			maximum: BubbleLimits.padding,
			unit: messages.UNIT_POINTS,
			dynamicOnly: true,
		},
		{
			key: 'opacity',
			title: messages.OPACITY,
			fallback: BubbleStyle.opacity,
			maximum: BubbleLimits.opacity,
			unit: messages.UNIT_PERCENT,
		},
	];
}

function storedNumber(value: unknown, setting: NumberSetting): number {
	const number = Number(value);

	return Number.isFinite(number)
		? Math.max(0, Math.min(setting.maximum, Math.round(number)))
		: setting.fallback;
}

function storedColor(value: unknown): string | undefined {
	return typeof value === 'string' && parseHexColor(value.trim()) ? value.trim() : undefined;
}

function themeColor(): string {
	return ThemeStore.theme === 'light' ? '#FFFFFF' : '#000000';
}

function SettingsPanel() {
	const storedLayout = useSetting('layout');
	const color = storedColor(useSetting('color'));
	const ownColor = storedColor(useSetting('ownColor'));
	const values = {
		radius: useSetting('radius'),
		horizontalPadding: useSetting('horizontalPadding'),
		verticalPadding: useSetting('verticalPadding'),
		opacity: useSetting('opacity'),
	};
	const layout = bubbleLayout(storedLayout);
	const shapeSettings = numberSettings().filter(
		(setting) => layout === BubbleLayout.dynamic || !setting.dynamicOnly,
	);

	return (
		<ui.Page>
			<Discord.TableRadioGroup
				title={messages.LAYOUT}
				value={layout}
				onChange={(value: string) => {
					settings.layout = bubbleLayout(value);
				}}
			>
				<Discord.TableRadioRow
					label={messages.LAYOUT_FIT}
					subLabel={messages.LAYOUT_FIT_SUBTITLE}
					value={BubbleLayout.dynamic}
				/>
				<Discord.TableRadioRow
					label={messages.LAYOUT_CARD}
					subLabel={messages.LAYOUT_CARD_SUBTITLE}
					value={BubbleLayout.card}
				/>
			</Discord.TableRadioGroup>
			<ui.Section title={messages.SHAPE}>
				{shapeSettings.map((setting) => (
					<ui.SliderRow
						key={setting.key}
						label={setting.title}
						value={storedNumber(values[setting.key], setting)}
						defaultValue={setting.fallback}
						minimum={0}
						maximum={setting.maximum}
						unit={setting.unit}
						onChange={(value) => {
							settings[setting.key] = value;
						}}
					/>
				))}
			</ui.Section>
			<ui.Section title={messages.COLORS}>
				<ui.ColorRow
					label={messages.BUBBLE_COLOR}
					color={color}
					fallbackColor={themeColor()}
					fallbackLabel={messages.BUBBLE_COLOR_FALLBACK}
					onChange={(value) => {
						settings.color = value ?? '';
					}}
				/>
				<ui.ColorRow
					label={messages.OWN_COLOR}
					color={ownColor}
					fallbackColor={color ?? themeColor()}
					fallbackLabel={messages.OWN_COLOR_FALLBACK}
					onChange={(value) => {
						settings.ownColor = value ?? '';
					}}
				/>
			</ui.Section>
			<ui.ResetRow onReset={resetSettings} />
		</ui.Page>
	);
}

export default SettingsPanel;
