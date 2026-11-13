import { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { View } from 'react-native';
import { useState } from 'react';

import useStyles from '~/components/reviews-sheet.style';
import { COMMENT_MAX_LENGTH } from '~/lib/constants';
import { addReview } from '~/lib/api';

type ReviewComposerProps = {
	discordId: string;
	name: string;
	/** Whether the viewer already reviewed this profile, so posting replaces that review. */
	isUpdate: boolean;
	onSubmitted: () => void;
};

function ReviewComposer({ discordId, name, isUpdate, onSubmitted }: ReviewComposerProps) {
	const styles = useStyles();
	const [comment, setComment] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const trimmed = comment.trim();

	async function submit() {
		if (!trimmed) return;

		setSubmitting(true);

		try {
			if (await addReview(discordId, trimmed)) {
				setComment('');
				onSubmitted();
			}
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<View style={styles.composer}>
			<Discord.TextArea
				label={isUpdate ? messages.UPDATE_YOUR_REVIEW : messages.LEAVE_A_REVIEW}
				description={isUpdate ? messages.UPDATE_REPLACES : undefined}
				placeholder={
					isUpdate
						? format('UPDATE_PLACEHOLDER', { name })
						: format('REVIEW_PLACEHOLDER', { name })
				}
				maxLength={COMMENT_MAX_LENGTH}
				value={comment}
				onChangeText={setComment}
			/>
			<Discord.Button
				text={isUpdate ? messages.UPDATE_REVIEW : messages.SUBMIT_REVIEW}
				disabled={!trimmed}
				loading={submitting}
				onPress={() => void submit()}
			/>
		</View>
	);
}

export default ReviewComposer;
