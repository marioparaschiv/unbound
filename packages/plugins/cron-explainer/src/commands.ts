import { commands } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import { deviceTimezone, knownTimezone, suggestTimezones } from '~/lib/timezones';
import { CronError, parseCron } from '~/lib/cron';
import { describeCron } from '~/lib/describe';
import { nextRuns } from '~/lib/next-runs';

const DEFAULT_COUNT = 5;
const MAX_COUNT = 10;

function runText(date: Date, timeZone: string): string {
	return new Intl.DateTimeFormat(undefined, {
		timeZone,
		weekday: 'short',
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	}).format(date);
}

function errorText(error: CronError): string {
	switch (error.code) {
		case 'FIELD_COUNT':
			return messages.FIELD_COUNT;
		case 'BAD_FIELD':
			return format('BAD_FIELD', { field: error.field });
		case 'UNKNOWN_MACRO':
			return format('UNKNOWN_MACRO', { field: error.field });
	}
}

function explanation(expression: string, timeZone: string, count: number): string {
	const cron = parseCron(expression);
	const runs = nextRuns(cron, timeZone, new Date(), count);
	const list = runs.length
		? runs.map((run) => `- ${runText(run, timeZone)}`).join('\n')
		: messages.NO_RUNS;

	return [
		`\`${cron.source}\``,
		describeCron(cron),
		'',
		format('NEXT_RUNS', { timezone: timeZone }),
		list,
	].join('\n');
}

/**
 * @description Adds `/cron`, which explains a cron expression and lists its next runs in a chosen timezone, privately
 * unless asked to send it.
 */
export function registerCron(): void {
	commands.register({
		cron: {
			description: 'CRON_DESC',
			options: {
				expression: commands.option.string({
					description: 'CRON_EXPRESSION',
					required: true,
				}),
				timezone: commands.option.string({
					description: 'CRON_TIMEZONE',
					autocomplete: (query) => suggestTimezones(query),
				}),
				count: commands.option.integer({
					description: 'CRON_COUNT',
					minValue: 1,
					maxValue: MAX_COUNT,
				}),
				send: commands.option.boolean({ description: 'CRON_SEND' }),
			},
			execute({ expression, timezone, count, send }) {
				const timeZone = timezone ? knownTimezone(timezone) : deviceTimezone();

				if (!timeZone) {
					return {
						content: format('BAD_TIMEZONE', { timezone: timezone ?? '' }),
						ephemeral: true,
					};
				}

				try {
					const content = explanation(expression, timeZone, count ?? DEFAULT_COUNT);

					return send ? { content } : { content, ephemeral: true };
				} catch (error) {
					if (!(error instanceof CronError)) throw error;

					return { content: errorText(error), ephemeral: true };
				}
			},
		},
	});
}

export default { registerCron };
