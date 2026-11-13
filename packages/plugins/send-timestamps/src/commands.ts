import { commands } from '@unbound-app/api';

import { parseMoment, timestamp } from '~/lib/timestamps';

/**
 * @description Adds `/timestamp`, which sends a date and time as a timestamp in the picked style.
 */
export function registerTimestamp(): void {
	commands.register({
		timestamp: {
			description: 'TIMESTAMP_DESC',
			options: {
				time: commands.option.string({ description: 'TIME_DESC', required: true }),
				style: commands.option.choice(
					{
						R: 'STYLE_RELATIVE',
						t: 'STYLE_SHORT_TIME',
						T: 'STYLE_LONG_TIME',
						d: 'STYLE_SHORT_DATE',
						D: 'STYLE_LONG_DATE',
						f: 'STYLE_SHORT_FULL',
						F: 'STYLE_LONG_FULL',
					},
					{ description: 'STYLE_DESC' },
				),
			},
			execute: ({ time, style }) => {
				const moment = parseMoment(time);

				if (!moment) {
					return {
						ephemeral: true,
						content: `"${time}" is not a time Unbound understands.`,
					};
				}

				return timestamp(moment, style ?? 'f');
			},
		},
	});
}
