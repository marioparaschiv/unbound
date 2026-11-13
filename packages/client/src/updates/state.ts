import { ADDON_KINDS } from '@unbound-app/types/addons';
import { createLogger } from '@unbound-app/logger';
import toError from '@unbound-app/utils/to-error';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { fetchLoaderUpdate, resolveRequiredLoader } from '~/updates/loader-updates';
import { automaticUpdates, fetchUpdates } from '~/updates/addon-updates';
import { installsFromManifest } from '~/addons/installs-from-manifest';
import { checkDiscordBuilds } from '~/updates/discord-builds';
import type { DiscordBuilds } from '~/updates/discord-builds';
import type { PendingUpdate } from '~/updates/addon-updates';
import type { LoaderCheck } from '~/updates/loader-updates';
import { moveRenamedAddons } from '~/addons/renames';
import { getLoader } from '~/native/unbound-native';
import { BUILD_CHANNEL } from '~/core/constants';
import { install } from '~/marketplace/api';
import { Manager } from '~/addons/manager';

const logger = createLogger('Updater');

/** How long a check stays `checking` at least, so its spinner never flips straight to the result. */
const MIN_CHECK_MS = 500;

/** The last update check. `ready` and `error` keep when it finished, for the status line. */
export type UpdatesState =
	| { status: 'idle' }
	| { status: 'checking' }
	| {
			status: 'ready';
			checkedAt: string;
			updates: PendingUpdate[];
			loader: LoaderCheck['update'];
			/** The loader version the newest bundle needs while the installed loader is older. */
			requiredLoader: string | null;
			/** The patched Discord's installable builds; `null` where Discord cannot install them. */
			discord: DiscordBuilds | null;
	  }
	| { status: 'error'; checkedAt: string; error: string };

/** An update being applied, or one whose last attempt failed. Absent once it succeeds. */
export type ApplyStatus = 'updating' | 'failed';

type UpdatesStore = {
	state: UpdatesState;
	applying: Record<string, ApplyStatus>;
	check: () => Promise<void>;
	/** Applies one pending update. Resolves whether the addon now runs the new version. */
	apply: (id: string) => Promise<boolean>;
	/** Applies every pending update except newer versions of held addons. */
	applyAll: () => Promise<void>;
};

let pending: Promise<void> | undefined;

function checkInstalled(): Promise<PendingUpdate[]> {
	const entries = ADDON_KINDS.filter(installsFromManifest).flatMap((kind) =>
		Manager.for(kind).listInstalled(),
	);

	return fetchUpdates(entries, {
		onRenamed: (renames) => void moveRenamedAddons(renames, { install }),
	});
}

/**
 * @description Asks the update server whether a newer loader is available for this device, and whether the
 * newest bundle needs one.
 * @returns The check; when it failed, no update and only the native loader's own requirement.
 */
export async function findLoaderUpdate(): Promise<LoaderCheck> {
	const loader = getLoader();

	try {
		return await fetchLoaderUpdate({
			platform: Platform.OS,
			loader,
			channel: BUILD_CHANNEL,
		});
	} catch (error) {
		logger.error('Failed to check for a loader update:', error);

		return { update: null, requiredVersion: resolveRequiredLoader(loader) };
	}
}

/**
 * @description Reads the in-app installer's state and the installed channel's patched Discord builds.
 * @returns The builds, or `null` where the installer does not apply or the check failed.
 */
async function findDiscordBuilds(): Promise<DiscordBuilds | null> {
	try {
		return await checkDiscordBuilds();
	} catch (error) {
		logger.error('Failed to list the patched Discord builds:', error);

		return null;
	}
}

const UpdatesStore = create<UpdatesStore>((set, get) => {
	function setApplying(id: string, status: ApplyStatus | undefined) {
		set((prev) => {
			const rest = Object.fromEntries(
				Object.entries(prev.applying).filter(([key]) => key !== id),
			);

			return { applying: status ? { ...rest, [id]: status } : rest };
		});
	}

	return {
		state: { status: 'idle' },
		applying: {},
		check() {
			pending ??= (async () => {
				set({ state: { status: 'checking' } });

				const minimum = new Promise((resolve) => setTimeout(resolve, MIN_CHECK_MS));

				try {
					const [updates, loader, discord] = await Promise.all([
						checkInstalled(),
						findLoaderUpdate(),
						findDiscordBuilds(),
					]);

					await minimum;

					set({
						state: {
							status: 'ready',
							checkedAt: new Date().toISOString(),
							updates,
							loader: loader.update,
							requiredLoader: loader.requiredVersion,
							discord,
						},
					});
				} catch (error) {
					logger.error('Failed to check for addon updates:', error);
					await minimum;
					set({
						state: {
							status: 'error',
							checkedAt: new Date().toISOString(),
							error: toError(error).message,
						},
					});
				}
			})().finally(() => {
				pending = undefined;
			});

			return pending;
		},
		async apply(id) {
			const { state, applying } = get();
			const target =
				state.status === 'ready'
					? state.updates.find((entry) => entry.id === id)
					: undefined;

			if (!target || applying[id] === 'updating') {
				return false;
			}

			setApplying(id, 'updating');

			const updated = await Manager.for(target.kind).update(target.id, target.update);

			setApplying(id, updated ? undefined : 'failed');

			if (updated) {
				set((prev) =>
					prev.state.status === 'ready'
						? {
								state: {
									...prev.state,
									updates: prev.state.updates.filter((entry) => entry.id !== id),
								},
							}
						: {},
				);
			}

			return updated;
		},
		async applyAll() {
			const { state, apply } = get();

			if (state.status !== 'ready') return;

			// Read at apply time, so a version the user picked since the check stays held.
			await Promise.all(
				automaticUpdates(state.updates, (kind) => Manager.for(kind)).map((entry) =>
					apply(entry.id),
				),
			);
		},
	};
});

export default UpdatesStore;
