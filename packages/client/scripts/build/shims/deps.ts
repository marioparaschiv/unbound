import createProxy from '@unbound-app/utils/create-proxy';

export const react = createProxy<typeof import('react')>({
	getter: (prop) => (globalThis as any).modules?.['react']?.[prop],
	fallback: (prop) => (globalThis as any).React?.[prop],
});

export const reactNative = createProxy<typeof import('react-native')>({
	getter: (prop) => (globalThis as any).modules?.['react-native']?.[prop],
	fallback: (prop) => (globalThis as any).ReactNative?.[prop],
});

export const reactNativeReanimated = createProxy<typeof import('react-native-reanimated')>({
	getter: (prop) => (globalThis as any).modules?.['react-native-reanimated']?.[prop],
	fallback: (prop) => (globalThis as any).ReactNativeReanimated?.[prop],
});
