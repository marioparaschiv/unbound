import { ScrollView, Text } from 'react-native';
import { flux, metro } from '@unbound-app/api';

import type { DiffPart } from '~/lib/diff';

type ThemeStore = { theme?: string };

type DiffViewProps = { parts: DiffPart[] };

function color(token: string): string {
	const { Theme } = metro.common;
	const theme = (flux.getStore('Theme') as unknown as ThemeStore).theme ?? Theme.themes.DARK;

	return Theme.internal.resolveSemanticColor(theme, Theme.colors[token]);
}

/**
 * @description Draws an edit's changes inline: removed text struck through in red, added text in green, and unchanged
 * text in the normal colour, scrolling when long.
 * @param props The diff's parts.
 * @returns The diff.
 */
export default function DiffView({ parts }: DiffViewProps) {
	const added = color('TEXT_FEEDBACK_POSITIVE');
	const removed = color('TEXT_FEEDBACK_CRITICAL');

	return (
		<ScrollView style={{ maxHeight: 320 }}>
			<Text style={{ color: color('TEXT_DEFAULT'), fontSize: 15, lineHeight: 21 }}>
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
			</Text>
		</ScrollView>
	);
}
