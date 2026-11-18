import { isValidElement, type ReactElement } from 'react';
import { metro, patcher } from '@unbound-app/api';

import SelectableBio from '~/components/selectable-bio';

/**
 * @description Makes profile bios selectable where they are shown. Patches the render of Discord's `BioText`, which
 * draws the bio on profiles and in the profile editor's preview.
 */
export function patchBioText(): void {
	const BioText = metro.findByFilePath('modules/profile_customization/native/BioText.tsx');

	if (!BioText?.default) {
		logger.warn('Selectable bios skipped: Discord moved BioText.');

		return;
	}

	patcher.react.after(BioText, 'default', ({ props, result }) =>
		isValidElement(result) ? (
			<SelectableBio text={result as ReactElement<object>} props={props ?? {}} />
		) : (
			result
		),
	);
}
