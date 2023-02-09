import Manager, { ManagerType } from './base';

class Plugins extends Manager {
  constructor() {
    super(ManagerType.Plugins);

    this.initialize();
  }

  initialize() {
    this.entities.set('eternal.show-hidden-channels', {
      started: false,
      instance: { start: () => { }, stop: () => { } },
      id: 'eternal.show-hidden-channels',
      failed: true,
      data: {
        name: 'Show Hidden Channels',
        id: 'eternal.show-hidden-channels',
        bundle: 'http://192.168.0.35:8080/ShowHiddenChannels.js',
        description: 'Displays all hidden channels which can\'t be accessed, this won\'t allow you to read them.',
        version: '1.0.0',
        authors: [
          {
            name: 'eternal',
            id: '226677096091484160'
          }
        ]
      }
    });
  }
}

export default new Plugins();