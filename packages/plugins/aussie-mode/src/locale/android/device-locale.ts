import { NativeModules } from 'react-native';

type I18nConstants = { localeIdentifier?: string };
type I18nModule = I18nConstants & { getConstants?: () => I18nConstants };

export function deviceLocale(
	modules: { I18nManager?: I18nModule } = NativeModules,
): string | undefined {
	const manager = modules.I18nManager;

	return manager?.localeIdentifier ?? manager?.getConstants?.().localeIdentifier;
}
