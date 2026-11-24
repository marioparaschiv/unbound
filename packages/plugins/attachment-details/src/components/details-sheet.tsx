import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { BottomSheets, GorhomSheet } from '@unbound-app/api/metro/components';
import { assets, metro, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import useStyles from '~/components/details-sheet.style';
import { detailsOf, type Attachment, type DetailKey } from '~/lib/details';

type DetailsSheetProps = { attachments: Attachment[]; onClose: () => void };

const LABELS: Record<DetailKey, () => string> = {
	name: () => messages.NAME,
	type: () => messages.TYPE,
	originalType: () => messages.ORIGINAL_TYPE,
	size: () => messages.SIZE,
	dimensions: () => messages.DIMENSIONS,
	duration: () => messages.DURATION,
	altText: () => messages.ALT_TEXT,
	spoiler: () => messages.SPOILER,
};

function AttachmentSection({
	attachment,
	heading,
}: {
	attachment: Attachment;
	heading: string | undefined;
}) {
	const ActionSheetRow = getActionSheetRow();
	const link = assets.getIdByName('LinkIcon');

	return (
		<ActionSheetRow.Group title={heading}>
			{detailsOf(attachment).map((detail) => (
				<ActionSheetRow
					key={detail.key}
					label={LABELS[detail.key]()}
					subLabel={detail.value}
				/>
			))}
			{attachment.url ? (
				<ActionSheetRow
					label={messages.COPY_LINK}
					icon={link ? <ActionSheetRow.Icon source={link} /> : undefined}
					onPress={() => {
						metro.common.Clipboard.setString(attachment.url!);
						toasts.success('COPIED');
					}}
				/>
			) : null}
		</ActionSheetRow.Group>
	);
}

/**
 * @description Lists each of a message's attachments with what Discord reports about it, and a row copying its link.
 * @param props The attachments.
 * @returns The sheet.
 */
export default function DetailsSheet({ attachments }: DetailsSheetProps) {
	const styles = useStyles();
	const { ActionSheet, BottomSheetTitleHeader } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;

	return (
		<ActionSheet scrollable>
			<BottomSheetTitleHeader title={messages.TITLE} />
			<ScrollView contentContainerStyle={styles.body}>
				{attachments.map((attachment, index) => (
					<AttachmentSection
						key={attachment.url ?? index}
						attachment={attachment}
						heading={
							attachments.length > 1
								? format('ATTACHMENT', {
										number: index + 1,
										count: attachments.length,
									})
								: undefined
						}
					/>
				))}
			</ScrollView>
		</ActionSheet>
	);
}
