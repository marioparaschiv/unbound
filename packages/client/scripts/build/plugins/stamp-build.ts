import type { Plugin } from 'rolldown';

import { clientVersion, gitRevision } from '../constants';

/**
 * @description Fills the revision and version placeholders while each chunk renders, so the dev server's rebuilds carry the current commit instead of the one it started on.
 * @returns The plugin.
 */
export default function stampBuild(): Plugin {
	return {
		name: 'stamp-build',
		renderChunk(code) {
			return code
				.replaceAll('$$VERSION$$', gitRevision())
				.replaceAll('$$CLIENT_VERSION$$', clientVersion());
		},
	};
}
