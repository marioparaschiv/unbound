import { cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import findRenderTarget from '@unbound-plugins/shared/react/render-target';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';

import CharacterCounter from '~/components/character-counter';
import { Patcher, SelectedChannelStore } from '~/modules';

type ContainerProps = { channel?: { id?: string }; channelId?: string };
type Parent = ReactElement<{ children?: ReactNode }>;

// Drops a counter left in the tree by an earlier render, so the composer never shows two.
function withoutCounters(children: ReactNode): ReactNode {
	if (Array.isArray(children)) {
		const stripped = children.map(withoutCounters);

		if (stripped.every((child, index) => child === children[index])) return children;

		return stripped.filter((child) => child !== null);
	}

	if (!isValidElement<Parent['props']>(children)) return children;

	if (children.type === CharacterCounter) return null;

	if (children.type !== Fragment) return children;

	const inner = children.props.children;
	const stripped = withoutCounters(inner);

	return stripped === inner ? children : cloneElement(children, {}, stripped);
}

function patchContainer(module: AnyProps): () => void {
	const target = findRenderTarget(module);

	if (!target) {
		console.error('[Character Counter] Skipped, the composer has no render function.');

		return () => {};
	}

	return Patcher.after(target.holder, target.key, ({ args, result }) => {
		const props = args[0] as ContainerProps | undefined;
		const parent: Parent | null = result;

		if (!parent?.props) return;

		const channelId =
			props?.channel?.id ?? props?.channelId ?? SelectedChannelStore.getChannelId?.();

		if (!channelId) return;

		return cloneElement(
			parent,
			{},
			<>
				{withoutCounters(parent.props.children)}
				<CharacterCounter key='character-counter' channelId={String(channelId)} />
			</>,
		);
	});
}

/**
 * @description Shows the counter above the composer, without changing the composer's layout, once the composer loads.
 * @returns A function that stops waiting for the composer, or removes the patch.
 */
export function patchFloatingChatInputContainer(): () => void {
	return whenLoaded('modules/chat_input/native/FloatingChatInputContainer.tsx', patchContainer);
}
