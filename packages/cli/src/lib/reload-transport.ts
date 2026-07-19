/** An addon that has just built successfully, ready to be handed to a {@link ReloadTransport}. */
export type BuiltAddon = {
	id: string;
	kind: 'plugin' | 'theme';
	dir: string;
	/** The resolved output path; the addon directory itself for static addons. */
	output: string;
};

/** How `ubd dev` pushes a freshly built addon to the running client. */
export interface ReloadTransport {
	reload(addon: BuiltAddon): Promise<void>;
}

/**
 * The shipped transport: hot reload is not yet wired, so it only reports that the app must be
 * restarted for the rebuild to take effect. The real mechanism swaps this out without touching
 * `ubd dev`.
 */
export const stubReloadTransport: ReloadTransport = {
	async reload(addon: BuiltAddon): Promise<void> {
		process.stdout.write(
			`Rebuilt ${addon.id}, but hot reload is not yet available — restart the app to load it.\n`,
		);
	},
};

export default stubReloadTransport;
