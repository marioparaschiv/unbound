import { openSheet, type SheetProps } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Discord } from '@unbound-app/api/metro/components';
import { useSetting } from '@unbound-app/settings';
import { format, messages } from '@unbound-app/i18n';
import { useCallback, useEffect, useState } from 'react';

import ReviewComposer from '~/components/review-composer';
import useStyles from '~/components/reviews-sheet.style';
import { RelationshipStore, UserStore } from '~/lib/modules';
import { ReviewType } from '~/lib/entities';
import ReviewItem from '~/components/review-item';
import type { UserReviewsData } from '~/lib/entities';
import { getReviews } from '~/lib/api';
import { signIn } from '~/lib/login';

type ReviewsSheetProps = {
	discordId: string;
	name: string;
} & SheetProps;

function ReviewsSheet({ discordId, name, onClose }: ReviewsSheetProps) {
	const hideSystemReviews = useSetting('hideSystemReviews');
	const styles = useStyles();
	const [data, setData] = useState<UserReviewsData | null>(null);
	const [loading, setLoading] = useState(true);

	const myId = UserStore.getCurrentUser()?.id;
	const authorized = Boolean(useSetting('token'));
	const hideBlockedUsers = useSetting('hideBlockedUsers');
	const hideTimestamps = useSetting('hideTimestamps');
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
		(review) =>
			(!hideBlockedUsers || !RelationshipStore.isBlocked?.(review.sender.discordID)) &&
			(!hideSystemReviews || review.type !== ReviewType.System),
	);
	const hasOwnReview = reviews.some((review) => review.sender.discordID === myId);

	const systemReviews = (data?.reviews ?? []).filter(
		(review) => review.type === ReviewType.System && !hideSystemReviews,
	);
	const userReviews = reviews.filter((review) => review.type !== ReviewType.System);

	return (
		<Discord.ActionSheet startExpanded>
			<Discord.BottomSheetTitleHeader
				title={format('REVIEWS_FOR', { name })}
				subtitle={format('REVIEW_COUNT', {
					count: data?.reviewCount ?? userReviews.length,
				})}
			/>
			<ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps='handled'>
				{systemReviews.map((review) => (
					<Discord.InlineNotice
						key={review.id}
						type='info'
						title={review.sender.username}
						message={review.comment}
					/>
				))}

				{loading ? <ActivityIndicator /> : null}

				{!loading && !userReviews.length ? (
					<View style={styles.empty}>
						<Discord.Text variant='heading-md/semibold' color='text-strong'>
							{messages.NO_REVIEWS}
						</Discord.Text>
						<Discord.Text variant='text-sm/normal' color='text-muted'>
							{messages.NO_REVIEWS_SUBTITLE}
						</Discord.Text>
					</View>
				) : null}

				{userReviews.map((review) => (
					<ReviewItem
						key={review.id}
						review={review}
						profileId={discordId}
						hideTimestamps={hideTimestamps}
						onChanged={refetch}
					/>
				))}

				{data?.hasNextPage && !loading ? (
					<Discord.Button
						text={messages.LOAD_MORE}
						variant='secondary'
						onPress={() => void load(data.reviews.length)}
					/>
				) : null}

				{!isOwnProfile && authorized ? (
					<ReviewComposer
						discordId={discordId}
						name={name}
						isUpdate={hasOwnReview}
						onSubmitted={refetch}
					/>
				) : null}

				{!isOwnProfile && !authorized ? (
					<Discord.Button
						text={messages.SIGN_IN_TO_REVIEW}
						variant='secondary'
						onPress={startSignIn}
					/>
				) : null}
			</ScrollView>
		</Discord.ActionSheet>
	);
}

export function openReviewsSheet(discordId: string, name: string): void {
	openSheet(`unbound-reviewdb-${discordId}-${Date.now()}`, ReviewsSheet, { discordId, name });
}

export default ReviewsSheet;
