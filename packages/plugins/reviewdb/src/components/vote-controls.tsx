import { Pressable, Text, View } from 'react-native';

import type { ReviewColors } from '~/colors';
import type { Vote } from '~/votes';

type VoteButtonProps = {
	glyph: string;
	active: boolean;
	activeColor: string;
	busy: boolean;
	colors: ReviewColors;
	onPress: () => void;
};

type VoteControlsProps = {
	vote: Vote;
	score: number;
	busy: boolean;
	colors: ReviewColors;
	onVote: (isUpvote: boolean) => void;
};

function VoteButton({ glyph, active, activeColor, busy, colors, onPress }: VoteButtonProps) {
	return (
		<Pressable
			disabled={busy}
			hitSlop={6}
			onPress={onPress}
			style={({ pressed }) => ({
				alignItems: 'center',
				backgroundColor: active ? `${activeColor}33` : 'transparent',
				borderRadius: 8,
				height: 36,
				justifyContent: 'center',
				opacity: pressed || busy ? 0.6 : 1,
				width: 36,
			})}
		>
			<Text
				style={{
					color: active ? activeColor : colors.muted,
					fontSize: 18,
					fontWeight: '800',
				}}
			>
				{glyph}
			</Text>
		</Pressable>
	);
}

function VoteControls({ vote, score, busy, colors, onVote }: VoteControlsProps) {
	return (
		<View
			style={{
				alignItems: 'center',
				backgroundColor: colors.surfaceAlt,
				borderColor: colors.border,
				borderRadius: 10,
				borderWidth: 1,
				flexDirection: 'row',
				height: 38,
				overflow: 'hidden',
			}}
		>
			<VoteButton
				glyph='▲'
				active={vote === true}
				activeColor={colors.positive}
				busy={busy}
				colors={colors}
				onPress={() => onVote(true)}
			/>
			<Text
				style={{
					color: colors.text,
					fontSize: 14,
					fontWeight: '800',
					minWidth: 24,
					textAlign: 'center',
				}}
			>
				{score}
			</Text>
			<VoteButton
				glyph='▼'
				active={vote === false}
				activeColor={colors.danger}
				busy={busy}
				colors={colors}
				onPress={() => onVote(false)}
			/>
		</View>
	);
}

export default VoteControls;
