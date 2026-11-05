import type { FontSource } from './font-source';

import { familyFromPath, fontFileKind } from './font-file-kind';

/** Any other `https:` link to a `.ttf`, `.otf` or `.zip`, passed through as it is. */
const directFonts: FontSource = {
	provider: 'url',
	match(url) {
		return url.protocol === 'https:' && fontFileKind(url.pathname) ? url.href : undefined;
	},
	async resolve(id) {
		const { pathname } = new URL(id);
		const kind = fontFileKind(pathname);

		if (!kind) return;

		return {
			provider: 'url',
			id,
			family: familyFromPath(pathname),
			files: [{ url: id, kind, weight: null, style: null }],
		};
	},
};

export default directFonts;
