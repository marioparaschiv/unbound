import { format, messages } from '@unbound-app/i18n';

import { formatLocation, type PhotoMetadata } from '~/lib/metadata';

export type PhotoReport = { filename: string; metadata: PhotoMetadata; removed: boolean };

/**
 * @description Writes what was found in each photo and what happened to it, for the details dialog.
 * @param reports The photos' metadata and whether it was removed.
 * @returns The dialog's text.
 */
export function describeReports(reports: PhotoReport[]): string {
	return reports
		.map(({ filename, metadata, removed }) =>
			[
				filename,
				metadata.location
					? format('LOCATION', { value: formatLocation(metadata.location) })
					: '',
				metadata.camera ? format('CAMERA', { value: metadata.camera }) : '',
				metadata.takenAt ? format('TAKEN', { value: metadata.takenAt }) : '',
				metadata.software ? format('SOFTWARE', { value: metadata.software }) : '',
				removed ? messages.STATE_REMOVED : messages.STATE_KEPT,
			]
				.filter(Boolean)
				.join('\n'),
		)
		.join('\n\n');
}

export default { describeReports };
