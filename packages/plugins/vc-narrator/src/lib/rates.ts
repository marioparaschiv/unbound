export type RateChoice = 'slow' | 'normal' | 'fast';

const IOS_RATES: Record<RateChoice, number> = { slow: 0.42, normal: 0.5, fast: 0.58 };
const ANDROID_RATES: Record<RateChoice, number> = { slow: 0.8, normal: 1, fast: 1.3 };

/**
 * @description Turns the speech rate setting into the rate a platform's speech engine takes: `AVSpeechUtterance` rates around 0.5 on iOS, `TextToSpeech` multipliers around 1 on Android.
 * @param choice The setting.
 * @param platform The platform.
 * @returns The engine's rate.
 */
export function speechRate(choice: RateChoice, platform: 'ios' | 'android'): number {
	return (platform === 'ios' ? IOS_RATES : ANDROID_RATES)[choice];
}
