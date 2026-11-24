import { metro } from '@unbound-app/api';
import { Image, Text, View } from 'react-native';

import useStyles from './reaction-preview.style';

type EmojiUtils = { getURL?: (surrogate: string) => string | undefined };

type ReactionPreviewProps = { emoji: string[] };

// Discord draws a unicode reaction from its own image on Android and with the system font on iOS, where `getURL` is ''.
function emojiUrl(emoji: string): string | undefined {
	const utils = metro.findByProps('getURL', 'isEmojiPremiumLocked') as EmojiUtils | undefined;

	return utils?.getURL?.(emoji) || undefined;
}

/**
 * @description The reactions a word spells, each in a pill like the reactions under a message.
 * @param props The emoji, in reaction order.
 */
function ReactionPreview({ emoji }: ReactionPreviewProps) {
	const styles = useStyles();

	return (
		<View style={styles.row}>
			{emoji.map((surrogate, index) => {
				const url = emojiUrl(surrogate);

				return (
					<View key={`${surrogate}-${index}`} style={styles.pill}>
						{url ? (
							<Image
								source={{ uri: url }}
								style={styles.image}
								accessibilityLabel={surrogate}
							/>
						) : (
							<Text style={styles.emoji}>{surrogate}</Text>
						)}
					</View>
				);
			})}
		</View>
	);
}

export default ReactionPreview;
