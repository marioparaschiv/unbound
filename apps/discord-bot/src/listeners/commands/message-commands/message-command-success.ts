import type { MessageCommandSuccessPayload } from '@sapphire/framework';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { isDebugLogging, logSuccessCommand } from '~/lib/log-command';

@ApplyOptions<Listener.Options>({ event: Events.MessageCommandSuccess })
export class MessageCommandSuccessListener extends Listener<typeof Events.MessageCommandSuccess> {
	public override run(payload: MessageCommandSuccessPayload) {
		logSuccessCommand(payload);
	}

	public override onLoad() {
		this.enabled = isDebugLogging();

		return super.onLoad();
	}
}
