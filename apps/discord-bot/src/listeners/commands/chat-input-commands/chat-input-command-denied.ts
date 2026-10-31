import type { ChatInputCommandDeniedPayload, UserError } from '@sapphire/framework';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { replyDeniedInteraction } from '~/lib/command-denied';

@ApplyOptions<Listener.Options>({ event: Events.ChatInputCommandDenied })
export class ChatInputCommandDeniedListener extends Listener<typeof Events.ChatInputCommandDenied> {
	public override run(error: UserError, { interaction }: ChatInputCommandDeniedPayload) {
		return replyDeniedInteraction(error, interaction);
	}
}
