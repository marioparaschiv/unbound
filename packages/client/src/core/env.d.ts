/** Flags the build defines; each folds to a literal, so code behind a `false` flag leaves the bundle. */
type ImportMetaEnv = {
	/** Whether this is a local dev build, served by the dev server. */
	readonly DEV: boolean;
	/** Whether this is the dev bundle (or a local dev build), which carries the `*.dev.ts` developer tooling. */
	readonly DEV_TOOLS: boolean;
	/** Whether this is a benchmark build, which carries `scripts/bench-android`'s agent and its startup marks. */
	readonly BENCH: boolean;
};

type ImportMeta = {
	readonly env: ImportMetaEnv;
};
