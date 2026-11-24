import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import type { SheetProps } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { BottomSheets } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { assets } from '@unbound-app/api';

import type { PasteFormat } from '~/lib/paste-formats';

type FormatSheetProps = SheetProps & {
	formats: PasteFormat[];
	onPick: (format: PasteFormat) => void;
};

const LABELS: Record<PasteFormat, () => string> = {
	plain: () => messages.PLAIN,
	code: () => messages.CODE,
	quote: () => messages.QUOTE,
	link: () => messages.LINK,
	file: () => messages.FILE,
};

const ICONS: Record<PasteFormat, string> = {
	plain: 'TextIcon',
	code: 'SlashBoxIcon',
	quote: 'QuoteIcon',
	link: 'LinkIcon',
	file: 'FileIcon',
};

function FormatSheet({ formats, onPick, onClose }: FormatSheetProps) {
	const { ActionSheet, BottomSheetTitleHeader } = BottomSheets;
	const ActionSheetRow = getActionSheetRow();

	return (
		<ActionSheet>
			<BottomSheetTitleHeader title={messages.TITLE} />
			<ActionSheetRow.Group>
				{formats.map((format) => {
					const icon = assets.getIdByName(ICONS[format]);

					return (
						<ActionSheetRow
							key={format}
							label={LABELS[format]()}
							icon={icon ? <ActionSheetRow.Icon source={icon} /> : undefined}
							onPress={() => {
								onClose();
								onPick(format);
							}}
						/>
					);
				})}
			</ActionSheetRow.Group>
		</ActionSheet>
	);
}

export default FormatSheet;
