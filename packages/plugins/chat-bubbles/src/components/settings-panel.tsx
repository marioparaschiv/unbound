import Page from '@unbound-plugins/shared/components/page';
import SliderRow from '@unbound-plugins/shared/components/slider-row';
import ColorRow from '@unbound-plugins/shared/components/color-row';
import ResetRow from '@unbound-plugins/shared/components/reset-row';
import { Discord } from '@unbound-app/api/metro/components';

import { BubbleLimits, BubbleStyle } from '~/constants';
import { parseHexColor } from '~/style';
import { settings, ThemeStore } from '~/modules';

type NumberSetting = {
	key: string;
	title: string;
	fallback: number;
	maximum: number;
	unit: string;
};

const NUMBER_SETTINGS: NumberSetting[] = [
	{
		key: 'radius',
		title: 'Corner radius',
		fallback: BubbleStyle.radius,
		maximum: BubbleLimits.radius,
		unit: ' pt',
	},
	{
		key: 'horizontalPadding',
		title: 'Horizontal padding',
		fallback: BubbleStyle.horizontalPadding,
		maximum: BubbleLimits.padding,
		unit: ' pt',
	},
	{
		key: 'verticalPadding',
		title: 'Vertical padding',
		fallback: BubbleStyle.verticalPadding,
		maximum: BubbleLimits.padding,
		unit: ' pt',
	},
	{
		key: 'opacity',
		title: 'Opacity',
		fallback: BubbleStyle.opacity,
		maximum: BubbleLimits.opacity,
		unit: '%',
	},
];

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
	const store = settings.useSettingsStore();
	const color = storedColor(store.get('color', ''));
	const ownColor = storedColor(store.get('ownColor', ''));

	return (
		<Page>
			<Discord.TableRowGroup title='Shape'>
				{NUMBER_SETTINGS.map((setting) => (
					<SliderRow
						key={setting.key}
						label={setting.title}
						value={storedNumber(store.get(setting.key, setting.fallback), setting)}
						defaultValue={setting.fallback}
						minimum={0}
						maximum={setting.maximum}
						unit={setting.unit}
						onChange={(value) => store.set(setting.key, value)}
					/>
				))}
			</Discord.TableRowGroup>
			<Discord.TableRowGroup title='Colors'>
				<ColorRow
					label='Bubble color'
					color={color}
					fallbackColor={themeColor()}
					fallbackLabel='Follows the theme: black on dark themes, white on the light theme'
					onChange={(value) => store.set('color', value ?? '')}
				/>
				<ColorRow
					label='Your messages'
					color={ownColor}
					fallbackColor={color ?? themeColor()}
					fallbackLabel='Same as the bubble color'
					onChange={(value) => store.set('ownColor', value ?? '')}
				/>
			</Discord.TableRowGroup>
			<ResetRow
				onReset={() => {
					for (const setting of NUMBER_SETTINGS) store.set(setting.key, setting.fallback);

					store.set('color', '');
					store.set('ownColor', '');
				}}
			/>
		</Page>
	);
}

export default SettingsPanel;
