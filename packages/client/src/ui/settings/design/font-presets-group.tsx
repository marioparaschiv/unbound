import type { UnboundFontPreset } from '@unbound-app/types';

import { openInputDialog } from '~/ui/settings-kit/input-dialog';
import { Discord } from '~/metro/components';
import { icons } from '~/assets/api';
import { format } from '~/i18n/api';

import useFontPresets from './use-font-presets';
import useFonts from './use-fonts';

const PRESET_SHEET = 'unbound-font-preset';

/**
 * @description The Presets group: save the current overrides under a name, paste a copied preset, and
 * one row per preset whose sheet applies, copies or deletes it.
 */
function FontPresetsGroup() {
	const fonts = useFonts();
	const presets = useFontPresets();

	function askName() {
		openInputDialog({
			label: format('UNBOUND_FONTS_PRESET_NAME'),
			value: '',
			variant: 'text',
			keyboardType: 'default',
			maxLength: 64,
			onChange: (name: string) => void presets.save(name),
		});
	}

	function open(preset: UnboundFontPreset) {
		Discord.showSimpleActionSheet({
			key: PRESET_SHEET,
			header: { title: preset.name },
			options: [
				{
					label: format('UNBOUND_FONTS_PRESET_APPLY'),
					icon: icons['CheckmarkLargeIcon'],
					onPress: () => void presets.apply(preset),
				},
				{
					label: format('UNBOUND_FONTS_PRESET_COPY'),
					icon: icons['CopyIcon'],
					onPress: () => presets.copy(preset),
				},
				{
					label: format('UNBOUND_DELETE'),
					icon: icons['TrashIcon'],
					isDestructive: true,
					onPress: () => presets.remove(preset),
				},
			],
		});
	}

	return (
		<Discord.TableRowGroup title={format('UNBOUND_FONTS_PRESETS')}>
			<Discord.TableRow label={format('UNBOUND_FONTS_PRESET_SAVE')} arrow onPress={askName} />
			<Discord.TableRow
				label={format('UNBOUND_FONTS_PRESET_PASTE')}
				arrow
				onPress={() => void presets.paste()}
			/>
			{fonts.getPresets().map((preset) => (
				<Discord.TableRow
					key={preset.id}
					label={preset.name}
					subLabel={format('UNBOUND_FONTS_PRESET_FONTS', {
						count: Object.keys(preset.overrides).length,
					})}
					arrow
					onPress={() => open(preset)}
				/>
			))}
		</Discord.TableRowGroup>
	);
}

export default FontPresetsGroup;
