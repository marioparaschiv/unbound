import { useSetting, type Settings } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { useState } from 'react';
import { View } from 'react-native';

import PreviewMessage, { type Size } from '~/preview/preview-message';
import { previewPaints, type PreviewBubble } from '~/preview/preview-paint';
import { bubbleAppearance, type BubbleAppearance } from '~/bubbles/style';
import useStyles from '~/preview/chat-preview.style';
import { themeBubbleColor } from '~/bubbles/theme';
import { Grouping } from '~/constants';

type Sample = { own: boolean; mention: boolean; text: string };

// Built when the preview renders, so the sample follows the user's language.
function sampleGroups(): Sample[][] {
	return [
		[
			{ own: false, mention: false, text: messages.PREVIEW_FRIEND_FIRST },
			{ own: false, mention: false, text: messages.PREVIEW_FRIEND_SECOND },
			{ own: false, mention: true, text: messages.PREVIEW_FRIEND_THIRD },
		],
		[
			{ own: true, mention: false, text: messages.PREVIEW_YOU_FIRST },
			{ own: true, mention: false, text: messages.PREVIEW_YOU_SECOND },
		],
	];
}

// Every setting the bubbles' look reads, so the preview follows each change.
const LOOK_KEYS: (keyof Settings)[] = [
	'layout',
	'radius',
	'horizontalPadding',
	'verticalPadding',
	'spacing',
	'opacity',
	'blur',
	'mediaCorners',
	'cornerCurve',
	'grouping',
	'roundExposed',
	'roundOuter',
	'joinCurves',
	'smoothSteps',
	'groupSpacing',
	'roomyRows',
	'avatarLast',
	'nameInside',
	'reply',
	'tail',
	'tailSize',
	'color',
	'ownColor',
	'mentionColor',
	'mentionOpacity',
	'mentionTint',
	'mentionWidth',
];

function useAppearance(): BubbleAppearance {
	const look = Object.fromEntries(LOOK_KEYS.map((key) => [key, useSetting(key)]));

	return bubbleAppearance((key) => look[key], themeBubbleColor());
}

function sameSize(a: Size | undefined, b: Size): boolean {
	return a !== undefined && a.width === b.width && a.height === b.height;
}

/**
 * @description A short sample chat drawn with the plugin's current settings, so each change shows as it is made.
 * @returns The preview.
 */
function ChatPreview() {
	const styles = useStyles();
	const style = useAppearance();
	const [sizes, setSizes] = useState<Size[]>([]);
	const groups = sampleGroups();
	const samples = groups.flatMap((group) =>
		group.map((sample, index) => ({
			...sample,
			start: index === 0,
			end: index === group.length - 1,
		})),
	);
	const measured = samples.every((_, index) => sizes[index] !== undefined);
	const paints = measured
		? previewPaints(
				samples.map((sample, index): PreviewBubble => ({ ...sample, ...sizes[index]! })),
				style,
			)
		: [];
	const inside = style.grouping === Grouping.joined ? 0 : style.groupSpacing;

	function measure(index: number, size: Size) {
		const rounded = { width: Math.round(size.width), height: Math.round(size.height) };

		setSizes((previous) => {
			if (sameSize(previous[index], rounded)) return previous;

			const next = [...previous];

			next[index] = rounded;

			return next;
		});
	}

	return (
		<View style={styles.preview}>
			{samples.map((sample, index) => (
				<PreviewMessage
					key={index}
					author={sample.own ? messages.PREVIEW_YOU : messages.PREVIEW_FRIEND}
					avatarColor={sample.own ? '#3BA55C' : '#5865F2'}
					text={sample.text}
					mention={sample.mention}
					start={sample.start}
					end={sample.end}
					gap={index === 0 ? 0 : sample.start ? style.spacing : inside}
					style={style}
					paint={paints[index]}
					onMeasure={(size) => measure(index, size)}
				/>
			))}
		</View>
	);
}

export default ChatPreview;
