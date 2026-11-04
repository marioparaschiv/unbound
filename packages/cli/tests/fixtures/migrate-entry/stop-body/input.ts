let dispose: (() => void) | undefined;

export default {
	start(context: PluginContext) {
		dispose = run(context);
	},
	async stop(): Promise<void> {
		await flush();
		dispose?.();
		dispose = undefined;
	},
};
