let dispose: (() => void) | undefined;

export function start(context: PluginContext) {
	dispose = run(context);
}

export async function stop(): Promise<void> {
	await flush();
	dispose?.();
	dispose = undefined;
}
