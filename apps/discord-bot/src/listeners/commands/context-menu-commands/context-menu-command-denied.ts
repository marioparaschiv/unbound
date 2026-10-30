import type { ContextMenuCommandDeniedPayload, UserError } from '@sapphire/framework';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { replyDeniedInteraction } from '~/lib/command-denied';

@ApplyOptions<Listener.Options>({ event: Events.ContextMenuCommandDenied })
export class ContextMenuCommandDeniedListener extends Listener<
	typeof Events.ContextMenuCommandDenied
> {
	public override run(error: UserError, { interaction }: ContextMenuCommandDeniedPayload) {
		return replyDeniedInteraction(error, interaction);
	}
}
