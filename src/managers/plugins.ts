import Manager, { ManagerType } from './base';
import { Addon } from '@typings/managers';

class Plugins extends Manager {
  constructor() {
    super(ManagerType.Plugins);
  }

  get addons(): Addon[] {
    return [
      {
        started: false,
        instance: { start: () => { }, stop: () => { } },
        id: '123.1',
        failed: true,
        data: {
          name: 'Show Hidden Channels',
          id: '123.1',
          bundle: '123.1',
          description: 'Displays all hidden channels which can\'t be accessed, this won\'t allow you to read them.',
          version: '1.0.0',
          authors: [
            {
              name: 'eternal',
              id: "226677096091484160"
            }
          ]
        }
      }
    ];
  }
}

export default new Plugins();