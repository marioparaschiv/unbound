import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { assets } from '@unbound-app/api';
import { useState } from 'react';

import type { Upload, UploadChoices } from '~/lib/uploads';

type Props = {
	upload: Upload;
	choices: UploadChoices;
};

/**
 * @description A row in an upload's preview sheet that switches its file name between anonymous and original.
 * @param props The upload and the per-upload choices.
 * @returns The row.
 */
export function AnonymiseRow({ upload, choices }: Props) {
	const [anonymise, setAnonymise] = useState(() => choices.isAnonymised(upload));
	const SwitchRow = Discord.ActionSheetSwitchRow;
	const icon = assets.getIdByName(anonymise ? 'EyeSlashIcon' : 'EyeIcon');

	function onValueChange(value: boolean) {
		choices.setAnonymised(upload, value);
		setAnonymise(value);
	}

	if (SwitchRow) {
		return (
			<SwitchRow
				label={messages.ANONYMISE_FILE_NAME}
				subLabel={anonymise ? messages.USING_ANONYMOUS_NAME : messages.USING_ORIGINAL_NAME}
				value={anonymise}
				onValueChange={onValueChange}
			/>
		);
	}

	const ActionSheetRow = getActionSheetRow();

	return (
		<ActionSheetRow
			label={anonymise ? messages.USE_ORIGINAL_FILE_NAME : messages.ANONYMISE_FILE_NAME}
			icon={icon ? <ActionSheetRow.Icon source={icon} /> : undefined}
			onPress={() => onValueChange(!anonymise)}
		/>
	);
}

export default AnonymiseRow;
