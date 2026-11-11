import { settings } from '@unbound-app/settings';

import { createUploadChoices, type UploadChoices } from '~/lib/uploads';

let choices = createUploadChoices(() => settings);

/**
 * @description Reads the per-upload anonymise choices the patches and the preview sheet's row share.
 * @returns The choices of the current run.
 */
export function uploadChoices(): UploadChoices {
	return choices;
}

/**
 * @description Starts the run with fresh choices, so a file switched off in an earlier run is anonymised by default again.
 */
export function resetUploadChoices(): void {
	choices = createUploadChoices(() => settings);
}
