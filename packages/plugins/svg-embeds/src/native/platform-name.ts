import { Platform } from 'react-native';

/**
 * @description Names the platform for choosing which image formats its decoder reads.
 * @returns `ios` or `android`.
 */
export function platformName(): 'ios' | 'android' {
	return Platform.OS === 'ios' ? 'ios' : 'android';
}
