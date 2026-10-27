import type { AnyProps, MetroSearchOptions } from '~/api/metro';

export type ToastContainerTarget = [AnyProps, string];

type FilePathFinder = (path: string, options: MetroSearchOptions) => AnyProps | undefined;
type PropsFinder = (name: string) => AnyProps | undefined;

const APP_CONTAINER_PATH = 'modules/toast/native/AppToastContainer.tsx';
const MANA_CONTAINER_PATH = 'design/mana/components/Toast/ToastContainer.native.tsx';

function exportedComponent(
	module: AnyProps | undefined,
	key: string,
): ToastContainerTarget | undefined {
	return typeof module?.[key] === 'function' ? [module, key] : undefined;
}

function propsContainer(byProps: PropsFinder): ToastContainerTarget | undefined {
	const components = byProps('ToastContainer');
	const container = components?.ToastContainer;

	if (typeof container?.type === 'function') {
		return [container, 'type'];
	}

	return exportedComponent(components, 'ToastContainer');
}

/**
 * @description Finds every Discord component that mounts the toast list. iOS mounts the app toast
 * container, which wraps the design system's container, while Android mounts the design system's
 * container on its own.
 * @param byFilePath Looks up a Metro module by its file path.
 * @param byProps Looks up a Metro module by an export name.
 * @returns The module and export key of each container to replace.
 */
function findToastContainers(
	byFilePath: FilePathFinder,
	byProps: PropsFinder,
): ToastContainerTarget[] {
	const targets = [
		exportedComponent(byFilePath(APP_CONTAINER_PATH, { interop: false }), 'default'),
		exportedComponent(byFilePath(MANA_CONTAINER_PATH, { interop: false }), 'ToastContainer'),
	].filter((target) => target !== undefined);

	if (targets.length > 0) {
		return targets;
	}

	const fallback = propsContainer(byProps);

	return fallback ? [fallback] : [];
}

export default findToastContainers;
