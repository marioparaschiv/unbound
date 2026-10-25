import { Events, Listener, type StoreRegistryValue } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { blue, gray, yellow } from 'colorette';

const dev = process.env.NODE_ENV !== 'production';

const BANNER = String.raw`

                @@@@@@@@@
             @@@@@@@@@@@@@      @@@@@@@@@@@
           @@@@@@@@@@@@@@@      @@@@@@@@@@@@@@
          @@@@@@@               @@@@@@@@@@@@@@@
    @@@@@@@@@@@@@@@                       @@@@@@@
   @@@@@@@@@@@@@@@@@                    @@@@@@@@@@@@@@@@@@
   @@@@@@@@@@@@@@@@@                   @@@@@@@@@@@@@@@@@@
          @@@@@                        @@@@@@@@@@@@@@@@@
          @@@@@@@                          @@@@@@
           @@@@@@@@@@@@@@@@@@             @@@@@@@
             @@@@@@@@@@@@@@@@      @@@@@@@@@@@@@
                @@@@@@@@@@@@@      @@@@@@@@@@@
                                   @@@@@@@@

`;

@ApplyOptions<Listener.Options>({ event: Events.ClientReady, once: true })
export class ReadyListener extends Listener<typeof Events.ClientReady> {
	private readonly style = dev ? yellow : blue;

	public override run() {
		console.log(BANNER);
		this.printStoreDebugInformation();
	}

	private printStoreDebugInformation() {
		const { client, logger } = this.container;
		const stores = [...client.stores.values()];
		const last = stores.pop();

		for (const store of stores) {
			logger.info(this.styleStore(store, false));
		}

		if (last) {
			logger.info(this.styleStore(last, true));
		}
	}

	private styleStore(store: StoreRegistryValue, last: boolean) {
		const size = this.style(store.size.toString().padEnd(3, ' '));

		return gray(`${last ? '└─' : '├─'} Loaded ${size} ${store.name}.`);
	}
}
