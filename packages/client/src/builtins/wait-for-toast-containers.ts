import { byFilePath, type MetroFilter } from '~/api/metro/filters';
import type { onModuleLoaded } from '~/api/metro/wait';
import type { AnyProps } from '~/api/metro';

export type ToastContainerTarget = [AnyProps, string];

type Wait = typeof onModuleLoaded;

const APP_CONTAINER_PATH = 'modules/toast/native/AppToastContainer.tsx';
const MANA_CONTAINER_PATH = 'design/mana/components/Toast/ToastContainer.native.tsx';
const CONTAINER_PATHS: (string | undefined)[] = [APP_CONTAINER_PATH, MANA_CONTAINER_PATH];

function exportedComponent(
	module: AnyProps | undefined,
	key: string,
): ToastContainerTarget | undefined {
	return typeof module?.[key] === 'function' ? [module, key] : undefined;
}

function propsContainer(components: AnyProps): ToastContainerTarget | undefined {
	const container = components.ToastContainer;

	if (typeof container?.type === 'function') {
		return [container, 'type'];
	}

	return exportedComponent(components, 'ToastContainer');
}

// Builds without either known file export the container by name; the known files are replaced on their own.
const byUnknownContainer: MetroFilter = (record) =>
	!CONTAINER_PATHS.includes(record.__filePath) &&
	record.publicModule?.exports?.ToastContainer !== void 0;

byUnknownContainer.isRaw = true;

/**
 * @description Calls `onTarget` with each Discord component that mounts the toast list as Discord loads it. iOS
 * mounts the app toast container, which wraps the design system's container, while Android mounts the latter alone.
 * @param wait Waits for a Metro module without loading it.
 * @param onTarget Receives the module and export key of each container to replace.
 * @returns A function that stops waiting.
 */
function waitForToastContainers(
	wait: Wait,
	onTarget: (target: ToastContainerTarget) => void,
): () => void {
	let found = false;
	let stopFallback: (() => void) | undefined;

	function replace(target: ToastContainerTarget | undefined) {
		if (!target) return;

		found = true;
		stopFallback?.();
		onTarget(target);
	}

	const stops = [
		wait(byFilePath(APP_CONTAINER_PATH), (mdl) => replace(exportedComponent(mdl, 'default')), {
			interop: false,
		}),
		wait(
			byFilePath(MANA_CONTAINER_PATH),
			(mdl) => replace(exportedComponent(mdl, 'ToastContainer')),
			{ interop: false },
		),
	];

	if (!found) {
		// A known file can load while the fallback's filter reads an export, so the fallback checks again.
		stopFallback = wait(byUnknownContainer, (mdl) => {
			if (found) return;

			replace(propsContainer(mdl));
		});
		stops.push(stopFallback);
	}

	return () => {
		for (const stop of stops) stop();
	};
}

export default waitForToastContainers;
