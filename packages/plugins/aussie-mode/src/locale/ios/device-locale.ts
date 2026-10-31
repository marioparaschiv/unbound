import { NativeModules } from 'react-native';

type AppleSettings = { AppleLocale?: string; AppleLanguages?: string[] };
type SettingsConstants = { settings?: AppleSettings };

export function deviceLocale(): string | undefined {
	const manager = NativeModules.SettingsManager as
		| (SettingsConstants & { getConstants?: () => SettingsConstants })
		| undefined;
	const settings = manager?.settings ?? manager?.getConstants?.().settings;

	return settings?.AppleLocale ?? settings?.AppleLanguages?.[0];
}
