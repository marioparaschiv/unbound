import { BADGE_NAME_MAX_LENGTH } from '@unbound-app/contracts/sponsors';
import type { OwnedBadge } from '@unbound-app/contracts/sponsors';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { uploadBadgeImageMutation } from '~/queries/account/account';
import checkBadgeFile from '~/components/account/check-badge-file';
import getApiErrorMessage from '~/lib/api/error-message';

/** Where a draft's image is: being checked and uploaded, stored, or refused with the rule it broke. */
export type BadgeUpload =
	| { kind: 'uploading' }
	| { kind: 'ready'; image: string; imageUrl: string }
	| { kind: 'rejected'; problem: string };

/** A badge being added or edited, before the list is saved. */
export type BadgeDraft = {
	id: string;
	name: string;
	upload: BadgeUpload;
};

/**
 * @description Suggests a badge name from a file name: words capitalised, only the characters a name allows.
 * @param fileName The picked file's name.
 * @returns The suggestion, possibly empty.
 */
export function nameFromFile(fileName: string): string {
	return fileName
		.replace(/\.png$/i, '')
		.replaceAll(/[-_]+/g, ' ')
		.replaceAll(/[^\p{Script=Latin}0-9 .,'!&+:]/gu, '')
		.replace(/^[^\p{Script=Latin}0-9]+/u, '')
		.replaceAll(
			/(^|\s)(\p{Ll})/gu,
			(_, space: string, letter: string) => space + letter.toUpperCase(),
		)
		.slice(0, BADGE_NAME_MAX_LENGTH)
		.trim();
}

/**
 * @description Holds the badges being added or edited: each picked PNG is checked in the browser, then
 * uploaded, and its draft follows along.
 * @returns The drafts and the operations on them.
 */
export function useBadgeDrafts() {
	const [drafts, setDrafts] = useState<BadgeDraft[]>([]);
	const upload = useMutation(uploadBadgeImageMutation());

	function update(id: string, change: Partial<BadgeDraft>) {
		setDrafts((current) =>
			current.map((draft) => (draft.id === id ? { ...draft, ...change } : draft)),
		);
	}

	async function attach(id: string, file: File) {
		update(id, { upload: { kind: 'uploading' } });

		const problem = await checkBadgeFile(file);

		if (problem) {
			update(id, { upload: { kind: 'rejected', problem } });

			return;
		}

		try {
			const { image, url } = await upload.mutateAsync(file);

			update(id, { upload: { kind: 'ready', image, imageUrl: url } });
		} catch (error) {
			update(id, { upload: { kind: 'rejected', problem: getApiErrorMessage(error) } });
		}
	}

	function addFiles(files: File[]) {
		const added = files.map((file) => ({
			file,
			draft: {
				id: crypto.randomUUID(),
				name: nameFromFile(file.name),
				upload: { kind: 'uploading' } as const,
			},
		}));

		setDrafts((current) => [...current, ...added.map(({ draft }) => draft)]);

		for (const { file, draft } of added) {
			void attach(draft.id, file);
		}
	}

	function edit({ name, image, imageUrl }: OwnedBadge) {
		setDrafts([{ id: crypto.randomUUID(), name, upload: { kind: 'ready', image, imageUrl } }]);
	}

	return {
		drafts,
		addFiles,
		edit,
		replaceImage: attach,
		rename: (id: string, name: string) => update(id, { name }),
		remove: (id: string) => setDrafts((current) => current.filter((draft) => draft.id !== id)),
		clear: () => setDrafts([]),
	};
}

export default useBadgeDrafts;
