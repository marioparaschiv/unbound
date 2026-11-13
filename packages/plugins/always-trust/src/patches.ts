import { flux, metro, patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import '~/lib/types';

/**
 * @description Treats every link as going to a trusted site, so Discord opens it without its "Leaving Discord" check.
 * Patches `isTrustedDomain` on Discord's MaskedLink store.
 */
export function patchTrustedDomains(): void {
	if (!settings.domain) return;

	const MaskedLinkStore = flux.getStore('MaskedLink');

	if (typeof MaskedLinkStore?.isTrustedDomain !== 'function') {
		logger.warn('Trusted links skipped: Discord moved MaskedLinkStore.');

		return;
	}

	patcher.instead(MaskedLinkStore, 'isTrustedDomain', () => true);
}

/**
 * @description Treats no download as suspicious, so Discord starts it without its warning.
 * Patches `isSuspiciousDownload` in Discord's suspicious download utilities.
 */
export function patchSuspiciousDownloads(): void {
	if (!settings.file) return;

	const Downloads = metro.findByFilePath(
		'modules/suspicious_downloads/SuspiciousDownloadUtils.tsx',
	);

	if (typeof Downloads?.isSuspiciousDownload !== 'function') {
		logger.warn('Trusted downloads skipped: Discord moved SuspiciousDownloadUtils.');

		return;
	}

	patcher.instead(Downloads, 'isSuspiciousDownload', () => null);
}
