import { Discord } from '@unbound-app/api/metro/components';
import { ScrollView, Text } from 'react-native';
import { flux, metro } from '@unbound-app/api';

import type { DiffPart } from '~/lib/diff';
import useStyles from '~/components/diff-view.style';

type ThemeStore = { theme?: string };

type DiffViewProps = { parts: DiffPart[]; code: boolean };

function color(token: string): string {
	const { Theme } = metro.common;
	const theme = (flux.getStore('Theme') as unknown as ThemeStore).theme ?? Theme.themes.DARK;

	return Theme.internal.resolveSemanticColor(theme, Theme.colors[token]);
}

/**
 * @description Draws an edit's changes inline in Discord's message text: removed text struck through in red, added text
 * in green, and unchanged text in the normal colour, scrolling when long. Code is drawn in Discord's code font.
 * @param props The diff's parts, and whether the message is code.
 * @returns The diff.
 */
export default function DiffView({ parts, code }: DiffViewProps) {
	const styles = useStyles();
	const added = color('TEXT_FEEDBACK_POSITIVE');
	const removed = color('TEXT_FEEDBACK_CRITICAL');

	return (
		<ScrollView style={styles.scroll}>
			<Discord.Text
				variant='body-md/normal'
				color='text-default'
				style={code ? styles.code : undefined}
			>
				{parts.map((part, index) =>
					part.kind === 'same' ? (
						part.text
					) : (
						<Text
							key={index}
							style={
								part.kind === 'added'
									? { color: added, backgroundColor: `${added}26` }
									: {
											color: removed,
											backgroundColor: `${removed}26`,
											textDecorationLine: 'line-through',
										}
							}
						>
							{part.text}
						</Text>
					),
				)}
			</Discord.Text>
		</ScrollView>
	);
}
