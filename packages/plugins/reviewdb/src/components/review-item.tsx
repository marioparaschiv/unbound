import { Discord } from '@unbound-app/api/metro/components';
import { assets, dialogs, toasts } from '@unbound-app/api';
import { Image, Pressable, View } from 'react-native';
import { messages } from '@unbound-app/i18n';
import { useState } from 'react';

import {
	deleteReview,
	getCurrentUser,
	reportReview,
	setReviewVote,
	setUserBlocked,
} from '~/lib/api';
import { UserType, type Review } from '~/lib/entities';
import useStyles from '~/components/review-item.style';
import VoteControls from '~/components/vote-controls';
import { getReviewPermissions } from '~/lib/permissions';
import { COMMENT_PREVIEW_LENGTH } from '~/lib/constants';
import { changeVote, type Vote } from '~/lib/votes';
import { UserStore } from '~/lib/modules';

type ReviewItemProps = {
	review: Review;
	profileId: string;
	hideTimestamps: boolean;
	onChanged: () => void;
};

function ReviewItem({ review, profileId, hideTimestamps, onChanged }: ReviewItemProps) {
	const styles = useStyles();
	const [expanded, setExpanded] = useState(false);
	const [busy, setBusy] = useState(false);
	const [vote, setVote] = useState<Vote>(review.userVote ?? null);
	const [score, setScore] = useState(review.score ?? 0);

	const myId = UserStore.getCurrentUser()?.id;
	const account = getCurrentUser();
	const author = review.sender.discordID;
	const isAuthorBlocked = account?.blockedUsers?.includes(author) ?? false;
	const can = getReviewPermissions(review, profileId, {
		id: myId,
		isAdmin: account?.type === UserType.Admin,
	});

	const comment = review.comment ?? '';
	const isLong = comment.length > COMMENT_PREVIEW_LENGTH;
	const showTimestamp = !hideTimestamps && review.timestamp > 0;

	async function run(action: () => Promise<void>) {
		if (busy) return;

		setBusy(true);

		try {
			await action();
		} finally {
			setBusy(false);
		}
	}

	function handleVote(isUpvote: boolean) {
		void run(async () => {
			if (author === myId) {
				toasts.show({ title: messages.REVIEWDB, content: messages.OWN_REVIEW_VOTE });

				return;
			}

			const change = changeVote(vote, isUpvote);

			if (!(await setReviewVote(review.id, change.vote))) return;

			setVote(change.vote);
			setScore((current) => current + change.delta);
		});
	}

	async function confirmDelete() {
		const confirmed = await dialogs.confirm('DELETE_REVIEW', {
			body: 'DELETE_REVIEW_BODY',
			confirm: 'DELETE_REVIEW',
			destructive: true,
		});

		if (confirmed && (await deleteReview(review.id))) onChanged();
	}

	function openActions() {
		const options = [
			can.report && {
				label: messages.REPORT,
				icon: assets.getIdByName('FlagIcon'),
				onPress: () => void run(() => reportReview(review.id)),
			},
			can.block && {
				label: isAuthorBlocked ? messages.UNBLOCK_USER : messages.BLOCK_USER,
				icon: assets.getIdByName('DenyIcon'),
				onPress: () =>
					void run(async () => {
						await setUserBlocked(author, !isAuthorBlocked);
						onChanged();
					}),
			},
			can.delete && {
				label: messages.DELETE_REVIEW,
				icon: assets.getIdByName('TrashIcon'),
				isDestructive: true,
				onPress: () => void run(confirmDelete),
			},
		].filter(Boolean);

		if (!options.length) return;

		Discord.showSimpleActionSheet({
			key: 'reviewdb-review-actions',
			header: { title: review.sender.username },
			options,
		});
	}

	return (
		<Pressable delayLongPress={350} onLongPress={openActions} style={styles.row}>
			<Image source={{ uri: review.sender.profilePhoto }} style={styles.avatar} />
			<View style={styles.body}>
				<View style={styles.header}>
					<Discord.Text
						variant='text-md/semibold'
						color='text-strong'
						numberOfLines={1}
						style={styles.name}
					>
						{review.sender.username}
					</Discord.Text>
					{isAuthorBlocked ? <Discord.Badge type={{ text: messages.BLOCKED }} /> : null}
					{showTimestamp ? (
						<Discord.Text variant='text-xs/medium' color='text-muted'>
							{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
								review.timestamp * 1000,
							)}
						</Discord.Text>
					) : null}
				</View>
				<Discord.Text variant='text-md/normal' color='text-default'>
					{isLong && !expanded ? `${comment.slice(0, COMMENT_PREVIEW_LENGTH)}…` : comment}
				</Discord.Text>
				{isLong ? (
					<Pressable hitSlop={6} onPress={() => setExpanded((value) => !value)}>
						<Discord.Text variant='text-sm/semibold' color='text-link'>
							{expanded ? messages.SHOW_LESS : messages.READ_MORE}
						</Discord.Text>
					</Pressable>
				) : null}
				{can.vote ? (
					<VoteControls vote={vote} score={score} busy={busy} onVote={handleVote} />
				) : null}
			</View>
		</Pressable>
	);
}

export default ReviewItem;
