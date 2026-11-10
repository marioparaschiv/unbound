let reactNative, react;

// React and React Native are among Metro's first modules, so walking the Map and stopping at them beats copying it.
for (const m of globalThis.modules.values()) {
	const exports = m?.publicModule?.exports;

	if (!exports) {
		continue;
	}

	if (!reactNative && exports.AppState) {
		reactNative = exports;
	}

	if (!react && exports.createElement) {
		react = exports;
	}

	if (reactNative && react) {
		break;
	}
}

globalThis.ReactNative = reactNative;
globalThis.React = react;

export {};
