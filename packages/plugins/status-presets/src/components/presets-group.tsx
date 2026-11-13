import { Discord } from '@unbound-app/api/metro/components';
import { assets } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { settings, useSetting } from '@unbound-app/settings';

import { PresetEmoji } from '~/components/preset-emoji';
import {
	addPreset,
	parsePresets,
	removePreset,
	samePreset,
	type StatusPreset,
} from '~/lib/presets';
import { applyPreset, useCurrentPreset } from '~/lib/status';

function save(presets: StatusPreset[]) {
	settings.presets = JSON.stringify(presets);
}

/**
 * @description The Presets group on the Set your status screen: each preset sets the status and closes the screen, and a
 * row saves the status set now.
 * @param props What closes the screen.
 * @returns The group.
 */
export function PresetsGroup({ onClose }: { onClose?: () => void }) {
	const presets = parsePresets(useSetting('presets'));
	const current = useCurrentPreset();
	const saved = Boolean(current && presets.some((preset) => samePreset(preset, current)));

	return (
		<Discord.TableRowGroup title={messages.PRESETS} hasIcons>
			{presets.map((preset) => {
				const name = preset.text || messages.EMOJI_ONLY;

				return (
					<Discord.TableRow
						key={`${preset.emojiId}:${preset.emojiName}:${preset.text}`}
						label={name}
						labelLineClamp={1}
						icon={<PresetEmoji preset={preset} />}
						onPress={() => {
							applyPreset(preset);
							onClose?.();
						}}
						trailing={
							<Discord.IconButton
								size='sm'
								variant='secondary'
								icon={assets.getIdByName('TrashIcon')}
								accessibilityLabel={format('REMOVE_PRESET', { name })}
								onPress={() => save(removePreset(presets, preset))}
							/>
						}
					/>
				);
			})}
			<Discord.TableRow
				label={messages.SAVE_CURRENT}
				subLabel={messages.SAVE_CURRENT_SUBTITLE}
				icon={<Discord.TableRow.Icon source={assets.getIdByName('PlusSmallIcon')} />}
				disabled={!current || saved}
				onPress={() => {
					if (current) save(addPreset(presets, current));
				}}
			/>
		</Discord.TableRowGroup>
	);
}
