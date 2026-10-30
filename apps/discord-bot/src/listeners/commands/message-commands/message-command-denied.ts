import type { MessageCommandDeniedPayload, UserError } from '@sapphire/framework';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { replyDeniedMessage } from '~/lib/command-denied';

@ApplyOptions<Listener.Options>({ event: Events.MessageCommandDenied })
export class MessageCommandDeniedListener extends Listener<typeof Events.MessageCommandDenied> {
	public override run(error: UserError, { message }: MessageCommandDeniedPayload) {
		return replyDeniedMessage(error, message);
	}
}
