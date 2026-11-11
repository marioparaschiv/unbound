import type { AddonKind } from '@unbound-app/types/addons';

import type { UpdatableKind } from '~/addons/manager-of';
import { Manager } from '~/addons/manager';
import { Addons } from '~/addons/addons';

/**
 * @description Whether an addon kind installs from a manifest URL, which also makes it updatable and holdable.
 * @param kind The addon kind.
 * @returns Whether the kind's manager is an {@link Addons} manager.
 */
export function installsFromManifest(kind: AddonKind): kind is UpdatableKind {
	return Manager.for(kind) instanceof Addons;
}
