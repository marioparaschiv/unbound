import { useCallback, useEffect, useState } from 'react';

import { metro, storage } from '@unbound-app/api';

import { addReview, getReviews, REVIEWS_PER_PAGE, type UserReviewsData } from '@reviewdb/api';
import { authorize } from '@reviewdb/auth';
import { getCurrentUserId, isRelationshipBlocked, showToast } from '@reviewdb/utils';

import ReviewItem from '@reviewdb/sheets/ReviewItem';
import { getReviewColors } from '@reviewdb/sheets/theme';

const STORE = storage.getStore('unbound.reviewdb');

function getDesignModule(): {
	ActionSheet?: any;
} | null {
	const discord = (metro as { components?: { Discord?: unknown } } | undefined)?.components
		?.Discord as { ActionSheet?: any } | undefined;
	if (discord?.ActionSheet) return discord;

	if (typeof metro?.findByProps === 'function') {
		const found = metro.findByProps('ActionSheet') as { ActionSheet?: any } | null;
		if (found?.ActionSheet) return found;
	}

	return null;
}

function ReviewsSheet({
	discordId,
	name,
	onClose,
}: {
	discordId: string;
	name: string;
	onClose(): void;
}) {
	const ReactNative = metro.common.ReactNative;
	const Discord = getDesignModule();
	const colors = getReviewColors();
	const [data, setData] = useState<UserReviewsData | null>(null);
	const [loading, setLoading] = useState(true);
	const [comment, setComment] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const state = STORE.useSettingsStore();

	const myId = getCurrentUserId();
	const hideTimestamps = state.get('hideTimestamps', false);
	const hideBlockedUsers = state.get('hideBlockedUsers', true);

	const load = useCallback(
		async (offset: number, append: boolean) => {
			setLoading(true);
			const result = await getReviews(discordId, {
				offset,
				limit: REVIEWS_PER_PAGE,
				fetchVotes: true,
			});
			setData((previous) =>
				append && previous
					? { ...result, reviews: [...previous.reviews, ...result.reviews] }
					: result,
			);
			setLoading(false);
		},
		[discordId],
	);

	useEffect(() => {
		void load(0, false);
	}, [load]);

	function refetch() {
		void load(0, false);
	}

	const visibleReviews = (data?.reviews ?? []).filter(
		(review) => !hideBlockedUsers || !isRelationshipBlocked(review.sender.discordID),
	);
	const ownReview = visibleReviews.find((review) => review.sender.discordID === myId);
	const isOwnProfile = myId != null && discordId === myId;
	const authorized = !!state.get('token', '');

	async function submit() {
		const trimmed = comment.trim();
		if (!trimmed) return;

		setSubmitting(true);
		try {
			const result = await addReview({ userid: discordId, comment: trimmed });
			if (result) {
				setComment('');
				refetch();
			}
		} finally {
			setSubmitting(false);
		}
	}

	if (!Discord?.ActionSheet) {
		return (
			<ReactNative.View style={{ backgroundColor: colors.page, flex: 1, padding: 16 }}>
				<ReactNative.Text style={{ color: colors.text }}>
					Reviews are unavailable on this client build.
				</ReactNative.Text>
			</ReactNative.View>
		);
	}

	const content = (
		<ReactNative.ScrollView
			contentContainerStyle={{
				backgroundColor: colors.page,
				gap: 12,
				padding: 16,
				paddingBottom: 32,
			}}
			keyboardShouldPersistTaps='handled'
			style={{
				backgroundColor: colors.page,
				borderTopLeftRadius: 20,
				borderTopRightRadius: 20,
				overflow: 'hidden',
			}}
		>
			<ReactNative.View style={{ gap: 8, paddingBottom: 4 }}>
				<ReactNative.Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>
					Reviews for @{name}
				</ReactNative.Text>
				<ReactNative.Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
					Community feedback shared through ReviewDB.
				</ReactNative.Text>
				<ReactNative.View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
					<ReactNative.View
						style={{
							backgroundColor: colors.surfaceAlt,
							borderColor: colors.border,
							borderRadius: 8,
							borderWidth: 1,
							paddingHorizontal: 9,
							paddingVertical: 5,
						}}
					>
						<ReactNative.Text
							style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}
						>
							{data?.reviewCount ?? visibleReviews.length} reviews
						</ReactNative.Text>
					</ReactNative.View>
					{authorized && (
						<ReactNative.View
							style={{
								backgroundColor: `${colors.positive}22`,
								borderColor: `${colors.positive}66`,
								borderRadius: 8,
								borderWidth: 1,
								paddingHorizontal: 9,
								paddingVertical: 5,
							}}
						>
							<ReactNative.Text
								style={{ color: colors.positive, fontSize: 12, fontWeight: '700' }}
							>
								ReviewDB connected
							</ReactNative.Text>
						</ReactNative.View>
					)}
				</ReactNative.View>
			</ReactNative.View>

			{loading && (
				<ReactNative.View
					style={{
						alignItems: 'center',
						backgroundColor: colors.surface,
						borderColor: colors.border,
						borderRadius: 16,
						borderWidth: 1,
						gap: 8,
						padding: 28,
					}}
				>
					<ReactNative.ActivityIndicator color={colors.link} />
					<ReactNative.Text style={{ color: colors.muted, fontSize: 14 }}>
						Loading reviews…
					</ReactNative.Text>
				</ReactNative.View>
			)}

			{!loading && visibleReviews.length === 0 && (
				<ReactNative.View
					style={{
						alignItems: 'center',
						backgroundColor: colors.surface,
						borderColor: colors.border,
						borderRadius: 16,
						borderWidth: 1,
						gap: 6,
						padding: 24,
					}}
				>
					<ReactNative.Text
						style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}
					>
						No reviews yet
					</ReactNative.Text>
					<ReactNative.Text
						style={{ color: colors.muted, fontSize: 14, textAlign: 'center' }}
					>
						Be the first person to leave feedback.
					</ReactNative.Text>
				</ReactNative.View>
			)}

			{visibleReviews.map((review) => (
				<ReviewItem
					key={review.id}
					review={review}
					profileId={discordId}
					hideTimestamps={hideTimestamps}
					onChanged={refetch}
				/>
			))}

			{data?.hasNextPage && !loading && (
				<ReactNative.Pressable
					onPress={() => void load(data.reviews.length, true)}
					style={({ pressed }: { pressed: boolean }) => ({
						alignItems: 'center',
						backgroundColor: colors.surfaceAlt,
						borderColor: colors.border,
						borderRadius: 12,
						borderWidth: 1,
						opacity: pressed ? 0.7 : 1,
						paddingVertical: 13,
					})}
				>
					<ReactNative.Text
						style={{ color: colors.link, fontSize: 14, fontWeight: '800' }}
					>
						Load more reviews
					</ReactNative.Text>
				</ReactNative.Pressable>
			)}

			{!isOwnProfile && authorized && (
				<ReactNative.View
					style={{
						backgroundColor: colors.surface,
						borderColor: colors.border,
						borderRadius: 16,
						borderWidth: 1,
						gap: 10,
						padding: 14,
					}}
				>
					<ReactNative.View style={{ gap: 4 }}>
						<ReactNative.Text
							style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}
						>
							{ownReview ? 'Update your review' : 'Leave a review'}
						</ReactNative.Text>
						<ReactNative.Text
							style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}
						>
							{ownReview
								? 'Your new text will replace your existing review.'
								: `Share helpful feedback about @${name}.`}
						</ReactNative.Text>
					</ReactNative.View>
					<ReactNative.TextInput
						maxLength={1000}
						multiline
						onChangeText={setComment}
						placeholder={ownReview ? `Update review for @${name}` : `Review @${name}`}
						placeholderTextColor={colors.muted}
						style={{
							backgroundColor: colors.input,
							borderColor: colors.border,
							borderRadius: 12,
							borderWidth: 1,
							color: colors.text,
							fontSize: 15,
							minHeight: 92,
							paddingHorizontal: 12,
							paddingVertical: 11,
							textAlignVertical: 'top',
						}}
						value={comment}
					/>
					<ReactNative.View
						style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}
					>
						<ReactNative.Text style={{ color: colors.muted, flex: 1, fontSize: 12 }}>
							{comment.length}/1000
						</ReactNative.Text>
						<ReactNative.Pressable
							disabled={!comment.trim() || submitting}
							onPress={() => void submit()}
							style={({ pressed }: { pressed: boolean }) => ({
								backgroundColor: colors.accent,
								borderRadius: 11,
								minHeight: 44,
								justifyContent: 'center',
								opacity: !comment.trim() || submitting ? 0.45 : pressed ? 0.75 : 1,
								paddingHorizontal: 16,
							})}
						>
							{submitting ? (
								<ReactNative.ActivityIndicator color={colors.accentText} />
							) : (
								<ReactNative.Text
									style={{
										color: colors.accentText,
										fontSize: 14,
										fontWeight: '800',
									}}
								>
									{ownReview ? 'Update review' : 'Submit review'}
								</ReactNative.Text>
							)}
						</ReactNative.Pressable>
					</ReactNative.View>
				</ReactNative.View>
			)}

			{!isOwnProfile && !authorized && (
				<ReactNative.Pressable
					onPress={() => {
						onClose();
						authorize(() => openReviewsSheet(discordId, name));
					}}
					style={({ pressed }: { pressed: boolean }) => ({
						backgroundColor: colors.surface,
						borderColor: colors.border,
						borderRadius: 16,
						borderWidth: 1,
						opacity: pressed ? 0.7 : 1,
						padding: 16,
					})}
				>
					<ReactNative.Text
						style={{
							color: colors.link,
							fontSize: 15,
							fontWeight: '800',
							textAlign: 'center',
						}}
					>
						Sign in to leave a review
					</ReactNative.Text>
				</ReactNative.Pressable>
			)}
		</ReactNative.ScrollView>
	);

	return <Discord.ActionSheet startExpanded>{content}</Discord.ActionSheet>;
}

export function openReviewsSheet(discordId: string, name: string): void {
	if (typeof metro?.findByProps !== 'function') return;

	const sheets = metro.findByProps('openLazy', 'hideActionSheet') as {
		openLazy?: (...args: unknown[]) => unknown;
		hideActionSheet?: (key: string) => void;
	} | null;
	if (!sheets?.openLazy) {
		showToast('Reviews are unavailable on this client build.');
		return;
	}

	const key = `unbound-reviewdb-${discordId}-${Date.now()}`;

	sheets.openLazy(Promise.resolve({ default: ReviewsSheet }), key, {
		discordId,
		name,
		onClose: () => sheets.hideActionSheet?.(key),
	});
}

export default ReviewsSheet;
