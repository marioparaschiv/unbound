import Page from '@unbound-plugins/shared/components/page';
import { Discord } from '@unbound-app/api/metro/components';
import { useState } from 'react';

import { BubbleLimits, BubbleStyle } from '~/constants';
import { parseHexColor } from '~/style';
import { settings } from '~/modules';

type NumberSetting = {
	key: string;
	title: string;
	fallback: number;
	maximum: number;
};

const NUMBER_SETTINGS: NumberSetting[] = [
	{
		key: 'radius',
		title: 'Corner radius',
		fallback: BubbleStyle.radius,
		maximum: BubbleLimits.radius,
	},
	{
		key: 'horizontalPadding',
		title: 'Horizontal padding',
		fallback: BubbleStyle.horizontalPadding,
		maximum: BubbleLimits.padding,
	},
	{
		key: 'verticalPadding',
		title: 'Vertical padding',
		fallback: BubbleStyle.verticalPadding,
		maximum: BubbleLimits.padding,
	},
	{
		key: 'opacity',
		title: 'Opacity (%)',
		fallback: BubbleStyle.opacity,
		maximum: BubbleLimits.opacity,
	},
];

function NumberInput({ setting }: { setting: NumberSetting }) {
	const store = settings.useSettingsStore();
	const [value, setValue] = useState(String(store.get(setting.key, setting.fallback)));

	function save() {
		const number = Number(value);

		if (!Number.isFinite(number)) {
			setValue(String(store.get(setting.key, setting.fallback)));

			return;
		}

		const clamped = Math.max(0, Math.min(setting.maximum, Math.round(number)));

		store.set(setting.key, clamped);
		setValue(String(clamped));
	}

	return (
		<Discord.TextInput
			label={setting.title}
			description={`From 0 to ${setting.maximum}.`}
			value={value}
			onChange={setValue}
			onEndEditing={save}
			onSubmitEditing={save}
			keyboardType='number-pad'
		/>
	);
}

function SettingsPanel() {
	const store = settings.useSettingsStore();
	const [color, setColor] = useState(String(store.get('color', '')));

	function saveColor() {
		const trimmed = color.trim();

		if (trimmed && !parseHexColor(trimmed)) {
			setColor(String(store.get('color', '')));

			return;
		}

		store.set('color', trimmed);
	}

	return (
		<Page>
			{NUMBER_SETTINGS.map((setting) => (
				<NumberInput key={setting.key} setting={setting} />
			))}
			<Discord.TextInput
				label='Color'
				description='A hex color such as #5865F2. Leave it empty to follow the theme: black on dark themes, white on the light theme.'
				value={color}
				onChange={setColor}
				onEndEditing={saveColor}
				onSubmitEditing={saveColor}
				autoCapitalize='none'
				placeholder='#000000'
			/>
		</Page>
	);
}

export default SettingsPanel;
