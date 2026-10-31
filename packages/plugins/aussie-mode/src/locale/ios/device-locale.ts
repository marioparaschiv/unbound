import { NativeModules } from 'react-native';

export function deviceLocale(): string | undefined {
	const settings = NativeModules.SettingsManager?.settings;

	return settings?.AppleLocale ?? settings?.AppleLanguages?.[0];
}
