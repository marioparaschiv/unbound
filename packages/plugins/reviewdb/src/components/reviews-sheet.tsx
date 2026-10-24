import { openSheet, type SheetProps } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Discord } from '@unbound-app/api/metro/components';
import { Users } from '@unbound-app/api/metro/stores';
import { useCallback, useEffect, useState } from 'react';

import ReviewComposer from '~/components/review-composer';
import ReviewsHeader from '~/components/reviews-header';
import { RelationshipStore, settings } from '~/modules';
import { getReviewColors } from '~/colors';
import ReviewItem from '~/components/review-item';
import type { UserReviewsData } from '~/entities';
import { getReviews } from '~/api';
import { signIn } from '~/login';

type ReviewsSheetProps = {
	discordId: string;
	name: string;
} & SheetProps;

function ReviewsSheet({ discordId, name, onClose }: ReviewsSheetProps) {
	const colors = getReviewColors();
	const store = settings.useSettingsStore();
	const [data, setData] = useState<UserReviewsData | null>(null);
	const [loading, setLoading] = useState(true);

	const myId = Users.getCurrentUser()?.id;
	const authorized = Boolean(store.get('token', ''));
	const hideBlockedUsers = store.get('hideBlockedUsers', true);
	const isOwnProfile = discordId === myId;

	const load = useCallback(
		async (offset: number) => {
			setLoading(true);

			const page = await getReviews(discordId, offset);

			setData((previous) =>
				offset && previous
					? { ...page, reviews: [...previous.reviews, ...page.reviews] }
					: page,
			);
			setLoading(false);
		},
		[discordId],
	);

	useEffect(() => {
		void load(0);
	}, [load]);

	function refetch() {
		void load(0);
	}

	function startSignIn() {
		onClose();
		void signIn(() => openReviewsSheet(discordId, name));
	}

	// Optional: without the relationship store, nobody counts as blocked.
	const reviews = (data?.reviews ?? []).filter(
		(review) => !hideBlockedUsers || !RelationshipStore.isBlocked?.(review.sender.discordID),
	);
	const hasOwnReview = reviews.some((review) => review.sender.discordID === myId);

	return (
		<Discord.ActionSheet startExpanded>
			<ScrollView
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
				<ReviewsHeader
					name={name}
					reviewCount={data?.reviewCount ?? reviews.length}
					authorized={authorized}
					colors={colors}
				/>

				{loading ? (
					<View
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
						<ActivityIndicator color={colors.link} />
						<Text style={{ color: colors.muted, fontSize: 14 }}>Loading reviews…</Text>
					</View>
				) : null}

				{!loading && !reviews.length ? (
					<View
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
						<Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
							No reviews yet
						</Text>
						<Text style={{ color: colors.muted, fontSize: 14, textAlign: 'center' }}>
							Be the first person to leave feedback.
						</Text>
					</View>
				) : null}

				{reviews.map((review) => (
					<ReviewItem
						key={review.id}
						review={review}
						profileId={discordId}
						hideTimestamps={store.get('hideTimestamps', false)}
						onChanged={refetch}
					/>
				))}

				{data?.hasNextPage && !loading ? (
					<Pressable
						onPress={() => void load(data.reviews.length)}
						style={({ pressed }) => ({
							alignItems: 'center',
							backgroundColor: colors.surfaceAlt,
							borderColor: colors.border,
							borderRadius: 12,
							borderWidth: 1,
							opacity: pressed ? 0.7 : 1,
							paddingVertical: 13,
						})}
					>
						<Text style={{ color: colors.link, fontSize: 14, fontWeight: '800' }}>
							Load more reviews
						</Text>
					</Pressable>
				) : null}

				{!isOwnProfile && authorized ? (
					<ReviewComposer
						discordId={discordId}
						name={name}
						isUpdate={hasOwnReview}
						colors={colors}
						onSubmitted={refetch}
					/>
				) : null}

				{!isOwnProfile && !authorized ? (
					<Pressable
						onPress={startSignIn}
						style={({ pressed }) => ({
							backgroundColor: colors.surface,
							borderColor: colors.border,
							borderRadius: 16,
							borderWidth: 1,
							opacity: pressed ? 0.7 : 1,
							padding: 16,
						})}
					>
						<Text
							style={{
								color: colors.link,
								fontSize: 15,
								fontWeight: '800',
								textAlign: 'center',
							}}
						>
							Sign in to leave a review
						</Text>
					</Pressable>
				) : null}
			</ScrollView>
		</Discord.ActionSheet>
	);
}

/**
 * @description Opens the sheet listing a profile's reviews, with a form to leave one.
 * @param discordId The Discord ID of the profile.
 * @param name The name shown in the sheet's title.
 */
export function openReviewsSheet(discordId: string, name: string): void {
	openSheet(`unbound-reviewdb-${discordId}-${Date.now()}`, ReviewsSheet, { discordId, name });
}

export default ReviewsSheet;
