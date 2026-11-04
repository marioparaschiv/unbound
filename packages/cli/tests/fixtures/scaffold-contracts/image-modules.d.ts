// MERGE: copies `packages/api/ambient/image-modules.d.ts` from the unmerged assets work.
// Delete it, and its use in scaffold-plugin.test.ts, once that lands.

declare module '*.png' {
	/** The image's asset id. */
	const id: number;

	export default id;
}
