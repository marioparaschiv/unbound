import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { View } from 'react-native';

import { openReviewsSheet } from '~/components/reviews-sheet';
import { UserStore } from '~/lib/modules';

type ReviewsButtonProps = {
	userId: string;
};

function ReviewsButton({ userId }: ReviewsButtonProps) {
	function open() {
		const user = UserStore.getUser(userId);

		openReviewsSheet(userId, user?.globalName ?? user?.username ?? messages.USER);
	}

	return (
		<View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
			<Discord.Button
				text={messages.VIEW_REVIEWS}
				variant='secondary'
				size='sm'
				onPress={open}
			/>
		</View>
	);
}

export default ReviewsButton;
