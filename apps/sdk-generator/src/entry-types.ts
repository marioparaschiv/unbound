export type ModuleEntry = {
	name: string;
	source: string;
	out: string;
	/** Top-level modules type `window.unbound.*`; nested subpaths live inside their parent. */
	topLevel: boolean;
};

/** The root `index.d.ts`, which only re-exports the top-level modules. */
export type RootEntry = {
	source: string;
	out: string;
};

/** A barrel `export const old = next;` naming a top-level module under an old name. */
export type NamespaceAlias = {
	name: string;
	/** The top-level module the alias points at. */
	target: string;
	/** The alias's JSDoc body, such as `@deprecated Use iconPacks`. */
	doc: string;
};

/** A lifecycle function the global `unbound` object carries, read from the client entry. */
export type LifecycleMember = {
	name: string;
	parameters: { name: string; type: string; optional: boolean }[];
	returnType: string;
	doc: string;
};

/** The client's `UnboundLifecycle` type: what the global `unbound` object keeps after shutdown. */
export type Lifecycle = {
	doc: string;
	members: LifecycleMember[];
};

export type SdkEntries = {
	root: RootEntry;
	/** Every module and nested subpath, sorted by name. */
	modules: ModuleEntry[];
	/** The barrel's aliases of top-level modules, sorted by name. */
	aliases: NamespaceAlias[];
};
