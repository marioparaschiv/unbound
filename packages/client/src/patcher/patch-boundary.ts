import type { ReactElement, ReactNode } from 'react';
import { Component, createElement } from 'react';

import { recordFailure, recordSuccess } from '~/patcher/patch-failures';
import type { UnpatchedRenderProps } from '~/patcher/unpatched-render';
import type { PatchFailures } from '~/patcher/patch-failures';
import UnpatchedRender from '~/patcher/unpatched-render';

/** The props a patch boundary takes: Discord's render to fall back to, and the patches that built `children`. */
export type PatchBoundaryProps = UnpatchedRenderProps & {
	children?: ReactNode;
	patches: readonly PatchFailures[];
};

type PatchBoundaryState = {
	failed: boolean;
	children: ReactNode;
};

type PatchBoundaryElement = ReactElement<PatchBoundaryProps, typeof PatchBoundary>;

/**
 * Renders a patched tree, or Discord's own render while that tree fails. A new tree from the component gets a fresh
 * try; each failure counts against the patches that built it.
 */
class PatchBoundary extends Component<PatchBoundaryProps, PatchBoundaryState> {
	state: PatchBoundaryState = { failed: false, children: this.props.children };

	static getDerivedStateFromProps(
		props: PatchBoundaryProps,
		state: PatchBoundaryState,
	): PatchBoundaryState | null {
		return props.children === state.children
			? null
			: { failed: false, children: props.children };
	}

	static getDerivedStateFromError(): Partial<PatchBoundaryState> {
		return { failed: true };
	}

	componentDidCatch(error: Error) {
		for (const failures of this.props.patches) recordFailure(failures, error);
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

		const { place, self, args } = this.props;

		return createElement(UnpatchedRender, { place, self, args });
	}
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
 * @description Wraps a patched tree in a boundary that falls back to Discord's render while it fails. Text and empty
 * trees cannot throw, so they come back as they are.
 * @param children The patched tree.
 * @param props Discord's render and the patches that built `children`.
 * @returns The wrapped tree.
 */
export function withPatchBoundary(children: ReactNode, props: PatchBoundaryProps): ReactNode {
	if (typeof children !== 'object' || children === null) {
		return children;
	}

	return createElement(PatchBoundary, props, children);
}
