(payload) => {
	Object.defineProperty(globalThis, 'UNBOUND_SETTINGS', {
		configurable: true,
		get: () => globalThis.NativePlatform?.settings?.get?.(),
	});
	globalThis.UNBOUND_PLUGINS = payload.plugins;
	globalThis.UNBOUND_THEMES = payload.themes;
	globalThis.UNBOUND_FONTS = payload.fonts;
	globalThis.UNBOUND_AVAILABLE_FONTS = payload.availableFonts;
	globalThis.UNBOUND_LOADER = payload.loader;
};
