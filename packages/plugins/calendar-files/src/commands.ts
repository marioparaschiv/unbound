import type { PluginContext } from '@unbound-app/api/native';
import { attachFile } from '@unbound-plugins/shared/composer/attach-file';
import { commands } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import { buildCalendar, readStart } from '~/lib/event-file';

const DEFAULT_MINUTES = 60;

function fileName(title: string): string {
	return `${
		title
			.replace(/[^\w-]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40) || 'event'
	}.ics`;
}

/**
 * @description Adds `/event`, which builds a calendar invite and attaches it to the message being written.
 * @param context The plugin context, whose temporary folder holds the file.
 */
export function registerEvent(context: PluginContext): void {
	commands.register({
		event: {
			description: 'EVENT_DESC',
			options: {
				title: commands.option.string({ description: 'EVENT_TITLE', required: true }),
				start: commands.option.string({ description: 'EVENT_START', required: true }),
				minutes: commands.option.integer({ description: 'EVENT_MINUTES' }),
				location: commands.option.string({ description: 'EVENT_LOCATION' }),
			},
			async execute({ title, start, minutes, location }, { channel }) {
				const begins = readStart(start);

				if (!begins) return { content: format('BAD_START', { start }), ephemeral: true };

				const file = fileName(title);
				const attached = await attachFile(
					channel.id,
					buildCalendar({
						title,
						start: begins,
						minutes: minutes ?? DEFAULT_MINUTES,
						location,
					}),
					{ folder: context.tempPath, filename: file, mimeType: 'text/calendar' },
				);

				return {
					content: attached ? format('ATTACHED', { file }) : messages.ATTACH_FAILED,
					ephemeral: true,
				};
			},
		},
	});
}

export default { registerEvent };
