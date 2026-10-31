import { NativeModules } from 'react-native';

export function deviceLocale(): string | undefined {
	return NativeModules.I18nManager?.localeIdentifier;
}
