import type { ReactElement, ReactNode } from 'react';
import { Component, createElement } from 'react';

import { recordFailure, recordSuccess } from '~/patcher/patch-failures';
import type { PatchFailures } from '~/patcher/patch-failures';
import { rerenderFiber } from '~/hot-refresh/refresh';
import type { Fiber } from '~/hot-refresh/refresh';

/** The props a patch boundary takes: the patches that built `children`, and Discord's tree to fall back to. */
export type PatchBoundaryProps = {
	children?: ReactNode;
	/** Discord's tree from the same render, before the patches touched it. Absent until a patch has failed once. */
	fallback?: ReactNode;
	patches: readonly PatchFailures[];
};

type PatchBoundaryState = { failed: boolean };

type PatchBoundaryElement = ReactElement<PatchBoundaryProps, typeof PatchBoundary>;

/**
 * Renders a patched tree, or Discord's tree from the same render once it throws, so Discord's hooks run once.
 * A failed boundary stays on the fallback until it unmounts.
 */
class PatchBoundary extends Component<PatchBoundaryProps, PatchBoundaryState> {
	state: PatchBoundaryState = { failed: false };

	static getDerivedStateFromError(): PatchBoundaryState {
		return { failed: true };
	}

	componentDidCatch(error: Error) {
		for (const failures of this.props.patches) recordFailure(failures, error);

		if (hasFallback(this.props)) return;

		// Each patch is now unstable, so a re-render of the patched component hands this boundary a fallback.
		const owner = parentFiberOf(this);

		if (owner) {
			rerenderFiber(owner);
		}
	}

	componentDidMount() {
		this.recordCommit();
	}

	componentDidUpdate() {
		this.recordCommit();
	}

	recordCommit() {
		if (this.state.failed) return;

		for (const failures of this.props.patches) recordSuccess(failures);
	}

	render() {
		if (!this.state.failed) {
			return this.props.children;
		}

		return hasFallback(this.props) ? this.props.fallback : null;
	}
}

// The fiber of the patched component that rendered this boundary.
function parentFiberOf(boundary: PatchBoundary): Fiber | undefined {
	const fiber: { return: Fiber | null } | undefined = Reflect.get(boundary, '_reactInternals');

	return fiber?.return ?? undefined;
}

function hasFallback(props: PatchBoundaryProps): boolean {
	return Object.hasOwn(props, 'fallback');
}

/**
 * @description Tells whether a tree is a patch boundary, so the next patch can read the tree inside it.
 * @param node The tree a component rendered.
 * @returns Whether `node` is a patch boundary element.
 */
export function isPatchBoundary(node: unknown): node is PatchBoundaryElement {
	return typeof node === 'object' && node !== null && Reflect.get(node, 'type') === PatchBoundary;
}

/**
 * @description Reads the fallback a patch boundary carries, if it has one.
 * @param props The boundary's props.
 * @returns Whether it has one, and the fallback.
 */
export function fallbackOf(props: PatchBoundaryProps): { fallback: ReactNode } | undefined {
	return hasFallback(props) ? { fallback: props.fallback } : undefined;
}

/**
 * @description Wraps a patched tree in a boundary that falls back to Discord's tree while it fails. Text and empty
 * trees cannot throw, so they come back as they are.
 * @param children The patched tree.
 * @param props The patches that built `children`, and Discord's tree when one was kept.
 * @returns The wrapped tree.
 */
export function withPatchBoundary(children: ReactNode, props: PatchBoundaryProps): ReactNode {
	if (typeof children !== 'object' || children === null) {
		return children;
	}

	return createElement(PatchBoundary, props, children);
}
