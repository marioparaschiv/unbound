import { metro, patcher } from '@unbound-app/api';
import { cloneElement, isValidElement } from 'react';

/**
 * @description Makes profile bios selectable, so a long press selects text to copy. Patches the render of Discord's
 * `BioText`, which draws the bio on profiles and in the profile editor's preview.
 */
export function patchBioText(): void {
	const BioText = metro.findByFilePath('modules/profile_customization/native/BioText.tsx');

	if (!BioText?.default) {
		logger.warn('Selectable bios skipped: Discord moved BioText.');

		return;
	}

	patcher.react.after(BioText, 'default', ({ result }) =>
		isValidElement(result) ? cloneElement(result, { selectable: true } as object) : result,
	);
}
