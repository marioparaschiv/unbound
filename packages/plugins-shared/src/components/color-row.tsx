import { metro } from '@unbound-app/api';
import { Discord } from '@unbound-app/api/metro/components';
import { View } from 'react-native';

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
 * @description A settings row that shows a color swatch, opens Discord's color picker when pressed and offers a reset back to the default.
 * @param props The row's label, chosen color, the default it falls back to and the change handler.
 * @returns The row.
 */
function ColorRow({ label, color, fallbackColor, fallbackLabel, onChange }: ColorRowProps) {
	const shown = color ?? fallbackColor;

	return (
		<Discord.TableRow
			label={label}
			subLabel={color ?? fallbackLabel}
			onPress={() => openPicker(shown, onChange)}
			trailing={
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
					{color ? (
						<Discord.Button
							size='sm'
							variant='secondary'
							text='Reset'
							onPress={() => onChange(undefined)}
						/>
					) : null}
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
