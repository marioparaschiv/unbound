import { Users } from '@unbound-app/api/metro/stores';
import { Image, Pressable, Text, View } from 'react-native';
import { toasts } from '@unbound-app/api';
import { useState } from 'react';

import { deleteReview, getCurrentUser, reportReview, setReviewVote, setUserBlocked } from '~/api';
import { getReviewColors, type ReviewColors } from '~/colors';
import { ReviewType, UserType, type Review } from '~/entities';
import ReviewActions from '~/components/review-actions';
import VoteControls from '~/components/vote-controls';
import { getReviewPermissions } from '~/permissions';
import { COMMENT_PREVIEW_LENGTH } from '~/constants';
import { changeVote, type Vote } from '~/votes';

type BadgeProps = {
	label: string;
	color: string;
	colors: ReviewColors;
};

type ReviewItemProps = {
	review: Review;
	profileId: string;
	hideTimestamps: boolean;
	onChanged: () => void;
};

function Badge({ label, color, colors }: BadgeProps) {
	return (
		<View
			style={{
				backgroundColor: color,
				borderRadius: 6,
				paddingHorizontal: 7,
				paddingVertical: 3,
			}}
		>
			<Text
				style={{
					color: colors.accentText,
					fontSize: 11,
					fontWeight: '800',
					letterSpacing: 0.4,
				}}
			>
				{label}
			</Text>
		</View>
	);
}

function ReviewItem({ review, profileId, hideTimestamps, onChanged }: ReviewItemProps) {
	const colors = getReviewColors();
	const [expanded, setExpanded] = useState(false);
	const [busy, setBusy] = useState(false);
	const [vote, setVote] = useState<Vote>(review.userVote ?? null);
	const [score, setScore] = useState(review.score ?? 0);
	const [actionsVisible, setActionsVisible] = useState(false);

	const myId = Users.getCurrentUser()?.id;
	const account = getCurrentUser();
	const author = review.sender.discordID;
	const isAuthorBlocked = account?.blockedUsers?.includes(author) ?? false;
	const can = getReviewPermissions(review, profileId, {
		id: myId,
		isAdmin: account?.type === UserType.Admin,
	});

	const comment = review.comment ?? '';
	const isLong = comment.length > COMMENT_PREVIEW_LENGTH;
	const showTimestamp =
		!hideTimestamps && review.type !== ReviewType.System && review.timestamp > 0;

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
				toasts.showToast({
					title: 'ReviewDB',
					content: 'You cannot vote on your own review.',
				});

				return;
			}

			const change = changeVote(vote, isUpvote);

			if (!(await setReviewVote(review.id, change.vote))) return;

			setVote(change.vote);
			setScore((current) => current + change.delta);
		});
	}

	function handleDelete() {
		void run(async () => {
			if (await deleteReview(review.id)) {
				onChanged();
			}
		});
	}

	function handleReport() {
		void run(() => reportReview(review.id));
	}

	function handleToggleBlock() {
		void run(async () => {
			await setUserBlocked(author, !isAuthorBlocked);
			onChanged();
		});
	}

	function openActions() {
		if (!can.delete && !can.report && !can.block) return;

		setActionsVisible(true);
	}

	return (
		<View style={{ gap: 8 }}>
			<Pressable
				delayLongPress={350}
				onLongPress={openActions}
				style={({ pressed }) => ({
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderRadius: 16,
					borderWidth: 1,
					opacity: pressed ? 0.82 : 1,
					padding: 14,
				})}
			>
				<View style={{ flexDirection: 'row', gap: 11 }}>
					<Image
						source={{ uri: review.sender.profilePhoto }}
						style={{
							backgroundColor: colors.surfaceAlt,
							borderRadius: 22,
							height: 44,
							width: 44,
						}}
					/>
					<View style={{ flex: 1, gap: 7 }}>
						<View
							style={{
								alignItems: 'center',
								flexDirection: 'row',
								flexWrap: 'wrap',
								gap: 6,
							}}
						>
							<Text
								style={{
									color: colors.text,
									flexShrink: 1,
									fontSize: 16,
									fontWeight: '800',
								}}
								numberOfLines={1}
							>
								{review.sender.username}
							</Text>
							{review.type === ReviewType.System ? (
								<Badge color={colors.accent} colors={colors} label='SYSTEM' />
							) : null}
							{isAuthorBlocked ? (
								<Badge color={colors.danger} colors={colors} label='BLOCKED' />
							) : null}
						</View>
						{showTimestamp ? (
							<Text style={{ color: colors.muted, fontSize: 12 }}>
								{new Intl.DateTimeFormat().format(review.timestamp * 1000)}
							</Text>
						) : null}
					</View>
					{can.vote ? (
						<VoteControls
							vote={vote}
							score={score}
							busy={busy}
							colors={colors}
							onVote={handleVote}
						/>
					) : null}
				</View>

				<View
					style={{
						backgroundColor: colors.border,
						height: 1,
						marginTop: 13,
						opacity: 0.55,
					}}
				/>
				<Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, paddingTop: 12 }}>
					{isLong && !expanded
						? `${comment.slice(0, COMMENT_PREVIEW_LENGTH)}...`
						: comment}
				</Text>
				{isLong ? (
					<Pressable
						hitSlop={6}
						onPress={() => setExpanded((value) => !value)}
						style={{ alignSelf: 'flex-start', marginTop: 6 }}
					>
						<Text style={{ color: colors.link, fontSize: 13, fontWeight: '700' }}>
							{expanded ? 'Show less' : 'Read more'}
						</Text>
					</Pressable>
				) : null}
			</Pressable>

			{actionsVisible ? (
				<ReviewActions
					can={can}
					isAuthorBlocked={isAuthorBlocked}
					colors={colors}
					onReport={handleReport}
					onToggleBlock={handleToggleBlock}
					onDelete={handleDelete}
					onClose={() => setActionsVisible(false)}
				/>
			) : null}
		</View>
	);
}

export default ReviewItem;
