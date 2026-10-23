import type { LoaderUpdate } from '@unbound-app/contracts/loader';
import { createLogger } from '@unbound-app/logger';
import toError from '@unbound-app/utils/to-error';
import { Platform } from 'react-native';
import { create } from 'zustand';

import type { PendingUpdate, UpdatableKind, UpdatableManager } from '~/lib/updates';
import { applyUpdate, fetchUpdates, listInstalled } from '~/lib/updates';
import { API_URL, CLIENT_VERSION, ManagerKind } from '~/lib/constants';
import { fetchLoaderUpdate } from '~/lib/loader-updates';
import { getManager } from '~/managers/utils';

const logger = createLogger('Updater');

const UPDATABLE_KINDS: UpdatableKind[] = [
	ManagerKind.Plugins,
	ManagerKind.Themes,
	ManagerKind.Icons,
];

/** The last update check. `ready` and `error` keep when it finished, for the status line. */
export type UpdatesState =
	| { status: 'idle' }
	| { status: 'checking' }
	| { status: 'ready'; checkedAt: string; updates: PendingUpdate[]; loader: LoaderUpdate | null }
	| { status: 'error'; checkedAt: string; error: string };

/** An update being applied, or one whose last attempt failed. Absent once it succeeds. */
export type ApplyStatus = 'updating' | 'failed';

type UpdatesStore = {
	state: UpdatesState;
	applying: Record<string, ApplyStatus>;
	/** Asks the server which installed addons, and whether the native loader, have updates. Concurrent calls share one check. */
	check: () => Promise<void>;
	/** Applies one pending update. Resolves whether the addon now runs the new version. */
	apply: (id: string) => Promise<boolean>;
	/** Applies every pending addon update at once. A loader update is installed by the user, never here. */
	applyAll: () => Promise<void>;
};

let pending: Promise<void> | undefined;

function manager(kind: UpdatableKind): UpdatableManager {
	return getManager(kind);
}

function checkInstalled(): Promise<PendingUpdate[]> {
	const entries = UPDATABLE_KINDS.flatMap((kind) => listInstalled(kind, manager(kind)));

	return fetchUpdates(entries, { baseUrl: API_URL, clientVersion: CLIENT_VERSION });
}

// A failed loader check hides only the loader row, so addon updates still show.
async function checkLoader(): Promise<LoaderUpdate | null> {
	try {
		return await fetchLoaderUpdate({
			baseUrl: API_URL,
			platform: Platform.OS,
			loader: globalThis.UNBOUND_LOADER,
		});
	} catch (error) {
		logger.error('Failed to check for a loader update:', error);

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

				try {
					const [updates, loader] = await Promise.all([checkInstalled(), checkLoader()]);

					set({
						state: {
							status: 'ready',
							checkedAt: new Date().toISOString(),
							updates,
							loader,
						},
					});
				} catch (error) {
					logger.error('Failed to check for addon updates:', error);
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

			const updated = await applyUpdate(manager(target.kind), target);

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

			await Promise.all(state.updates.map((entry) => apply(entry.id)));
		},
	};
});

export default UpdatesStore;
