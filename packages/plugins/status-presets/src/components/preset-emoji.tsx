import { Discord } from '@unbound-app/api/metro/components';
import { Image } from 'react-native';

import useStyles from '~/components/preset-emoji.style';
import type { StatusPreset } from '~/lib/presets';

/**
 * @description A preset's emoji, at a row icon's size: a custom emoji's image or a unicode emoji's glyph.
 * @param props The preset.
 * @returns The emoji, or `null` for a text-only preset.
 */
export function PresetEmoji({ preset }: { preset: StatusPreset }) {
	const styles = useStyles();

	if (preset.emojiId) {
		return (
			<Image
				source={{ uri: `https://cdn.discordapp.com/emojis/${preset.emojiId}.webp?size=48` }}
				style={styles.emoji}
			/>
		);
	}

	return preset.emojiName ? (
		<Discord.Text variant='text-lg/normal' style={styles.glyph}>
			{preset.emojiName}
		</Discord.Text>
	) : null;
}
