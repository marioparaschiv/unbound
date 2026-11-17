import { fonts } from '@unbound-app/api';

import type { ScriptChoices } from '~/lib/choices';
import type { ScriptId } from '~/lib/scripts';

/**
 * @description Looks up the file of each picked face, skipping faces that were uninstalled since.
 * @param choices The face picked for each script.
 * @returns Each script's font file, by absolute path.
 */
export function facePaths(choices: ScriptChoices): Partial<Record<ScriptId, string>> {
	return Object.fromEntries(
		Object.entries(choices).flatMap(([script, id]) => {
			const path = fonts.get(id)?.path;

			return path ? [[script, path]] : [];
		}),
	);
}
