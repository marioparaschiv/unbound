import { Discord } from '@unbound-app/api/metro/components';
import { Users } from '@unbound-app/api/metro/stores';
import { View } from 'react-native';

import { openReviewsSheet } from '~/components/reviews-sheet';

type ReviewsButtonProps = {
	userId: string;
};

function ReviewsButton({ userId }: ReviewsButtonProps) {
	function open() {
		const user = Users.getUser(userId);

		openReviewsSheet(userId, user?.globalName ?? user?.username ?? 'User');
	}

	return (
		<View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
			<Discord.Button text='View Reviews' variant='secondary' size='sm' onPress={open} />
		</View>
	);
}

export default ReviewsButton;
