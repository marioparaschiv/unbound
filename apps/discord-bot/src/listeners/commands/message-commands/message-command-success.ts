import type { MessageCommandSuccessPayload } from '@sapphire/framework';
import { Events, Listener, LogLevel } from '@sapphire/framework';
import type { Logger } from '@sapphire/plugin-logger';
import { ApplyOptions } from '@sapphire/decorators';

import { logSuccessCommand } from '~/lib/log-command';

@ApplyOptions<Listener.Options>({ event: Events.MessageCommandSuccess })
export class MessageCommandSuccessListener extends Listener<typeof Events.MessageCommandSuccess> {
	public override run(payload: MessageCommandSuccessPayload) {
		logSuccessCommand(payload);
	}

	public override onLoad() {
		this.enabled = (this.container.logger as Logger).level <= LogLevel.Debug;

		return super.onLoad();
	}
}
