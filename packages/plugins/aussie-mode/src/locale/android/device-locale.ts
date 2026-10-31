import { NativeModules } from 'react-native';

type I18nConstants = { localeIdentifier?: string };

export function deviceLocale(): string | undefined {
	const manager = NativeModules.I18nManager as
		| (I18nConstants & { getConstants?: () => I18nConstants })
		| undefined;

	return manager?.localeIdentifier ?? manager?.getConstants?.().localeIdentifier;
}
