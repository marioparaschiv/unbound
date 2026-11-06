import { memo } from 'react';

import type { RawColors } from '~/lib/theme-maker/ramp';
import Text from '~/components/ui/text';

type RampStripsProps = {
	raws: RawColors;
};

const RAMPS = [
	{ label: 'Backgrounds & Text', family: 'NEUTRAL' },
	{ label: 'Accent', family: 'BLURPLE' },
	{ label: 'Mentions', family: 'YELLOW_NEW' },
];

// Every fifth step of Discord's 100-step ramps, from lightest to darkest.
const STEPS = [1, ...Array.from({ length: 20 }, (_, index) => (index + 1) * 5)];

/**
 * @description The generated ramps as swatch strips, one per user colour.
 * @param props The generated raws.
 * @returns The strips.
 */
function RampStrips({ raws }: RampStripsProps) {
	return (
		<div className='flex flex-col gap-4'>
			{RAMPS.map(({ label, family }) => (
				<div key={family} className='flex flex-col gap-2'>
					<Text variant='text-sm' color='muted'>
						{label}
					</Text>
					<div className='flex rounded-inner ring-1 ring-border h-8 overflow-hidden'>
						{STEPS.map((step) => {
							const name = `${family}_${step}`;

							return (
								<span
									key={name}
									title={`${name} ${raws[name] ?? ''}`}
									className='flex-1'
									style={{ background: raws[name] }}
								/>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
}

// Memoised so a dragged colour picker re-renders it only once the deferred colours settle.
export default memo(RampStrips);
