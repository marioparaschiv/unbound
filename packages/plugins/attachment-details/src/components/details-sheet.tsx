import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { Discord } from '@unbound-app/api/metro/components';
import { assets, metro, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { View } from 'react-native';

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
		<View style={{ gap: 8, paddingBottom: 16 }}>
			{heading ? (
				<Discord.Text
					variant='text-sm/semibold'
					color='text-muted'
					style={{ paddingHorizontal: 16 }}
				>
					{heading}
				</Discord.Text>
			) : null}
			<ActionSheetRow.Group>
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
		</View>
	);
}

/**
 * @description Lists each of a message's attachments with what Discord reports about it, and a row copying its link.
 * @param props The attachments.
 * @returns The sheet.
 */
export default function DetailsSheet({ attachments }: DetailsSheetProps) {
	return (
		<Discord.ActionSheet>
			<Discord.Text
				variant='heading-lg/semibold'
				style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}
			>
				{messages.TITLE}
			</Discord.Text>
			{attachments.map((attachment, index) => (
				<AttachmentSection
					key={attachment.url ?? index}
					attachment={attachment}
					heading={
						attachments.length > 1
							? format('ATTACHMENT', { number: index + 1, count: attachments.length })
							: undefined
					}
				/>
			))}
		</Discord.ActionSheet>
	);
}
