import type { FontSource } from './font-source';

import { familyFromPath, fontFileKind } from './font-file-kind';

/**
 * GitHub files and release assets. A `blob/` or `raw/` page link becomes its
 * `raw.githubusercontent.com` download; the id is that download URL.
 */
const githubFonts: FontSource = {
	provider: 'github',
	match(url) {
		if (url.hostname === 'raw.githubusercontent.com') {
			return fontFileKind(url.pathname) ? url.href : undefined;
		}

		if (url.hostname !== 'github.com' || !fontFileKind(url.pathname)) return;

		const [, owner, repository, kind, ...rest] = url.pathname.split('/');

		if (!owner || !repository || rest.length < 2) return;

		if (kind === 'blob' || kind === 'raw') {
			return `https://raw.githubusercontent.com/${owner}/${repository}/${rest.join('/')}`;
		}

		return kind === 'releases' && rest[0] === 'download' ? url.href : undefined;
	},
	async resolve(id) {
		const { pathname } = new URL(id);
		const kind = fontFileKind(pathname);

		if (!kind) return;

		return {
			provider: 'github',
			id,
			family: familyFromPath(pathname),
			files: [{ url: id, kind, weight: null, style: null }],
		};
	},
};

export default githubFonts;
