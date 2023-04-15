import { createPatcher } from '@patcher';
import { createLogger } from '@logger';

const Patcher = createPatcher('components');
const Logger = createLogger('Components');

const unknown = new Set();
const named = new Map();

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

try {
  Patcher.before(window.React, 'createElement', (_, args) => {
    const [component] = args;

    if (component) traverse(component);

    // @ts-expect-error
    if (typeof component === 'function' && component.renderPatched !== void 0) {
      // @ts-expect-error
      args[0] = component.renderPatched;
    }

    return args;
  });

  Patcher.after(React, 'createElement', (_, __, res) => {
    if (res) traverse(res);
  });
} catch (e) {
  Logger.error('Failed to intercept React.createElement:', e.message);
}

export function add(name, component) {
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