import { cloneElement, isValidElement, type ReactNode } from 'react';

import { createPatcher } from '~/patcher/create-patcher';
import { onModuleLoaded } from '~/metro/wait';
import { byFilePath } from '~/metro/filters';
import ThemeStore from '~/themes/state';

const Patcher = createPatcher('unbound::themes::guard-underlay');

/**
 * The bar that replaces the chat input when the user cannot send, such as a read-only channel's "Done reading?" prompt.
 * Its container draws a solid `BACKGROUND_BASE_LOWER` underlay under the bottom of the bar.
 */
const GUARD_PATH = 'modules/chat_input/native/guard/ChatInputGuard.tsx';

type ViewProps = {
	style?: { position?: string; backgroundColor?: string };
	children?: ReactNode;
};

type GuardModule = { ChatInputGuardContainer: (...args: never[]) => ReactNode };

// The underlay is the one childless, absolutely placed, coloured view in the container.
function isUnderlay(node: ReactNode) {
	if (!isValidElement<ViewProps>(node) || node.props.children) {
		return false;
	}

	const { style } = node.props;

	return style?.position === 'absolute' && Boolean(style.backgroundColor);
}

// Copies only the elements on the path to the underlay: Discord's compiler caches the rendered elements, so a mutation
// would outlive the background.
function withoutUnderlay(node: ReactNode): ReactNode {
	if (isUnderlay(node)) return null;

	if (!isValidElement<ViewProps>(node) || !Array.isArray(node.props.children)) {
		return node;
	}

	const original: ReactNode[] = node.props.children;
	const children = original.map(withoutUnderlay);

	return children.every((child, index) => child === original[index])
		? node
		: cloneElement(node, { children });
}

// The store hook runs on every render, whether or not a background shows.
function dropUnderlay(mdl: GuardModule) {
	Patcher.after(mdl, 'ChatInputGuardContainer', ({ result }) => {
		const background = ThemeStore((state) => state.background);

		return background ? withoutUnderlay(result) : result;
	});
}

/**
 * @description Drops the solid underlay under the bar that replaces the chat input while a chat background shows, so
 * the background runs under the bar. Patches the module once it loads.
 * @returns A function that stops waiting and restores Discord's underlay.
 */
export function clearGuardUnderlay(): () => void {
	const stop = onModuleLoaded(byFilePath(GUARD_PATH), dropUnderlay);

	return () => {
		stop();
		Patcher.unpatchAll();
	};
}
