import { metro } from '@unbound-app/api';
import { Discord } from '@unbound-app/api/metro/components';
import { View } from 'react-native';
import { useEffect, useState } from 'react';

import { parseTypedColor } from './typed-color';

type ActionSheets = {
	openLazy(component: Promise<{ default: unknown }>, key: string, props: object): void;
	hideActionSheet(key: string): void;
};

type ColorRowProps = {
	label: string;
	color: string | undefined;
	fallbackColor: string;
	fallbackLabel: string;
	onChange: (color: string | undefined) => void;
};

const SHEET_KEY = 'PluginColorPicker';

function toInteger(hex: string): number {
	return Number.parseInt(hex.replace('#', '').slice(0, 6), 16) || 0;
}

function toHex(color: number): string {
	return `#${(color & 0xffffff).toString(16).padStart(6, '0').toUpperCase()}`;
}

function openPicker(color: string, onSelect: (color: string) => void): boolean {
	const picker = metro.findByName('CustomColorPickerActionSheet');
	const sheets = metro.findByProps('openLazy', 'hideActionSheet') as ActionSheets | undefined;

	if (!picker || !sheets) return false;

	sheets.openLazy(Promise.resolve({ default: picker }), SHEET_KEY, {
		color: toInteger(color),
		onSelect: (selected: number) => {
			if (selected !== toInteger(color)) onSelect(toHex(selected));

			sheets.hideActionSheet(SHEET_KEY);
		},
	});

	return true;
}

/**
 * @description A settings row that shows a color swatch, opens Discord's color picker when pressed, takes a typed hex code and offers a reset back to the default. A typed code is saved even when it matches the default, which the picker cannot do: Discord's picker reports its current color when it is dismissed, so a pick that matches the color already shown is ignored.
 * @param props The row's label, chosen color, the default it falls back to and the change handler.
 * @returns The row.
 */
function ColorRow({ label, color, fallbackColor, fallbackLabel, onChange }: ColorRowProps) {
	const shown = color ?? fallbackColor;
	const [draft, setDraft] = useState(color ?? '');

	useEffect(() => setDraft(color ?? ''), [color]);

	function saveDraft() {
		const typed = parseTypedColor(draft);

		if (!draft.trim()) {
			onChange(undefined);

			return;
		}

		if (typed) onChange(typed);
		else setDraft(color ?? '');
	}

	return (
		<Discord.TableRow
			label={label}
			subLabel={
				<View style={{ gap: 8 }}>
					<Discord.Text variant='text-sm/medium' color='text-muted'>
						{color ? 'Tap to pick a color, or type a hex code' : fallbackLabel}
					</Discord.Text>
					<Discord.TextInput
						value={draft}
						onChange={setDraft}
						onEndEditing={saveDraft}
						onSubmitEditing={saveDraft}
						placeholder={fallbackColor}
						autoCapitalize='characters'
						autoCorrect={false}
						maxLength={7}
					/>
				</View>
			}
			onPress={() => openPicker(shown, onChange)}
			trailing={
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
					<View
						style={{ opacity: color ? 1 : 0 }}
						pointerEvents={color ? 'auto' : 'none'}
						accessibilityElementsHidden={!color}
						importantForAccessibility={color ? 'auto' : 'no-hide-descendants'}
					>
						<Discord.Button
							size='sm'
							variant='secondary'
							text='Reset'
							onPress={() => onChange(undefined)}
						/>
					</View>
					<View
						style={{
							width: 28,
							height: 28,
							borderRadius: 14,
							backgroundColor: shown,
							borderWidth: 1,
							borderColor: 'rgba(255, 255, 255, 0.24)',
						}}
					/>
				</View>
			}
		/>
	);
}

export default ColorRow;
