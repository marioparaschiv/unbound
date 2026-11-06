import { memo } from 'react';

import { ADVANCED_GROUPS, type OverrideValues } from '~/lib/theme-maker/advanced-overrides';
import ColorField from '~/components/theme-maker/color-field';
import Text from '~/components/ui/text';

type AdvancedColorsProps = {
	/** The generated colour each field shows until it is set. */
	defaults: OverrideValues;
	overrides: OverrideValues;
	/** Sets an override, or clears it with `undefined`. */
	onChange: (id: string, value: string | undefined) => void;
};

/**
 * @description Advanced mode's grouped colour fields, each set over the generated colour or reset to it.
 * @param props The generated colours, the user's overrides and the change handler.
 * @returns The groups.
 */
function AdvancedColors({ defaults, overrides, onChange }: AdvancedColorsProps) {
	return (
		<div className='flex flex-col gap-8'>
			{ADVANCED_GROUPS.map((group) => (
				<div key={group.label} className='flex flex-col gap-4'>
					<Text variant='text-sm' className='font-semibold'>
						{group.label}
					</Text>
					<div className='gap-x-6 gap-y-5 grid sm:grid-cols-2'>
						{group.overrides.map((override) => (
							<ColorField
								key={override.id}
								label={override.label}
								value={overrides[override.id] ?? defaults[override.id] ?? '#000000'}
								edited={override.id in overrides}
								onChange={(value) => onChange(override.id, value)}
								onReset={() => onChange(override.id, undefined)}
							/>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

// Memoised so a dragged base colour re-renders it only once the deferred defaults settle.
export default memo(AdvancedColors);
