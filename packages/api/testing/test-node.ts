import type { HostName, HostPropsByName } from './fake-react-native';
import type { Fiber, Props } from './test-renderer';

/** The props of a host or component this kit has no type for: whatever the code under test gave it. */
type AnyProps = Props;

/**
 * What `find` and `findAll` match, as `findComponent` does: a host or component name (a host's name, else
 * `displayName`, else the function's name), or a predicate over each node.
 */
export type Matcher = string | ((node: TestNode) => boolean);

/** Finds rendered nodes below a node. A host name types the props; pass `P` to type a component's. */
export type Queries = {
	/** The first node below that matches, depth first; throws naming what did render when none does. */
	find: {
		<N extends HostName>(name: N): TestNode<HostPropsByName[N]>;
		<P = AnyProps>(match: Matcher): TestNode<P>;
	};
	/** Every node below that matches, depth first. */
	findAll: {
		<N extends HostName>(name: N): TestNode<HostPropsByName[N]>[];
		<P = AnyProps>(match: Matcher): TestNode<P>[];
	};
	/** The text rendered below, joined. */
	text: () => string;
};

/** A rendered host element or component, read live: after a re-render it shows the new props and children. */
export type TestNode<P = AnyProps> = Queries & {
	/** The element type: a host name such as `'Text'`, or the component. */
	type: unknown;
	/** The host name, or the component's `displayName` or function name. */
	name: string;
	props: P;
	/** The nodes and strings rendered directly inside, Fragments and Providers flattened away. */
	children: (TestNode | string)[];
	parent: TestNode | undefined;
};

const nodes = new WeakMap<Fiber, TestNode>();

function visible(fibers: Fiber[]): Fiber[] {
	return fibers.flatMap((fiber) =>
		fiber.kind === 'wrapper' ? visible(fiber.children) : [fiber],
	);
}

function texts(fiber: Fiber): string {
	return fiber.kind === 'text' ? fiber.text : fiber.children.map(texts).join('');
}

function matches(match: Matcher, node: TestNode): boolean {
	return typeof match === 'string' ? node.name === match : match(node);
}

function describe(match: Matcher): string {
	return typeof match === 'string' ? `"${match}"` : 'the predicate';
}

function walk(fiber: Fiber, visit: (node: TestNode) => boolean) {
	for (const child of visible(fiber.children)) {
		if (child.kind === 'text') {
			continue;
		}

		if (visit(nodeOf(child)) || walk(child, visit)) {
			return true;
		}
	}

	return false;
}

/**
 * @description Builds the queries over the nodes rendered below a fiber.
 * @param fiber The fiber, such as a renderer's root.
 * @returns `find`, `findAll` and `text`.
 */
export function queriesOf(fiber: Fiber): Queries {
	function findAll(match: Matcher): TestNode[] {
		const found: TestNode[] = [];

		walk(fiber, (node) => {
			if (matches(match, node)) {
				found.push(node);
			}

			return false;
		});

		return found;
	}

	function find(match: Matcher): TestNode {
		let found: TestNode | undefined;

		walk(fiber, (node) => {
			found = matches(match, node) ? node : void 0;

			return Boolean(found);
		});

		if (!found) {
			const rendered = new Set<string>();

			walk(fiber, (node) => {
				rendered.add(node.name);

				return false;
			});
			throw new Error(
				`No rendered node matches ${describe(match)}. Rendered: ${[...rendered].join(', ') || 'nothing'}.`,
			);
		}

		return found;
	}

	return {
		find: find,
		findAll: findAll,
		text: () => texts(fiber),
	};
}

/**
 * @description Wraps a fiber as a {@link TestNode}, once per fiber, so the same node is returned across renders.
 * @param fiber A host or component fiber.
 * @returns The node.
 */
export function nodeOf(fiber: Fiber): TestNode {
	const cached = nodes.get(fiber);

	if (cached) {
		return cached;
	}

	const node: TestNode = {
		...queriesOf(fiber),
		type: fiber.type,
		name: fiber.name,
		get props() {
			return fiber.props;
		},
		get children() {
			return visible(fiber.children).map((child) =>
				child.kind === 'text' ? child.text : nodeOf(child),
			);
		},
		get parent() {
			let parent = fiber.parent;

			while (parent?.kind === 'wrapper') parent = parent.parent;

			return parent && parent.kind !== 'root' ? nodeOf(parent) : void 0;
		},
	};

	nodes.set(fiber, node);

	return node;
}
