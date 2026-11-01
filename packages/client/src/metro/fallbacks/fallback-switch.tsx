import type { DesignModule } from '@unbound-app/types/components';
import type { ComponentProps } from 'react';
import { Switch } from 'react-native';

/** The props of Discord's `FormSwitch`, which the fallback switch accepts. */
type SwitchProps = ComponentProps<DesignModule['FormSwitch']>;

/**
 * @description Unbound's stand-in for Discord's `FormSwitch`: React Native's switch.
 * @param props The switch props.
 * @returns The switch element.
 */
function FallbackSwitch({ value, disabled, accessibilityLabel, onValueChange }: SwitchProps) {
	return (
		<Switch
			value={value === true}
			disabled={disabled ?? undefined}
			accessibilityLabel={
				typeof accessibilityLabel === 'string' ? accessibilityLabel : undefined
			}
			onValueChange={(next) => void onValueChange?.(next)}
		/>
	);
}

export default FallbackSwitch;
