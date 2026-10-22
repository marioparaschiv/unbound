import { useState } from 'react';

import { metro } from '@unbound-app/api';

import {
	blockUser,
	deleteReview,
	deleteReviewVote,
	reportReview,
	unblockUser,
	voteReview,
} from '@reviewdb/api';
import { getCurrentUser } from '@reviewdb/auth';
import { ReviewType, type Review } from '@reviewdb/entities';
import {
	canBlockReviewAuthor,
	canDeleteReview,
	canReportReview,
	getCurrentUserId,
	showToast,
} from '@reviewdb/utils';
import { getReviewColors, type ReviewColors } from '@reviewdb/sheets/theme';

const dateFormatter = new Intl.DateTimeFormat();

function Badge({ label, color, colors }: { label: string; color: string; colors: ReviewColors }) {
	const ReactNative = metro.common.ReactNative;

	return (
		<ReactNative.View
			style={{
				backgroundColor: color,
				borderRadius: 6,
				paddingHorizontal: 7,
				paddingVertical: 3,
			}}
		>
			<ReactNative.Text
				style={{
					color: colors.accentText,
					fontSize: 11,
					fontWeight: '800',
					letterSpacing: 0.4,
				}}
			>
				{label}
			</ReactNative.Text>
		</ReactNative.View>
	);
}

function ActionButton({
	label,
	onPress,
	danger,
	colors,
}: {
	label: string;
	onPress: () => void;
	danger?: boolean;
	colors: ReviewColors;
}) {
	const ReactNative = metro.common.ReactNative;
	const color = danger ? colors.danger : colors.text;

	return (
		<ReactNative.Pressable
			onPress={onPress}
			hitSlop={6}
			style={({ pressed }: { pressed: boolean }) => ({
				backgroundColor: danger ? `${colors.danger}22` : colors.surface,
				borderColor: danger ? `${colors.danger}66` : colors.border,
				borderRadius: 9,
				borderWidth: 1,
				opacity: pressed ? 0.65 : 1,
				minHeight: 38,
				justifyContent: 'center',
				paddingHorizontal: 12,
			})}
		>
			<ReactNative.Text style={{ color, fontSize: 13, fontWeight: '700' }}>
				{label}
			</ReactNative.Text>
		</ReactNative.Pressable>
	);
}

export default function ReviewItem({
	review,
	profileId,
	hideTimestamps,
	onChanged,
}: {
	review: Review;
	profileId: string;
	hideTimestamps: boolean;
	onChanged(): void;
}) {
	const ReactNative = metro.common.ReactNative;
	const colors = getReviewColors();
	const [expanded, setExpanded] = useState(false);
	const [busy, setBusy] = useState(false);
	const [localVote, setLocalVote] = useState<boolean | null>(review.userVote ?? null);
	const [score, setScore] = useState(review.score ?? 0);
	const [actionsVisible, setActionsVisible] = useState(false);
	const [deleteArmed, setDeleteArmed] = useState(false);

	const myId = getCurrentUserId();
	const isOwnReview = review.sender.discordID === myId;
	const isAuthorBlocked =
		getCurrentUser()?.blockedUsers?.includes(review.sender.discordID) ?? false;

	async function handleVote(isUpvote: boolean) {
		if (busy || review.id === 0) return;
		if (isOwnReview) {
			showToast('You cannot vote on your own review.');
			return;
		}

		setBusy(true);
		try {
			if (localVote === isUpvote) {
				if (await deleteReviewVote(review.id)) {
					setLocalVote(null);
					setScore((current) => current + (isUpvote ? -1 : 1));
				}
				return;
			}

			if (await voteReview(review.id, isUpvote)) {
				const delta = localVote == null ? (isUpvote ? 1 : -1) : isUpvote ? 2 : -2;
				setLocalVote(isUpvote);
				setScore((current) => current + delta);
			}
		} finally {
			setBusy(false);
		}
	}

	async function handleDelete() {
		if (busy) return;
		setBusy(true);
		try {
			if (await deleteReview(review.id)) onChanged();
		} finally {
			setBusy(false);
		}
	}

	async function handleReport() {
		if (busy) return;
		setBusy(true);
		try {
			await reportReview(review.id);
		} finally {
			setBusy(false);
		}
	}

	async function handleBlockToggle() {
		if (busy) return;
		setBusy(true);
		try {
			await (isAuthorBlocked
				? unblockUser(review.sender.discordID)
				: blockUser(review.sender.discordID));
			onChanged();
		} finally {
			setBusy(false);
		}
	}

	const comment = review.comment ?? '';
	const truncated = comment.length > 200 && !expanded;
	const canVote = review.id !== 0;
	const canDelete = canDeleteReview(profileId, review, myId);
	const canReport = canReportReview(review, myId);
	const canBlock = canBlockReviewAuthor(profileId, review, myId);
	const timestamp =
		!hideTimestamps && review.type !== ReviewType.System && review.timestamp > 0
			? dateFormatter.format(review.timestamp * 1000)
			: null;

	const voteControls = canVote ? (
		<ReactNative.View
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
			<ReactNative.Pressable
				disabled={busy}
				hitSlop={6}
				onPress={() => void handleVote(true)}
				style={({ pressed }: { pressed: boolean }) => ({
					alignItems: 'center',
					backgroundColor: localVote === true ? `${colors.positive}33` : 'transparent',
					borderRadius: 8,
					height: 36,
					justifyContent: 'center',
					opacity: pressed || busy ? 0.6 : 1,
					width: 36,
				})}
			>
				<ReactNative.Text
					style={{
						color: localVote === true ? colors.positive : colors.muted,
						fontSize: 18,
						fontWeight: '800',
					}}
				>
					▲
				</ReactNative.Text>
			</ReactNative.Pressable>
			<ReactNative.Text
				style={{
					color: colors.text,
					fontSize: 14,
					fontWeight: '800',
					minWidth: 24,
					textAlign: 'center',
				}}
			>
				{score}
			</ReactNative.Text>
			<ReactNative.Pressable
				disabled={busy}
				hitSlop={6}
				onPress={() => void handleVote(false)}
				style={({ pressed }: { pressed: boolean }) => ({
					alignItems: 'center',
					backgroundColor: localVote === false ? `${colors.danger}33` : 'transparent',
					borderRadius: 8,
					height: 36,
					justifyContent: 'center',
					opacity: pressed || busy ? 0.6 : 1,
					width: 36,
				})}
			>
				<ReactNative.Text
					style={{
						color: localVote === false ? colors.danger : colors.muted,
						fontSize: 18,
						fontWeight: '800',
					}}
				>
					▼
				</ReactNative.Text>
			</ReactNative.Pressable>
		</ReactNative.View>
	) : null;

	function openReviewActions() {
		if (!canDelete && !canReport && !canBlock) return;
		setDeleteArmed(false);
		setActionsVisible(true);
	}

	return (
		<ReactNative.View style={{ gap: 8 }}>
			<ReactNative.Pressable
				delayLongPress={350}
				onLongPress={openReviewActions}
				style={({ pressed }: { pressed: boolean }) => ({
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderRadius: 16,
					borderWidth: 1,
					opacity: pressed ? 0.82 : 1,
					padding: 14,
				})}
			>
				<ReactNative.View style={{ flexDirection: 'row', gap: 11 }}>
					<ReactNative.Image
						source={{ uri: review.sender.profilePhoto }}
						style={{
							backgroundColor: colors.surfaceAlt,
							borderRadius: 22,
							height: 44,
							width: 44,
						}}
					/>
					<ReactNative.View style={{ flex: 1, gap: 7 }}>
						<ReactNative.View
							style={{
								alignItems: 'center',
								flexDirection: 'row',
								flexWrap: 'wrap',
								gap: 6,
							}}
						>
							<ReactNative.Text
								style={{
									color: colors.text,
									flexShrink: 1,
									fontSize: 16,
									fontWeight: '800',
								}}
								numberOfLines={1}
							>
								{review.sender.username}
							</ReactNative.Text>
							{review.type === ReviewType.System && (
								<Badge color={colors.accent} colors={colors} label='SYSTEM' />
							)}
							{isAuthorBlocked && (
								<Badge color={colors.danger} colors={colors} label='BLOCKED' />
							)}
						</ReactNative.View>
						{timestamp && (
							<ReactNative.Text style={{ color: colors.muted, fontSize: 12 }}>
								{timestamp}
							</ReactNative.Text>
						)}
					</ReactNative.View>
					{voteControls}
				</ReactNative.View>

				<ReactNative.View
					style={{
						backgroundColor: colors.border,
						height: 1,
						marginTop: 13,
						opacity: 0.55,
					}}
				/>
				<ReactNative.Text
					style={{ color: colors.text, fontSize: 15, lineHeight: 22, paddingTop: 12 }}
				>
					{truncated ? `${comment.slice(0, 200)}...` : comment}
				</ReactNative.Text>
				{comment.length > 200 && (
					<ReactNative.Pressable
						hitSlop={6}
						onPress={() => setExpanded((value) => !value)}
						style={{ alignSelf: 'flex-start', marginTop: 6 }}
					>
						<ReactNative.Text
							style={{ color: colors.link, fontSize: 13, fontWeight: '700' }}
						>
							{expanded ? 'Show less' : 'Read more'}
						</ReactNative.Text>
					</ReactNative.Pressable>
				)}
			</ReactNative.Pressable>

			{actionsVisible && (
				<ReactNative.View
					style={{
						backgroundColor: colors.surfaceAlt,
						borderColor: colors.border,
						borderRadius: 13,
						borderWidth: 1,
						gap: 10,
						padding: 12,
					}}
				>
					<ReactNative.Text
						style={{
							color: colors.muted,
							fontSize: 11,
							fontWeight: '800',
							letterSpacing: 0.6,
						}}
					>
						REVIEW ACTIONS
					</ReactNative.Text>
					<ReactNative.View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
						{canReport && (
							<ActionButton
								colors={colors}
								label='Report'
								onPress={() => void handleReport()}
							/>
						)}
						{canBlock && (
							<ActionButton
								colors={colors}
								label={isAuthorBlocked ? 'Unblock user' : 'Block user'}
								onPress={() => void handleBlockToggle()}
							/>
						)}
						{canDelete && (
							<ActionButton
								colors={colors}
								danger
								label={deleteArmed ? 'Confirm delete' : 'Delete review'}
								onPress={() => {
									if (deleteArmed) void handleDelete();
									else setDeleteArmed(true);
								}}
							/>
						)}
						<ActionButton
							colors={colors}
							label='Close'
							onPress={() => setActionsVisible(false)}
						/>
					</ReactNative.View>
				</ReactNative.View>
			)}
		</ReactNative.View>
	);
}
