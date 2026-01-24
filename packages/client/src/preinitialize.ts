const mdls = [...globalThis.modules.values()];

let reactNative, react;

for (const m of mdls) {
	const exports = m?.publicModule?.exports;
	if (!exports) continue;

	if (!reactNative && exports.AppState) reactNative = exports;
	if (!react && exports.createElement) react = exports;

	if (reactNative && react) break;
}

globalThis.ReactNative = reactNative;
globalThis.React = react;

export {};
