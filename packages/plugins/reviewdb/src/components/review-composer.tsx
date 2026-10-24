import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useState } from 'react';

import type { ReviewColors } from '~/colors';
import { COMMENT_MAX_LENGTH } from '~/constants';
import { addReview } from '~/api';

type ReviewComposerProps = {
	discordId: string;
	name: string;
	/** Whether the viewer already reviewed this profile, so posting replaces that review. */
	isUpdate: boolean;
	colors: ReviewColors;
	onSubmitted: () => void;
};

function ReviewComposer({ discordId, name, isUpdate, colors, onSubmitted }: ReviewComposerProps) {
	const [comment, setComment] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const trimmed = comment.trim();
	const disabled = !trimmed || submitting;

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
		<View
			style={{
				backgroundColor: colors.surface,
				borderColor: colors.border,
				borderRadius: 16,
				borderWidth: 1,
				gap: 10,
				padding: 14,
			}}
		>
			<View style={{ gap: 4 }}>
				<Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
					{isUpdate ? 'Update your review' : 'Leave a review'}
				</Text>
				<Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
					{isUpdate
						? 'Your new text will replace your existing review.'
						: `Share helpful feedback about @${name}.`}
				</Text>
			</View>
			<TextInput
				maxLength={COMMENT_MAX_LENGTH}
				multiline
				onChangeText={setComment}
				placeholder={isUpdate ? `Update review for @${name}` : `Review @${name}`}
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
			<View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
				<Text style={{ color: colors.muted, flex: 1, fontSize: 12 }}>
					{comment.length}/{COMMENT_MAX_LENGTH}
				</Text>
				<Pressable
					disabled={disabled}
					onPress={() => void submit()}
					style={({ pressed }) => ({
						backgroundColor: colors.accent,
						borderRadius: 11,
						minHeight: 44,
						justifyContent: 'center',
						opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
						paddingHorizontal: 16,
					})}
				>
					{submitting ? (
						<ActivityIndicator color={colors.accentText} />
					) : (
						<Text style={{ color: colors.accentText, fontSize: 14, fontWeight: '800' }}>
							{isUpdate ? 'Update review' : 'Submit review'}
						</Text>
					)}
				</Pressable>
			</View>
		</View>
	);
}

export default ReviewComposer;
