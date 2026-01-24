# Unbound Client Detailed Roadmap

## Current State

### ✅ Completed
- Core manager system (plugins, themes)
- Storage API with event-driven persistence
- Metro module resolver with caching
- Native bridge (iOS UnboundNative)
- File system API
- WebSocket debugger
- Type system (@unbound-app/types)
- Logger package (@unbound-app/logger)

### 🚧 In Progress / Needs Implementation

---

## Phase 1: Core APIs

### 1.1 Assets API
**Priority:** High
**Package:** `packages/client/src/api/assets.ts`

**Implementation:**
```typescript
// Asset discovery and caching
const assets = new Map<number, UnboundAsset>();

// Scan Metro modules for asset exports
for (const id of [...window.modules.keys()]) {
  const exported = window.modules.get(id).publicModule.exports;
  if (typeof exported !== 'number') continue;

  const asset = Assets.getAssetByID(exported);
  if (!asset) continue;

  assets.set(exported, asset);
}

// API methods
export function getByName(name: string, type: 'svg' | 'png'): UnboundAsset | null
export function getByID(id: number): UnboundAsset | null
export function getIDByName(name: string, type: 'svg' | 'png'): number | null

// Proxy for convenient access: Icons.IconName → asset ID
export const Icons = new Proxy({}, {
  get: (_, name) => getIDByName(name)
});
```

**Key Points:**
- Cache asset IDs in storage for faster startup
- Use Metro's `Assets.getAssetByID()` helper
- Support both SVG and PNG asset types
- Lazy initialization to avoid blocking startup
- Icon proxy pattern for developer ergonomics

---

### 1.2 Commands API
**Priority:** High
**Package:** `packages/client/src/api/commands.ts`

**Implementation:**
```typescript
export function buildCommands(caller: string, cmds: UnboundCommand[]): UnboundCommand[] {
  // Normalize Discord command structure
  for (const cmd of cmds) {
    cmd.type ??= 1;
    cmd.inputType ??= 1;
    cmd.id ??= uuid();
    cmd.applicationId ??= '-1';
    cmd.displayName ??= cmd.name;
    cmd.displayDescription ??= cmd.description;
    cmd.untranslatedName ??= cmd.name;
    cmd.untranslatedDescription ??= cmd.description;

    cmd.__UNBOUND__ = true;
    cmd.__CALLER__ = caller;

    // Normalize options
    cmd.options = cmd.options?.map(option => ({
      ...option,
      displayName: option.name,
      displayDescription: option.description
    }));
  }

  return cmds;
}

export function registerCommands(caller: string, cmds: UnboundCommand[]): void
export function unregisterCommands(caller: string): void
```

**Architecture:**
- Built-in module manages global command registry
- Commands patch Discord's command system via possess
- Each command tagged with `__CALLER__` for cleanup
- Support for command options (arguments)
- Auto-fill Discord-specific fields

**Integration:**
- Patch Discord's command registration system
- Inject Unbound commands into command palette
- Filter by `__UNBOUND__` flag in UI

---

### 1.3 Toasts API
**Priority:** High
**Package:** `packages/client/src/api/toasts.ts`

**Implementation:**
```typescript
export function showToast(options: ToastOptions) {
  const store = ToastStore.getState();
  options.id ??= uuid();
  return store.addToast(options);
}
```

**Store:** `packages/client/src/stores/toasts.ts`
```typescript
interface ToastStore {
  toasts: Toast[];
  addToast: (options: ToastOptions) => string;
  removeToast: (id: string) => void;
}

const ToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (options) => {
    const id = options.id || uuid();
    set((state) => ({
      toasts: [...state.toasts, { ...options, id }]
    }));

    if (options.duration !== 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id)
        }));
      }, options.duration || 3000);
    }

    return id;
  },
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id)
  }))
}));
```

**UI Component:** `packages/client/src/ui/toasts/toast-container.tsx`
- Portal rendering (always on top)
- Animated entry/exit (React Native Reanimated)
- Configurable position (top/bottom)
- Icon support
- Action buttons

---

### 1.4 Dialogs API
**Priority:** High
**Package:** `packages/client/src/api/dialogs.tsx`

**Implementation:**
```typescript
export function showDialog(options: AlertDialogProps) {
  options.key ??= uuid();

  Discord.openAlert(options.key, (
    <Discord.AlertModal
      title={options.title}
      content={options.content}
      actions={(
        <>
          {options.component && (
            <View style={{ marginTop: !options.content ? -32 : -8 }}>
              {options.component}
            </View>
          )}
          {options.buttons?.map(button => (
            createElement(
              Discord[button.closeAlert ? 'AlertActionButton' : 'Button'],
              button
            )
          ))}
          {options.cancelButton && (
            <Discord.AlertActionButton
              text={Strings.UNBOUND_CANCEL}
              variant='secondary'
              onPress={() => options.onCancel?.()}
            />
          )}
        </>
      )}
    />
  ));
}
```

**Key Features:**
- Uses Discord's native AlertModal component
- Custom component injection support
- Multiple action buttons
- Optional cancel button
- Auto-generates keys with uuid

**Metro Dependencies:**
- `Discord.openAlert` (alert system)
- `Discord.AlertModal` (modal component)
- `Discord.AlertActionButton` (button component)

---

### 1.5 i18n API
**Priority:** Medium
**Package:** `packages/client/src/api/i18n.ts`

**Implementation:**
```typescript
export const state = {
  locale: 'en-US',
  messages: {},
};

function initialize() {
  state.locale = navigator.language || 'en-US';

  // Load core strings from @unbound-app/i18n package
  state.messages = CoreStrings[state.locale] || CoreStrings['en-US'];
}

export const Strings: Record<string, string> = new Proxy({}, {
  get(_, prop) {
    return state.messages[prop] || CoreStrings['en-US']?.[prop] || 'MISSING_STRING';
  }
});

export function setLocale(locale: string) {
  state.locale = locale;
  state.messages = CoreStrings[locale] || CoreStrings['en-US'];
}
```

**String Formatting:**
```typescript
// Backwards compat extension (used by old plugins)
String.prototype.format = function(...args) {
  return this.replace(/{(\d+)}/g, (match, index) => {
    return typeof args[index] !== 'undefined' ? args[index] : match;
  });
};
```

**Locales Package:** `packages/i18n/`
- JSON files per locale (en-US.json, es-ES.json, etc.)
- Exported as JS object for tree-shaking
- Core Unbound strings only
- Plugins provide their own translations

---

### 1.6 Settings API
**Priority:** Low (covered by storage API)
**Status:** Merge into storage API

Current storage API already provides:
- `getStore(name)` for namespaced settings
- Event-driven updates via EventEmitter
- React hook: `useSettingsStore()`
- Debounced persistence

**No separate Settings API needed** - storage API is sufficient.

---

## Phase 2: Built-ins

### 2.1 Error Boundary
**Priority:** Critical
**Package:** `packages/client/src/builtins/error-boundary.tsx`

**Implementation:**
```typescript
class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    Logger.error('React Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          onReset={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}
```

**Patches:**
```typescript
// Patch Discord's root component to wrap with ErrorBoundary
Patcher.after(Discord, 'App', (_, __, result) => {
  return <ErrorBoundary>{result}</ErrorBoundary>;
});
```

**UI Fallback:**
- Display error message
- Show stack trace (collapsed)
- "Reload" button → trigger app reload
- "Copy Error" button → clipboard
- "Report Bug" button → open GitHub issue

---

### 2.2 Commands Built-in
**Priority:** High
**Package:** `packages/client/src/builtins/commands.ts`

**Implementation:**
```typescript
export const data = {
  commands: [] as UnboundCommand[],
};

export function start() {
  // Patch Discord's command system
  Patcher.after(CommandStore, 'getBuiltInCommands', (_, __, result) => {
    return [...result, ...data.commands];
  });

  // Register core commands
  registerCommands('unbound', [
    {
      name: 'debug',
      description: 'Toggle debug mode',
      execute: () => { /* ... */ }
    },
    {
      name: 'reload',
      description: 'Reload the app',
      execute: () => BundleManager.reload()
    },
    {
      name: 'recovery',
      description: 'Enable recovery mode',
      execute: () => { /* ... */ }
    }
  ]);
}

export function stop() {
  Patcher.unpatchAll();
}
```

**Core Commands:**
- `/debug` - Toggle debugger connection
- `/reload` - Reload app
- `/recovery` - Enter recovery mode (disable all plugins)
- `/eval <code>` - Evaluate JavaScript
- `/clear` - Clear console/chat
- `/plugins` - Open plugins settings
- `/themes` - Open themes settings

---

### 2.3 Toasts Built-in
**Priority:** High
**Package:** `packages/client/src/builtins/toasts.tsx`

**Implementation:**
```typescript
export function start() {
  // Patch Discord's root to inject toast container
  Patcher.after(Discord, 'App', (_, __, result) => {
    return (
      <>
        {result}
        <ToastContainer />
      </>
    );
  });
}
```

**ToastContainer:**
```tsx
export function ToastContainer() {
  const toasts = ToastStore((state) => state.toasts);

  return (
    <Portal>
      <View style={styles.container}>
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </View>
    </Portal>
  );
}
```

**Toast Component:**
- Animated slide-in/out
- Icon rendering (assets API)
- Action buttons
- Swipe to dismiss
- Auto-dismiss timer

---

### 2.4 Tracking Blocker
**Priority:** Medium
**Package:** `packages/client/src/builtins/tracking.ts`

**Implementation:**
```typescript
export function start() {
  // Block Discord analytics
  Patcher.instead(AnalyticsStore, 'track', () => {});
  Patcher.instead(AnalyticsStore, 'trackWithMetadata', () => {});

  // Block Sentry error reporting
  Patcher.instead(SentryModule, 'captureException', () => {});

  Logger.info('Tracking blocked');
}
```

**Configurable:**
- Settings toggle: `unbound.tracking.blocked`
- Whitelist certain events (e.g., voice state for functionality)

---

### 2.5 Design System
**Priority:** Low
**Package:** `packages/client/src/builtins/design.ts`

**Implementation:**
```typescript
export function start() {
  const enabled = Settings.get('design.enabled', false);
  if (!enabled) return;

  // Apply design tokens
  applyDesignTokens();

  // Watch for changes
  Settings.useSettingsStore((payload) => {
    if (payload.key?.startsWith('design.')) {
      applyDesignTokens();
    }
  });
}

function applyDesignTokens() {
  const borderRadius = Settings.get('design.borderRadius', 8);
  const spacing = Settings.get('design.spacing', 16);

  // Patch Discord components with custom styles
  // ...
}
```

---

### 2.6 Staff Mode
**Priority:** Low
**Package:** `packages/client/src/builtins/staff-mode.ts`

**Implementation:**
```typescript
export function start() {
  const enabled = Settings.get('staff-mode.enabled', false);
  if (!enabled) return;

  // Patch Discord's staff check
  Patcher.instead(UserStore, 'isStaff', () => true);

  Logger.warn('Staff mode enabled - experimental features unlocked');
}
```

---

## Phase 3: UI Components

### 3.1 Settings Panel
**Priority:** High
**Package:** `packages/client/src/ui/settings/`

**Structure:**
```
settings/
├── index.tsx       # Main settings page
├── general.tsx     # General settings
├── plugins.tsx     # Plugin list
├── themes.tsx      # Theme list
├── developer.tsx   # Debug/dev options
├── design.tsx      # Design tokens
└── about.tsx       # Version info
```

**Implementation:**
```typescript
// Patch Discord settings to inject Unbound page
Patcher.after(SettingsScreen, 'render', (_, __, result) => {
  const sections = findInReactTree(result, (node) =>
    Array.isArray(node) && node.some((item) => item?.type === 'HEADER')
  );

  sections.splice(2, 0, {
    type: 'SECTION',
    label: 'Unbound',
    icon: Icons.UnboundLogo,
    route: 'UnboundSettings'
  });

  return result;
});

// Register route
Navigation.registerRoute({
  name: 'UnboundSettings',
  component: UnboundSettingsPage
});
```

**Settings Pages:**
1. **General:** Debugger config, recovery mode, tracking blocker
2. **Plugins:** List of installed plugins, enable/disable toggles
3. **Themes:** Theme picker, preview, enable/disable
4. **Developer:** Metro cache, asset browser, command palette
5. **Design:** Border radius, spacing, custom tokens
6. **About:** Version, contributors, links

---

### 3.2 Plugin/Theme Cards
**Priority:** High
**Package:** `packages/client/src/ui/addons/`

**Components:**
- `AddonCard` - Single plugin/theme card with:
  - Name, description, version, authors
  - Enable/disable toggle
  - Settings button (if plugin has settings)
  - Delete button
- `AddonList` - Virtualized list of addon cards
- `AddonSearch` - Search/filter addons

---

### 3.3 Theme Picker
**Priority:** Medium
**Package:** `packages/client/src/ui/theme-picker/`

**Features:**
- Live preview (apply theme temporarily)
- Color palette display
- Import from URL
- Export theme JSON

---

### 3.4 Error Fallback UI
**Priority:** Critical
**Package:** `packages/client/src/ui/error-boundary.tsx`

**Features:**
- Display error name + message
- Collapsible stack trace
- Component stack
- Copy error to clipboard
- Reload app button
- Enter recovery mode button

---

## Phase 4: Loaders (Native Side)

> **Note:** These are implemented in the native iOS/Android code, not TypeScript.
> Listed here for completeness.

### 4.1 Bundle Loader
**Location:** iOS/Android native code
**Function:** Loads main Unbound JavaScript bundle

**Flow:**
1. Check for local bundle in Documents directory
2. If not found, extract from app bundle
3. Initialize React Native with bundle URL
4. Expose `window.UNBOUND_LOADER` with origin and version

---

### 4.2 Plugins Loader
**Location:** iOS/Android native code
**Function:** Discovers and loads plugin bundles

**Flow:**
1. Scan `Unbound/plugins/` directory
2. For each plugin folder:
   - Read `manifest.json`
   - Read `index.js` (bundled code)
3. Populate `window.UNBOUND_PLUGINS` array
4. Client-side plugins manager reads from this array

---

### 4.3 Themes Loader
**Location:** iOS/Android native code
**Function:** Discovers and loads theme JSON files

**Flow:**
1. Scan `Unbound/themes/` directory
2. For each theme folder:
   - Read `manifest.json`
   - Read `theme.json` (color definitions)
3. Populate `window.UNBOUND_THEMES` array
4. Client-side themes manager reads from this array

---

### 4.4 Settings Loader
**Location:** iOS/Android native code
**Function:** Loads persisted settings JSON

**Flow:**
1. Read `Unbound/settings.json`
2. Parse JSON
3. Populate `window.UNBOUND_SETTINGS` object
4. Client-side storage API uses this as initial state

---

### 4.5 Fonts Loader
**Location:** iOS/Android native code
**Function:** Registers custom fonts

**Flow:**
1. Scan `Unbound/fonts/` directory
2. For each `.ttf` or `.otf` file:
   - Register font with system
   - Add to `window.UNBOUND_FONTS` array
3. Fonts available in React Native `fontFamily` style

---

### 4.6 FS Watcher (Development)
**Location:** iOS/Android native code
**Function:** Watches filesystem for changes during development

**Flow:**
1. Start filesystem watcher on `Unbound/` directory
2. On change detected:
   - Send WebSocket message to debugger
   - Reload affected plugin/theme via HMR
3. Only active when debugger connected

---

## Phase 5: Fonts System

### 5.1 Font Manager
**Priority:** Low
**Package:** `packages/client/src/managers/fonts.ts`

**Implementation:**
```typescript
export class Fonts extends Manager<FontEntity> {
  initialize() {
    for (const { name, path } of window.UNBOUND_FONTS ?? []) {
      this.load(name, path);
    }
  }

  load(name: string, path: string) {
    const entity = { name, path, loaded: true };
    this.entities.set(name, entity);
    this.emit('loaded', entity);
  }
}

export const fonts = new Fonts(ManagerType.FONTS);
```

**Usage:**
```typescript
// In plugin/theme
{
  fontFamily: fonts.getEntity('CustomFont')?.name || 'System'
}
```

---

## Phase 6: Developer Tools

### 6.1 React DevTools Integration
**Priority:** Medium
**Package:** Native loader integration

**Implementation:**
- Native loader checks for React DevTools connection
- If detected, inject DevTools backend
- Connect to standalone React DevTools app

---

### 6.2 Metro Cache Viewer
**Priority:** Low
**Package:** `packages/client/src/ui/developer/cache-viewer.tsx`

**Features:**
- Display cached module IDs
- Cache statistics (hit rate, size)
- Clear cache button
- Export cache JSON

---

### 6.3 Asset Browser
**Priority:** Low
**Package:** `packages/client/src/ui/developer/asset-browser.tsx`

**Features:**
- Searchable list of all Discord assets
- Preview SVG/PNG
- Copy asset ID
- Export asset list

---

## Implementation Priority

### Phase 1: Core Infrastructure (Critical)
**Focus:** Functionality, patches, API interfaces, Metro module discovery

1. **Metro Common Modules** (`packages/client/src/api/metro/`)
   - Export commonly used Discord modules (Components, Stores, APIs)
   - Type definitions for Discord modules
   - Lazy loading pattern for all exports
   - Cache validation on Discord updates

2. **Commands API** (`packages/client/src/api/commands.ts`)
   - Command registration/unregistration
   - Patch Discord's command system
   - Built-in module with core commands (/debug, /reload, /recovery, /eval)

3. **Assets API** (`packages/client/src/api/assets.ts`)
   - Asset discovery and caching
   - Icon proxy for ergonomic access
   - Lazy initialization pattern

4. **i18n API** (`packages/client/src/api/i18n.ts`)
   - String loading from npm package
   - Locale switching
   - Proxy pattern for string access

5. **Global Shutdown** (`packages/client/src/api/index.ts`)
   - `unbound.shutdown()` function
   - Cleanup all patches, listeners, state
   - Full hot reload support

### Phase 2: Built-ins (High Priority)
**Focus:** Core functionality, no UI dependencies

6. **Commands Built-in** (`packages/client/src/builtins/commands.ts`)
   - Global command registry
   - Discord command system patches
   - Core commands implementation

7. **Tracking Blocker** (`packages/client/src/builtins/tracking.ts`)
   - Analytics blocking
   - Sentry blocking
   - Configurable whitelist

8. **Staff Mode** (`packages/client/src/builtins/staff-mode.ts`)
   - Unlock experimental Discord features
   - Simple patch on UserStore

9. **Error Boundary** (`packages/client/src/builtins/error-boundary.tsx`)
   - Wrap Discord app component
   - Catch React errors
   - Basic error display (no fancy UI initially)

### Phase 3: Extended APIs (Medium Priority)
**Focus:** Nice-to-have APIs that plugins may use

10. **Dialogs API** (`packages/client/src/api/dialogs.tsx`)
    - Uses Discord's native AlertModal
    - No custom UI, just wrapper API
    - Type-safe interface

### Phase 4: Fonts & Design (Low Priority)
**Focus:** Cosmetic features

11. **Fonts Manager** (`packages/client/src/managers/fonts.ts`)
    - Load custom fonts from native
    - Simple registry pattern

12. **Design System** (`packages/client/src/builtins/design.ts`)
    - Custom design tokens
    - Style patching

### Phase 5: UI Components (Deferred)
**Focus:** UI/UX polish - implement AFTER core functionality

- Settings Panel (all pages)
- Plugin/Theme Cards
- Theme Picker
- Toasts UI
- Error Fallback UI
- Developer Tools UI

**Rationale:** UI requires stable APIs. Build foundation first, polish later.

### Phase 6: npm Package Strategy
**Focus:** Use existing packages where possible

**Packages to Install:**
- `react-native-reanimated` - animations (already in deps)
- `react-native-gesture-handler` - gestures (already in deps)
- Provide typings via @unbound-app/types for Discord modules

**NO custom implementations for:**
- Event emitters (use tseep)
- State management (use zustand)
- Patching (use possess)
- Utilities (use lodash/ramda or create minimal utils package)

---

## Architecture Principles

### 1. Hot Reloadability (CRITICAL)
**Every module MUST be hot-reloadable with full cleanup.**

**Core Pattern:**
```typescript
// Every built-in, manager, and API module
export function start() {
  // Initialize patches, listeners, UI injection
}

export function stop() {
  // Unpatch all
  // Remove event listeners
  // Clean up UI components
  // Restore original state
}
```

**Global Shutdown:**
```typescript
// packages/client/src/api/index.ts
export function shutdown() {
  // Stop all built-ins
  for (const builtin of builtins) {
    builtin.stop?.();
  }

  // Shutdown managers
  plugins.shutdown();
  themes.shutdown();

  // Persist final state
  await storage.persist();

  // Unpatch everything
  globalPatcher.unpatchAll();

  // Clear caches
  metroCache.clear();

  Logger.warn('Unbound shutdown complete - state restored');
}

// Global access
window.unbound.shutdown = shutdown;
```

**Manager Shutdown Pattern:**
```typescript
shutdown() {
  // Unpatch all patches from this manager
  this.patcher.unpatchAll();

  // Stop all entities
  for (const entity of this.entities.values()) {
    if (entity.started) {
      this.stop(entity);
    }
  }

  // Clear state
  this.entities.clear();
  this.errors.clear();
  this.initialized = false;

  // Remove event listeners
  this.removeAllListeners();
}
```

**Built-in Stop Pattern:**
```typescript
export function stop() {
  // 1. Unpatch all patches
  Patcher.unpatchAll();

  // 2. Remove event listeners
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  // 3. Clean up resources
  if (ws?.readyState === WebSocket.OPEN) {
    ws.close();
    ws = null;
  }

  // 4. Remove UI injections
  // (handled automatically by unmounting)
}
```

**UI Injection Cleanup:**
- Use React keys to force remount on reload
- Store patch unpatch functions
- Remove portals on stop

### 2. Lazy Loading
- No built-in should block startup
- Use dynamic imports for heavy modules
- Defer initialization until needed

### 3. Error Isolation
- Each built-in wrapped in try-catch
- Failed built-ins don't crash others
- Recovery mode disables all non-critical features

### 4. Event-Driven
- All state changes emit events
- UI components listen to stores
- Avoid prop drilling

### 5. Metro Pattern Matching
- Use filters for finding Discord modules
- Cache results for performance
- Validate modules before use

### 6. Patch Scoping
- Each built-in gets own patcher instance
- Patches namespaced by caller
- Cleanup on disable/unload

### 7. Storage Namespacing
- Each built-in gets own storage namespace
- Debounced persistence to avoid I/O spam
- React hooks for reactive UI

### 8. Type Safety & Type Co-location
- All APIs fully typed
- Generic constraints for type inference
- No `any` types in public API surface

**Type Co-location Pattern:**
```typescript
// packages/client/src/api/commands.ts

// Local types defined in same file
export interface UnboundCommand {
  id: string;
  name: string;
  description: string;
  execute: (args: any[]) => void | Promise<void>;
  options?: CommandOption[];
  __UNBOUND__?: boolean;
  __CALLER__?: string;
}

export interface CommandOption {
  name: string;
  description: string;
  type: number;
  required?: boolean;
}

// Re-export relevant types from other packages that plugin developers need
export type { AddonManifest } from '@unbound-app/types';

// API implementation
export function registerCommands(caller: string, cmds: UnboundCommand[]): void {
  // ...
}
```

**Rules:**
1. **Define types locally** - don't import types from distant packages unless necessary
2. **Re-export relevant types** - if an API uses types from managers/stores, re-export them
3. **Plugin-facing types** - any type a plugin developer needs should be accessible from the API module
4. **No type pollution** - don't export internal implementation types

**Example Structure:**
```typescript
// packages/client/src/api/assets.ts
export interface UnboundAsset {
  id: number;
  name: string;
  type: 'svg' | 'png';
  uri: string;
}

export function getByName(name: string, type: 'svg' | 'png'): UnboundAsset | null;
export function getByID(id: number): UnboundAsset | null;

// Re-export for convenience
export type { ColorString } from '@unbound-app/types';
```

```typescript
// packages/client/src/api/storage.ts
export interface SettingsPayload {
  store: string;
  key: string | null;
  value: any;
}

// Don't need to re-export EventEmitter - internal only
export function get<T>(store: string, key: string, def: T): T;
export function set(store: string, key: string, value: any): void;
```

**Benefits:**
- Plugin developers import once: `import { showDialog, AlertDialogProps } from 'unbound/dialogs'`
- No hunting through packages for types
- Tree-shaking friendly
- Clear API surface

---

## Testing Strategy

### Unit Tests
- API function behavior
- Manager lifecycle methods
- Utility functions

### Integration Tests
- Built-in initialization
- Patch application
- Event emission

### E2E Tests
- Plugin install flow
- Theme switching
- Settings persistence
- Error recovery

---

## Migration from Old Architecture

### Key Changes
1. **No BuiltInData pattern** - built-ins are just modules with start/stop
2. **Managers use ManagerType enum** - not strings
3. **Storage is unified** - no separate settings API
4. **Patcher is possess library** - not custom wrapper
5. **Zustand for React state** - not custom stores

### Migration Checklist
- [ ] Convert built-ins to new pattern (no BuiltInData)
- [ ] Update metro exports structure
- [ ] Move utilities to @unbound-app/utils package
- [ ] Rewrite UI components for new architecture
- [ ] Update type definitions
- [ ] Port commands system
- [ ] Port dialogs/toasts
- [ ] Create error boundary
- [ ] Build settings panel

---

## Performance Targets

- **Startup Time:** < 500ms initialization overhead
- **Metro Caching:** 90%+ cache hit rate on warm start
- **Bundle Size:** < 200KB gzipped for core
- **Memory:** < 50MB for Unbound runtime
- **Patches:** < 10ms patch application time

---

## Security Considerations

**Reality Check:** Unbound runs in the same JavaScript context as Discord. There is no sandboxing, no isolation, no security boundary.

### What We Actually Need

1. **Code Review Culture**
   - Plugins have full access to Discord's internals
   - Users should review plugin source before installing
   - Plugin marketplace should require open source
   - Community code review > security theater

2. **Recovery Mode**
   - When plugins break Discord, users can disable all plugins
   - Boot with recovery flag to restore functionality
   - No need for complex permission systems

3. **Hot Reload Safety**
   - All modules must be unloadable
   - `shutdown()` must restore Discord to original state
   - No memory leaks, no orphaned patches
   - Clean slate on reload

### What We DON'T Need

❌ **Permission Systems** - pointless in same context
❌ **Plugin Sandboxing** - impossible in JavaScript
❌ **API Rate Limiting** - plugins are trusted code
❌ **Code Signing** - review source instead
❌ **Encryption** - OS already sandboxes app storage
❌ **Network Restrictions** - plugins need network access for features

### Actual Risks & Mitigations

**Risk:** Malicious plugin steals Discord token
- **Mitigation:** Review plugin source, community trust

**Risk:** Plugin crashes Discord
- **Mitigation:** Recovery mode, error boundaries

**Risk:** Plugin breaks on Discord update
- **Mitigation:** Version pinning, update notifications

**Risk:** Memory leaks from bad plugins
- **Mitigation:** Hot reload, `shutdown()` cleanup

**Risk:** Debugger WebSocket exposed on network
- **Mitigation:** None needed - development only, localhost binding

### Philosophy

We're building a **power user tool** for **modifying a mobile app**. The threat model is:
- User wants to customize Discord
- User installs plugins from trusted sources
- User accepts plugins have full access
- User wants to recover if something breaks

We're NOT building:
- Enterprise security
- Malware protection
- Multi-tenant isolation
- Zero-trust architecture

**If you don't trust a plugin, don't install it.** Simple.
