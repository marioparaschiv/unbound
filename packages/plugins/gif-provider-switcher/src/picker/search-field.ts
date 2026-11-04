export type ElementNode = {
	type?: unknown;
	props?: Record<string, unknown> & { children?: unknown };
};

export type SearchFieldProps = {
	placeholder?: unknown;
	accessibilityLabel?: unknown;
	value?: unknown;
	defaultValue?: unknown;
};

export type CloneElement = (element: ElementNode, props: Record<string, unknown>) => unknown;

const MAX_DEPTH = 15;

function isElementNode(value: unknown): value is ElementNode {
	return typeof value === 'object' && value !== null;
}

/**
 * @description Names a provider in the GIF search field's text, in place of Klipy.
 * @param text The placeholder or label Discord shows, such as `Search Klipy`.
 * @param label The provider's name, such as `Tenor`.
 * @returns The text with Klipy replaced, or unchanged when it does not name Klipy.
 */
export function renameProvider(text: string, label: string): string {
	return text.replace(/klipy/gi, label);
}

/**
 * @description Changes a search query by a leading space, so Discord treats it as new and searches again with the new provider, as Vencord does.
 * @param query The current query.
 * @returns The query with a leading space added or removed.
 */
export function toggleLeadingSpace(query: string): string {
	return query.startsWith(' ') ? query.slice(1) : ` ${query}`;
}

/**
 * @description Checks whether an element is a text field with a placeholder, which the GIF picker header renders for search.
 * @param element A rendered element.
 * @returns `true` for the search field.
 */
export function isSearchField(element: ElementNode): boolean {
	return typeof (element.props as SearchFieldProps | undefined)?.placeholder === 'string';
}

/**
 * @description Reads the query shown in a search field.
 * @param element The search field.
 * @returns Its value, or an empty string.
 */
export function readQuery(element: ElementNode): string {
	const props = element.props as SearchFieldProps | undefined;
	const value = props?.value ?? props?.defaultValue;

	return typeof value === 'string' ? value : '';
}

/**
 * @description Picks the query to search again with after a provider switch: the GIF picker store's query, else the one the search field shows.
 * @param storeQuery What `GIFPickerViewStore.getQuery()` returned, which may be missing on this build.
 * @param fieldQuery The query read from the search field's props.
 * @returns The store's query when it is a non-blank string, else the field's.
 */
export function currentQuery(storeQuery: unknown, fieldQuery: string): string {
	return typeof storeQuery === 'string' && storeQuery.trim() ? storeQuery : fieldQuery;
}

function renamedProps(element: ElementNode, label: string): Record<string, unknown> | null {
	const props = element.props as SearchFieldProps;
	const next: Record<string, unknown> = {};

	for (const key of ['placeholder', 'accessibilityLabel'] as const) {
		const value = props[key];

		if (typeof value === 'string' && renameProvider(value, label) !== value) {
			next[key] = renameProvider(value, label);
		}
	}

	return Object.keys(next).length ? next : null;
}

/**
 * @description Copies a render result with the search field's placeholder and label naming the provider, cloning only the elements on the way to it.
 * @param node The header's render result.
 * @param label The provider's name.
 * @param clone Clones an element with new props, such as `React.cloneElement`.
 * @param depth The current depth; the search stops past 15 levels.
 * @returns The updated render result, or `node` itself when nothing names Klipy.
 */
export function renameSearchField(
	node: unknown,
	label: string,
	clone: CloneElement,
	depth: number = 0,
): unknown {
	if (depth > MAX_DEPTH || !isElementNode(node)) return node;

	if (Array.isArray(node)) {
		let changed = false;
		const children = node.map((child) => {
			const next = renameSearchField(child, label, clone, depth + 1);

			changed ||= next !== child;

			return next;
		});

		return changed ? children : node;
	}

	if (isSearchField(node)) {
		const props = renamedProps(node, label);

		return props ? clone(node, props) : node;
	}

	const children = node.props?.children;
	const next = renameSearchField(children, label, clone, depth + 1);

	return next === children ? node : clone(node, { children: next });
}

/**
 * @description Finds the search field in a render result, depth-first through children.
 * @param node The header's render result.
 * @param depth The current depth; the search stops past 15 levels.
 * @returns The search field, or `undefined` when the header renders none.
 */
export function findSearchField(node: unknown, depth: number = 0): ElementNode | undefined {
	if (depth > MAX_DEPTH || !isElementNode(node)) return;

	if (Array.isArray(node)) {
		for (const child of node) {
			const match = findSearchField(child, depth + 1);

			if (match) return match;
		}

		return;
	}

	return isSearchField(node) ? node : findSearchField(node.props?.children, depth + 1);
}
