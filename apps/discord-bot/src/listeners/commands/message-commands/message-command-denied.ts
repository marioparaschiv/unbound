import type { MessageCommandDeniedPayload, UserError } from '@sapphire/framework';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<Listener.Options>({ event: Events.MessageCommandDenied })
export class MessageCommandDeniedListener extends Listener<typeof Events.MessageCommandDenied> {
	public override async run(
		{ context, message: content }: UserError,
		{ message }: MessageCommandDeniedPayload,
	) {
		// A precondition passes `context: { silent: true }` to deny without replying.
		if (Reflect.get(Object(context), 'silent')) return;

		return message.reply({
			content,
			allowedMentions: { users: [message.author.id], roles: [] },
		});
	}
}
