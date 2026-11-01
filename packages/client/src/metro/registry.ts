declare global {
	/** An entry in Metro's module registry. */
	type MetroModuleRecord = {
		factory?: (...args: any[]) => void;
		/** The ids of the modules this one requires. Metro clears it once the module initializes. */
		dependencyMap?: number[];
		isInitialized?: boolean;
		hasError?: boolean;
		publicModule: MetroPublicModule;
		__filePath?: string;
	};

	/** A value a Metro module exports. Discord's modules carry no static types, so it can be anything. */
	type MetroExport = any;

	/** The `module` object a Metro factory populates. */
	type MetroPublicModule = {
		id?: number;
		exports: MetroExport;
	};

	/** The Metro `require` function: runs (and returns the exports of) a module by id. */
	type MetroRequire = {
		importAll: (id: number | string) => any;
	} & ((id: number | string) => any);

	/** The Metro `define` function, registering a module factory by id. */
	type MetroDefine = (...args: any[]) => void;

	var modules: Map<number, MetroModuleRecord>;
	var __r: MetroRequire;
	var __d: MetroDefine;
	var __c: (() => Map<number, MetroModuleRecord>) | undefined;
}

export {};
