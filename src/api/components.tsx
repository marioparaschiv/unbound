import { createPatcher } from './patcher';
import { Dispatcher, React } from '@metro/common';
import { uuid } from './utilities';

const Patcher = createPatcher('components');

const unknown = new Set();
const named = new Map();

Patcher.before(React, 'createElement', (_, args) => {
  const component = args[0] as any;

  if (component.displayName) {
    add(component.displayName, component);
  } else if (component.name) {
    add(component.name, component);
  } else if (component.type?.name) {
    add(component.type.name, component);
  } else if (component.type?.displayName) {
    add(component.type.displayName, component);
  } else if (component.render?.displayName) {
    add(component.render.displayName, component);
  } else if (component.render?.name) {
    add(component.render.name, component);
  } else {
    unknown.add(component);
  }

  if (typeof component === 'function' && component.renderPatched !== void 0) {
    args[0] = component.renderPatched;
  }

  return args;
});

Patcher.after(React, 'createElement', (_, __, res) => {
  function traverse(element) {
    if (element?.type && typeof element.type !== 'string') {
      const component = element.type;

      if (component.displayName) {
        add(component.displayName, component);
      } else if (component.name) {
        add(component.name, component);
      } else if (component.type?.name) {
        add(component.type.name, component);
      } else if (component.type?.displayName) {
        add(component.type.displayName, component);
      } else if (component.render?.displayName) {
        add(component.render.displayName, component);
      } else if (component.render?.name) {
        add(component.render.name, component);
      } else {
        unknown.add(component);
      }

      const { children } = element.props || {};
      const payload = (() => {
        if (!children) {
          return [];
        }

        if (!Array.isArray(children)) {
          return [children];
        }

        return children;
      })();

      for (const child of payload) {
        traverse(child);
      }
    }
  }

  if (res) traverse(res);
});


export function add(name, component) {
  if (name === 'AppContainer') {
    patchAppContainer(component);
  }

  if (!named.get(name)) {
    named.set(name, component);
  }
}

export function getAll() {
  return {
    named: Object.fromEntries(named.entries()),
    unknown: [...unknown.values()]
  };
}

export function getByName(name: string): React.FC | void {
  return named.get(name);
}

export function forceUpdateApp() {
  return Dispatcher.dispatch({ type: 'FORCE_UPDATE_APP' });
}

function patchAppContainer(component: React.ComponentType) {
  let instance;

  function handler() {
    if (!instance?.forceUpdate) return;

    const unpatch = Patcher.after(component.prototype, 'render', (self, args, res) => {
      unpatch();

      const id = uuid();

      self.key = id;
      res.key = id;
      res.ref = () => self.forceUpdate();
    });

    instance.forceUpdate();
  }

  // Patcher.before(component.prototype, 'componentWillMount', (self, args) => {
  //   (() => {
  //     instance = self;
  //     Dispatcher.subscribe('FORCE_UPDATE_APP', handler);
  //   })();

  //   return args;
  // });

  // Patcher.before(component.prototype, 'componentWillUnmount', (self, args) => {
  //   (() => {
  //     instance = self;
  //     Dispatcher.unsubscribe('FORCE_UPDATE_APP', handler);
  //   })();

  //   return args;
  // });
}