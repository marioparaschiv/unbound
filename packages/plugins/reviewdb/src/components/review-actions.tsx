import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';

import type { ReviewPermissions } from '~/permissions';
import type { ReviewColors } from '~/colors';

type ActionButtonProps = {
	label: string;
	danger?: boolean;
	colors: ReviewColors;
	onPress: () => void;
};

type ReviewActionsProps = {
	can: ReviewPermissions;
	isAuthorBlocked: boolean;
	colors: ReviewColors;
	onReport: () => void;
	onToggleBlock: () => void;
	onDelete: () => void;
	onClose: () => void;
};

function ActionButton({ label, danger = false, colors, onPress }: ActionButtonProps) {
	return (
		<Pressable
			onPress={onPress}
			hitSlop={6}
			style={({ pressed }) => ({
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
			<Text
				style={{
					color: danger ? colors.danger : colors.text,
					fontSize: 13,
					fontWeight: '700',
				}}
			>
				{label}
			</Text>
		</Pressable>
	);
}

function ReviewActions({
	can,
	isAuthorBlocked,
	colors,
	onReport,
	onToggleBlock,
	onDelete,
	onClose,
}: ReviewActionsProps) {
	const [deleteArmed, setDeleteArmed] = useState(false);

	return (
		<View
			style={{
				backgroundColor: colors.surfaceAlt,
				borderColor: colors.border,
				borderRadius: 13,
				borderWidth: 1,
				gap: 10,
				padding: 12,
			}}
		>
			<Text
				style={{
					color: colors.muted,
					fontSize: 11,
					fontWeight: '800',
					letterSpacing: 0.6,
				}}
			>
				REVIEW ACTIONS
			</Text>
			<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
				{can.report ? (
					<ActionButton colors={colors} label='Report' onPress={onReport} />
				) : null}
				{can.block ? (
					<ActionButton
						colors={colors}
						label={isAuthorBlocked ? 'Unblock user' : 'Block user'}
						onPress={onToggleBlock}
					/>
				) : null}
				{can.delete ? (
					<ActionButton
						colors={colors}
						danger
						label={deleteArmed ? 'Confirm delete' : 'Delete review'}
						onPress={deleteArmed ? onDelete : () => setDeleteArmed(true)}
					/>
				) : null}
				<ActionButton colors={colors} label='Close' onPress={onClose} />
			</View>
		</View>
	);
}

export default ReviewActions;
