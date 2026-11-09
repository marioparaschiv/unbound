import type { CElement, ReactElement, ReactNode } from 'react';
import { createLogger } from '@unbound-app/logger';
import { Component, createElement } from 'react';

/** The props an element boundary takes: the element a patch added, and the patched component's name for the log. */
export type ElementBoundaryProps = {
	children?: ReactElement;
	/** The patched component's name. */
	component: string;
};

type ElementBoundaryState = { failed: boolean };

type ElementBoundaryElement = CElement<ElementBoundaryProps, ElementBoundary>;

const logger = createLogger('Patcher', 'React');

// A `memo`, `forwardRef` or host type holds its name on what it wraps, or is the name.
function typeName(type: MetroExport): string {
	if (typeof type === 'string') {
		return type;
	}

	const inner = type?.type ?? type?.render;

	return type?.displayName || type?.name || inner?.displayName || inner?.name || 'element';
}

/**
 * Renders an element a patch added next to Discord's, or nothing once it throws. Its siblings keep their fibers,
 * so Discord's state, such as a focused input, survives. A failed boundary stays empty until it unmounts.
 */
class ElementBoundary extends Component<ElementBoundaryProps, ElementBoundaryState> {
	state: ElementBoundaryState = { failed: false };

	static getDerivedStateFromError(): ElementBoundaryState {
		return { failed: true };
	}

	componentDidCatch(error: Error) {
		const { children, component } = this.props;

		logger.error(
			`Failed to render ${typeName(children?.type)} added by a patch on component ${component}:`,
			error,
		);
	}

	render(): ReactNode {
		return this.state.failed ? null : this.props.children;
	}
}

/**
 * @description Wraps an element a patch added in a boundary that renders nothing while it throws.
 * @param element The added element.
 * @param component The patched component's name, for the log.
 * @returns The wrapped element, keyed like `element` so its siblings keep their places.
 */
export function withElementBoundary(
	element: ReactElement,
	component: string,
): ElementBoundaryElement {
	return createElement(ElementBoundary, { key: element.key ?? undefined, component }, element);
}
