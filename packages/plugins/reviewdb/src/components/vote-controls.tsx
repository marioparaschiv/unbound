import { Discord } from '@unbound-app/api/metro/components';
import { Pressable, View, type ColorValue } from 'react-native';
import type { ComponentType } from 'react';
import { metro } from '@unbound-app/api';

import useStyles from '~/components/review-item.style';
import type { Vote } from '~/lib/votes';

type IconProps = { size?: string; color?: ColorValue };

type VoteControlsProps = {
	vote: Vote;
	score: number;
	busy: boolean;
	onVote: (isUpvote: boolean) => void;
};

function icon(name: string): ComponentType<IconProps> | undefined {
	return metro.findByProps(name)?.[name] as ComponentType<IconProps> | undefined;
}

function VoteControls({ vote, score, busy, onVote }: VoteControlsProps) {
	const styles = useStyles();
	const Up = icon('ThumbsUpIcon');
	const Down = icon('ThumbsDownIcon');

	return (
		<View style={styles.footer}>
			<Pressable
				accessibilityRole='button'
				disabled={busy}
				hitSlop={8}
				onPress={() => onVote(true)}
				style={styles.vote}
			>
				{Up ? (
					<Up size='xs' color={(vote === true ? styles.upvoted : styles.idle).color} />
				) : null}
				<Discord.Text
					variant='text-sm/semibold'
					color={vote === true ? 'text-feedback-positive' : 'text-muted'}
				>
					{String(score)}
				</Discord.Text>
			</Pressable>
			<Pressable
				accessibilityRole='button'
				disabled={busy}
				hitSlop={8}
				onPress={() => onVote(false)}
				style={styles.vote}
			>
				{Down ? (
					<Down
						size='xs'
						color={(vote === false ? styles.downvoted : styles.idle).color}
					/>
				) : null}
			</Pressable>
		</View>
	);
}

export default VoteControls;
