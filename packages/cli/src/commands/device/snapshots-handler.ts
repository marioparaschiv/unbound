import type { CommandHandler } from '~/lib/lazy-handler';
import { listSnapshots } from '~/lib/device-state';

import type snapshotsCommand from './snapshots';

const handler: CommandHandler<typeof snapshotsCommand.schema> = async () => listSnapshots();

export default handler;
