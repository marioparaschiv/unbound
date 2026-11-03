import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { Discord } from '@unbound-app/api/metro/components';
import { assets } from '@unbound-app/api';
import { useState } from 'react';

import type { Upload, UploadChoices } from '~/uploads';

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
				label='Anonymise File Name'
				subLabel={
					anonymise ? 'Using an anonymous file name' : 'Using the original file name'
				}
				value={anonymise}
				onValueChange={onValueChange}
			/>
		);
	}

	const ActionSheetRow = getActionSheetRow();

	return (
		<ActionSheetRow
			label={anonymise ? 'Use Original File Name' : 'Anonymise File Name'}
			icon={icon ? <ActionSheetRow.Icon source={icon} /> : undefined}
			onPress={() => onValueChange(!anonymise)}
		/>
	);
}

export default AnonymiseRow;
