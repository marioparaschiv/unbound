(payload) => {
	globalThis.ASTRAL_SETTINGS = payload.settings;
	globalThis.ASTRAL_PLUGINS = payload.plugins;
	globalThis.ASTRAL_THEMES = payload.themes;
	globalThis.ASTRAL_FONTS = payload.fonts;
	globalThis.ASTRAL_AVAILABLE_FONTS = payload.availableFonts;
	globalThis.ASTRAL_LOADER = payload.loader;
};
