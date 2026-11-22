import type { ToastHandle } from '@unbound-app/types/toasts';
import type { AddonManifest } from '@unbound-app/types';

import { format } from '~/i18n/api';
import { show } from '~/toasts/api';

/** The toast an icon pack install shows while its images download. */
export type DownloadToast = {
	progress: (done: number, total: number) => void;
	finish: (installed: boolean) => void;
};

/**
 * @description Creates the toast an icon pack install fills as its images download. It shows on the first
 * download, moves once per whole percent so a pack of thousands of images re-renders it at most 100 times,
 * and ends as "Installed" or closes.
 * @param pack The pack's id and name.
 * @returns The toast's controls.
 */
export function createDownloadToast(pack: Pick<AddonManifest, 'id' | 'name'>): DownloadToast {
	const id = `icon-pack-download:${pack.id}`;
	let toast: ToastHandle | undefined;
	let percent = -1;

	function progress(done: number, total: number) {
		const next = total > 0 ? Math.floor((done / total) * 100) : 0;

		if (toast && next === percent) return;

		percent = next;

		const options = {
			title: pack.name,
			content: format('UNBOUND_ICON_PACK_DOWNLOADING', { done, total }),
			progress: next / 100,
		};

		if (toast) {
			toast.update(options);
		} else {
			toast = show({ id, icon: 'DownloadIcon', duration: 0, ...options });
		}
	}

	function finish(installed: boolean) {
		if (!toast) return;

		if (installed) {
			show({
				id,
				title: pack.name,
				content: format('UNBOUND_ICON_PACK_INSTALLED', { name: pack.name }),
				icon: 'CircleCheckIcon',
			});
		} else {
			toast.close();
		}
	}

	return { progress, finish };
}
