import { metro, patcher } from '@unbound-app/api';
import {
	cloneElement,
	createElement,
	isValidElement,
	type ComponentType,
	type ReactElement,
	type ReactNode,
} from 'react';

import { PresetsGroup } from '~/components/presets-group';

const EDIT_STATUS = 'modules/custom_status/native/EditCustomStatusWithPreview.tsx';

type Screen = { render: (...args: unknown[]) => unknown };

type ScreenProps = { onClose?: () => void };

type Parent = ReactElement<{ children?: ReactNode }>;

const PRESETS_KEY = 'unbound-status-presets';

function withPresets(node: ReactNode, onClose: (() => void) | undefined, depth = 0): ReactNode {
	if (!isValidElement(node) || depth > 6) return node;

	const { children } = (node as Parent).props;

	if (Array.isArray(children) && children.length >= 3) {
		if (children.some((child) => isValidElement(child) && child.key === PRESETS_KEY))
			return node;

		return cloneElement(
			node as Parent,
			{},
			...children.slice(0, -1),
			<PresetsGroup key={PRESETS_KEY} onClose={onClose} />,
			children.at(-1),
		);
	}

	if (Array.isArray(children)) return node;

	const next = withPresets(children, onClose, depth + 1);

	return next === children ? node : cloneElement(node as Parent, {}, next);
}

type ScreenComponent = (props: ScreenProps) => ReactNode;

const wrappers = new WeakMap<ScreenComponent, ComponentType<ScreenProps>>();

function wrapped(Screen: ScreenComponent): ComponentType<ScreenProps> {
	const existing = wrappers.get(Screen);

	if (existing) return existing;

	const WithPresets = (props: ScreenProps) => withPresets(Screen(props), props.onClose);

	wrappers.set(Screen, WithPresets);

	return WithPresets;
}

/**
 * @description Adds a Presets group to the Set your status screen, above its Clear status row. Patches the render of Discord's
 * edit custom status modal and its root screen's `render`, which renders the screen through a wrapper that adds the group.
 */
export function patchEditStatus(): void {
	const Modal = metro.findByFilePath(EDIT_STATUS);

	if (typeof Modal?.default !== 'function') {
		logger.warn('Status presets skipped: Discord moved EditCustomStatusWithPreview.');

		return;
	}

	patcher.react.after(Modal, 'default', ({ result }) => {
		const root = (result as ReactElement<{ screens?: Record<string, Screen> }>)?.props?.screens
			?.root;

		if (typeof root?.render !== 'function') return;

		patcher.after(root as Screen, 'render', ({ result: screen }) => {
			if (!isValidElement<ScreenProps>(screen)) return screen;

			const { type, props } = screen;

			return typeof type === 'function'
				? createElement(wrapped(type as ScreenComponent), props)
				: screen;
		});
	});
}
