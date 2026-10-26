({__plugin:null,__load(){if(this.__plugin)return this.__plugin;this.__plugin=(function () {
'use strict';
function isPending(result) {
    return typeof (result === null || result === void 0 ? void 0 : result.then) === 'function';
}
/**
 * @description Applies a plugin's features in order and returns one cleanup that removes them in reverse.
 * If a feature throws, the features already applied are removed, so a plugin is never left half-applied.
 * @param plugin The plugin's display name, used in the log lines.
 * @param features Functions that each apply one feature and return the function that removes it; a removal may return a promise for native work that must finish before the plugin's native scope closes.
 * @returns A function that removes every applied feature; return its result from `stop`, since it is a promise while any removal is still finishing.
 */ function applyFeatures(plugin, features) {
    var cleanups = [];
    function dispose() {
        var pending = cleanups.splice(0).reverse().map(function(cleanup) {
            return cleanup();
        }).filter(isPending);
        if (!pending.length) return;
        return Promise.allSettled(pending).then(function(results) {
            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
            try {
                for(var _iterator = results[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                    var result = _step.value;
                    if (result.status === 'rejected') {
                        console.error("[".concat(plugin, "] Failed to clean up:"), result.reason);
                    }
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally{
                try {
                    if (!_iteratorNormalCompletion && _iterator.return != null) {
                        _iterator.return();
                    }
                } finally{
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }
        });
    }
    try {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = features[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var feature = _step.value;
                cleanups.push(feature());
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion && _iterator.return != null) {
                    _iterator.return();
                }
            } finally{
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
    } catch (error) {
        void dispose();
        console.error("[".concat(plugin, "] Failed to start, reverted:"), error);
    }
    return dispose;
}function lazyMarker(handle) {
    try {
        var _Object_getOwnPropertyDescriptor;
        return ((_Object_getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor(handle, '__METRO_LAZY__')) === null || _Object_getOwnPropertyDescriptor === void 0 ? void 0 : _Object_getOwnPropertyDescriptor.value) === true;
    } catch (unused) {
        return null;
    }
}
function isResolved(handle) {
    if (!handle) {
        return false;
    }
    var lazy = lazyMarker(handle);
    if (lazy === null) {
        return false;
    }
    if (!lazy) {
        return true;
    }
    // `module` runs a `{ lazy: true }` search, and pre-resolved handles throw on a miss.
    try {
        return Boolean(handle.module);
    } catch (unused) {
        return false;
    }
}
/**
 * @description Checks that every module a plugin or feature needs was found, so it can bail out instead of applying partially.
 * @param plugin The plugin's display name, or `Plugin: feature` for a single feature, used in the log line.
 * @param modules The handles to check, keyed by the name to report when one is missing.
 * @returns `true` when every handle resolved, otherwise `false` after logging the missing names.
 */ function ensureModules(plugin, modules) {
    var missing = Object.keys(modules).filter(function(name) {
        return !isResolved(modules[name]);
    });
    if (!missing.length) {
        return true;
    }
    console.error("[".concat(plugin, "] Skipped, modules not found: ").concat(missing.join(', '), "."));
    return false;
}function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
/**
 * @description Finds the render function behind the component at `owner[key]`, unwrapping `memo` (`type`) and `forwardRef` (`render`).
 * @param owner The object holding the component, such as a module's exports or a rendered element.
 * @param key The property holding the component, such as `default` for a module or `type` for an element.
 * @returns The object and key to patch, or `null` when no render function is found.
 */ function findRenderTarget(owner) {
    var key = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 'default';
    var holder = owner;
    var prop = key;
    var current = owner[key];
    while(current && (typeof current === "undefined" ? "undefined" : _type_of(current)) === 'object'){
        var next = current.type ? 'type' : current.render ? 'render' : null;
        if (!next) {
            break;
        }
        holder = current;
        prop = next;
        current = current[next];
    }
    return typeof current === 'function' ? {
        holder: holder,
        key: prop
    } : null;
}function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else obj[key] = value;
    return obj;
}
function _instanceof(left, right) {
    "@swc/helpers - instanceof";
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else return left instanceof right;
}
function _object_spread(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    else {
        ownKeys(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
}
function toFilter(source) {
    return typeof source === 'string' ? window.unbound.metro.filters.byFilePath(source) : source;
}
function findFirst(sources, options, signal) {
    var waits = [];
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = sources[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var source = _step.value;
            var found = window.unbound.metro.findLazy(toFilter(source), _object_spread_props(_object_spread({}, options), {
                signal: signal
            }));
            if (!_instanceof(found, Promise)) {
                return found;
            }
            waits.push(found);
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally{
        try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
            }
        } finally{
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
    return Promise.race(waits);
}
/**
 * @description Applies a feature to a module once it loads, now or later, so `stop` can cancel the wait or remove the feature.
 * @template T The module's type.
 * @param source The module's filter or file path, or several in order of preference: the first loaded wins, else the first to load.
 * @param apply Applies the feature and returns the function that removes it, or nothing when it did not apply.
 * @param options Metro search options, such as `interop`; a file path always yields the module's exports.
 * @returns A function that stops waiting and removes the feature if it was applied; call it in `stop`.
 */ function whenLoaded(source, apply) {
    var options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
    var controller = new AbortController();
    var sources = Array.isArray(source) ? source : [
        source
    ];
    var remove;
    void Promise.resolve(findFirst(sources, options, controller.signal)).then(function(module) {
        if (controller.signal.aborted) return;
        // Ends the waits on the other sources.
        controller.abort();
        if (module) {
            remove = apply(module);
        }
    });
    return function() {
        controller.abort();
        remove === null || remove === void 0 ? void 0 : remove();
        remove = undefined;
    };
}var COMPOSER_ROW_BOTTOM = -6;
var COMPOSER_ROW_GAP = 6;
var COMPOSER_ROW_RIGHT = 28;
var SLOWMODE_ROW_HEIGHT = 18;
function composerRows() {
    var _globalThis, ___unboundComposerRows;
    return (___unboundComposerRows = (_globalThis = globalThis).__unboundComposerRows) !== null && ___unboundComposerRows !== void 0 ? ___unboundComposerRows : _globalThis.__unboundComposerRows = {
        channels: new Map(),
        listeners: new Set()
    };
}
function notify() {
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = composerRows().listeners[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var listener = _step.value;
            listener();
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally{
        try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
            }
        } finally{
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
}
/**
 * @description Measures how far the slowmode notice pushes rows drawn above the composer.
 * @param channel The open channel.
 * @returns The notice's height when the channel has slowmode, otherwise `0`.
 */ function slowmodeInset(channel) {
    var _ref;
    return ((_ref = channel === null || channel === void 0 ? void 0 : channel.rateLimitPerUser) !== null && _ref !== void 0 ? _ref : 0) > 0 ? SLOWMODE_ROW_HEIGHT : 0;
}
/**
 * @description Places a row above the composer without growing it.
 * @param channel The open channel, whose slowmode notice the row clears.
 * @param height The row's height.
 * @param below The space taken by the rows shown under this one, `0` when it is the lowest.
 * @returns The row's `top` relative to the composer container.
 */ function composerRowTop(channel, height) {
    var below = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 0;
    return COMPOSER_ROW_BOTTOM - below - height - slowmodeInset(channel);
}
/**
 * @description Marks a row as shown above a channel's composer, so the rows over it move up.
 * @param channelId The channel whose composer shows the row.
 * @param id A name unique to the row.
 * @param row Where the row sits in the stack, lowest `order` first, and its height.
 * @returns A function that removes the row again.
 */ function showComposerRow(channelId, id, row) {
    var _channels_get;
    var channels = composerRows().channels;
    var rows = (_channels_get = channels.get(channelId)) !== null && _channels_get !== void 0 ? _channels_get : new Map();
    rows.set(id, row);
    channels.set(channelId, rows);
    notify();
    return function() {
        if (rows.get(id) !== row) return;
        rows.delete(id);
        if (!rows.size) {
            channels.delete(channelId);
        }
        notify();
    };
}
/**
 * @description Adds up the rows shown under a row, each with the gap above it.
 * @param channelId The channel whose composer shows the rows.
 * @param order The row's place in the stack.
 * @returns The space the lower rows take.
 */ function spaceBelow(channelId, order) {
    var _ref;
    var _composerRows_channels_get;
    var space = 0;
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = ((_ref = (_composerRows_channels_get = composerRows().channels.get(channelId)) === null || _composerRows_channels_get === void 0 ? void 0 : _composerRows_channels_get.values()) !== null && _ref !== void 0 ? _ref : [])[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var row = _step.value;
            if (row.order < order) {
                space += row.height + COMPOSER_ROW_GAP;
            }
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally{
        try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
            }
        } finally{
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
    return space;
}
function subscribe(listener) {
    var listeners = composerRows().listeners;
    listeners.add(listener);
    return function() {
        return listeners.delete(listener);
    };
}
/**
 * @description Registers a row above the composer while it is shown and places it over the rows shown under it.
 * @param options The channel, the row's id, its place in the stack, its height, and whether it is shown.
 * @returns The row's `top` relative to the composer container.
 */ function useComposerRow(param) {
    var channel = param.channel, channelId = param.channelId, id = param.id, order = param.order, height = param.height, shown = param.shown;
    window.React.useEffect(function() {
        return shown ? showComposerRow(channelId, id, {
            order: order,
            height: height
        }) : undefined;
    }, [
        channelId,
        id,
        order,
        height,
        shown
    ]);
    var below = window.React.useSyncExternalStore(subscribe, function() {
        return spaceBelow(channelId, order);
    });
    return composerRowTop(channel, height, below);
}var ChatInputs = window.unbound.metro.findByProps('getBestActiveInputForChannelId', {
    lazy: true
});
var SelectedChannelStore = window.unbound.metro.findStore('SelectedChannel', {
    lazy: true
});
var ChannelStore = window.unbound.metro.findStore('Channel', {
    lazy: true
});
var UserStore = window.unbound.metro.stores.Users;
// The same module as `metro.common.Theme`, which the generated typings do not declare yet.
var Theme = window.unbound.metro.findByProps('colors', 'internal', {
    lazy: true
});
var settings = window.unbound.storage.getStore('unbound.character-counter');
var Patcher = window.unbound.patcher.createPatcher('unbound.character-counter');/**
 * @description Discord's message length limit for the current user.
 * @param premiumType The user's Nitro tier; `2` is Nitro.
 * @returns 4000 for Nitro, otherwise 2000.
 */ function characterLimit(premiumType) {
    return premiumType === 2 ? 4000 : 2000;
}
/**
 * @description Picks the counter's color as the message approaches the limit.
 * @param count The message length.
 * @param limit The user's message length limit.
 * @param colorEffects Whether the warning colors are turned on.
 * @returns `primary` when warnings are off, otherwise a tone for the share of the limit used.
 */ function counterTone(count, limit, colorEffects) {
    if (!colorEffects) return 'primary';
    var percentage = count / limit * 100;
    if (percentage < 50) return 'muted';
    if (percentage < 75) return 'yellow';
    if (percentage < 90) return 'orange';
    return 'red';
}function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes(arr) {
    if (Array.isArray(arr)) return arr;
}
function _iterable_to_array_limit(arr, i) {
    var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"];
    if (_i == null) return;
    var _arr = [];
    var _n = true;
    var _d = false;
    var _s, _e;
    try {
        for(_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true){
            _arr.push(_s.value);
            if (i && _arr.length === i) break;
        }
    } catch (err) {
        _d = true;
        _e = err;
    } finally{
        try {
            if (!_n && _i["return"] != null) _i["return"]();
        } finally{
            if (_d) throw _e;
        }
    }
    return _arr;
}
function _non_iterable_rest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array(arr, i) {
    return _array_with_holes(arr) || _iterable_to_array_limit(arr, i) || _unsupported_iterable_to_array(arr, i) || _non_iterable_rest();
}
function _unsupported_iterable_to_array(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array(o, minLen);
}
function readCount(channelId) {
    var _ChatInputs_getBestActiveInputForChannelId_getText, _ChatInputs_getBestActiveInputForChannelId, _UserStore_getCurrentUser;
    var text = (_ChatInputs_getBestActiveInputForChannelId = ChatInputs.getBestActiveInputForChannelId(channelId)) === null || _ChatInputs_getBestActiveInputForChannelId === void 0 ? void 0 : (_ChatInputs_getBestActiveInputForChannelId_getText = _ChatInputs_getBestActiveInputForChannelId.getText) === null || _ChatInputs_getBestActiveInputForChannelId_getText === void 0 ? void 0 : _ChatInputs_getBestActiveInputForChannelId_getText.call(_ChatInputs_getBestActiveInputForChannelId);
    return {
        length: typeof text === 'string' ? text.length : 0,
        limit: characterLimit((_UserStore_getCurrentUser = UserStore.getCurrentUser()) === null || _UserStore_getCurrentUser === void 0 ? void 0 : _UserStore_getCurrentUser.premiumType)
    };
}
/**
 * @description Tracks the length of the message being written in a channel and the user's limit.
 * @param channelId The channel whose composer to read.
 * @returns The current message length and the user's message length limit.
 */ function useMessageCount(channelId) {
    var _useState = _sliced_to_array(window.React.useState(function() {
        return readCount(channelId);
    }), 2), count = _useState[0], setCount = _useState[1];
    window.React.useEffect(function() {
        function refresh() {
            var next = readCount(channelId);
            setCount(function(current) {
                return current.length === next.length && current.limit === next.limit ? current : next;
            });
        }
        refresh();
        // The composer emits no change event, so its text is polled.
        var timer = setInterval(refresh, 200);
        return function() {
            return clearInterval(timer);
        };
    }, [
        channelId
    ]);
    return count;
}// Each tone tries Discord's theme tokens in order, then a fixed color when the theme has none.
var TONE_COLORS = {
    primary: {
        tokens: [
            'BRAND_330',
            'BRAND_500'
        ],
        fallback: '#5865f2'
    },
    muted: {
        tokens: [
            'TEXT_NORMAL'
        ],
        fallback: '#f2f3f5'
    },
    yellow: {
        tokens: [
            'YELLOW_330',
            'YELLOW_300'
        ],
        fallback: '#fee75c'
    },
    orange: {
        tokens: [
            'ORANGE_330',
            'ORANGE_300'
        ],
        fallback: '#f0b232'
    },
    red: {
        tokens: [
            'RED_360',
            'RED_400'
        ],
        fallback: '#ed4245'
    }
};
var COUNTER_HEIGHT = 20;function rgbChannels(color) {
    var _color_match, _color_match1;
    var hex = (_color_match = color.match(/^#?([\da-f]{6})$/i)) === null || _color_match === void 0 ? void 0 : _color_match[1];
    if (hex) return [
        0,
        2,
        4
    ].map(function(index) {
        return Number.parseInt(hex.slice(index, index + 2), 16);
    });
    return (_color_match1 = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)) === null || _color_match1 === void 0 ? void 0 : _color_match1.slice(1, 4).map(Number);
}
/**
 * @description Resolves a counter tone to a color from Discord's theme.
 * @param tone The counter's tone.
 * @param colors Discord's theme colors.
 * @returns The first theme token the tone defines, or its fixed fallback color.
 */ function toneColor(tone, colors) {
    var _tokens_map_find;
    var _TONE_COLORS_tone = TONE_COLORS[tone], tokens = _TONE_COLORS_tone.tokens, fallback = _TONE_COLORS_tone.fallback;
    return (_tokens_map_find = tokens.map(function(token) {
        return colors[token];
    }).find(function(color) {
        return color !== undefined;
    })) !== null && _tokens_map_find !== void 0 ? _tokens_map_find : fallback;
}
/**
 * @description Picks a subtle pill background that contrasts with the theme's text color.
 * @param textColor The theme's text color, as hex or `rgb()`.
 * @returns A light tint behind light text or an unreadable color, a dark tint behind dark text.
 */ function counterSurface(textColor) {
    var channels = typeof textColor === 'string' ? rgbChannels(textColor) : undefined;
    var darkText = channels && (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1000 <= 160;
    return darkText ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)';
}function CharacterCounter(param) {
    var channelId = param.channelId;
    var _Theme_colors, _colors_TEXT_DEFAULT;
    var _ChannelStore_getChannel;
    var _useMessageCount = useMessageCount(channelId), length = _useMessageCount.length, limit = _useMessageCount.limit;
    var store = settings.useSettingsStore();
    var channel = (_ChannelStore_getChannel = ChannelStore.getChannel) === null || _ChannelStore_getChannel === void 0 ? void 0 : _ChannelStore_getChannel.call(ChannelStore, channelId);
    var top = useComposerRow({
        channel: channel,
        channelId: channelId,
        id: 'character-counter',
        order: 0,
        height: COUNTER_HEIGHT,
        shown: length > 0
    });
    if (!length) return null;
    var colors = (_Theme_colors = Theme.colors) !== null && _Theme_colors !== void 0 ? _Theme_colors : {};
    var tone = counterTone(length, limit, store.get('colorEffects', true));
    return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        pointerEvents: "none",
        style: {
            position: 'absolute',
            top: top,
            right: COMPOSER_ROW_RIGHT,
            zIndex: 10
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            alignItems: 'center',
            backgroundColor: counterSurface((_colors_TEXT_DEFAULT = colors.TEXT_DEFAULT) !== null && _colors_TEXT_DEFAULT !== void 0 ? _colors_TEXT_DEFAULT : colors.TEXT_NORMAL),
            borderRadius: 999,
            height: COUNTER_HEIGHT,
            justifyContent: 'center',
            paddingHorizontal: 7
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        accessibilityLabel: "".concat(length, " of ").concat(limit, " characters"),
        style: {
            color: toneColor(tone, colors),
            fontSize: 11,
            fontVariant: [
                'tabular-nums'
            ],
            fontWeight: '600',
            lineHeight: 14,
            textAlign: 'center'
        }
    }, length, "/", limit)));
}// Drops a counter left in the tree by an earlier render, so the composer never shows two.
function withoutCounters(children) {
    if (Array.isArray(children)) {
        var stripped = children.map(withoutCounters);
        if (stripped.every(function(child, index) {
            return child === children[index];
        })) return children;
        return stripped.filter(function(child) {
            return child !== null;
        });
    }
    if (!/*#__PURE__*/ window.React.isValidElement(children)) return children;
    if (children.type === CharacterCounter) return null;
    if (children.type !== window.React.Fragment) return children;
    var inner = children.props.children;
    var stripped1 = withoutCounters(inner);
    return stripped1 === inner ? children : /*#__PURE__*/ window.React.cloneElement(children, {}, stripped1);
}
function patchContainer(module) {
    var target = findRenderTarget(module);
    if (!target) {
        console.error('[Character Counter] Skipped, the composer has no render function.');
        return function() {};
    }
    return Patcher.after(target.holder, target.key, function(param) {
        var args = param.args, result = param.result;
        var _ref, _ref1;
        var _props_channel, _SelectedChannelStore_getChannelId;
        var props = args[0];
        var parent = result;
        if (!(parent === null || parent === void 0 ? void 0 : parent.props)) return;
        var channelId = (_ref = (_ref1 = props === null || props === void 0 ? void 0 : (_props_channel = props.channel) === null || _props_channel === void 0 ? void 0 : _props_channel.id) !== null && _ref1 !== void 0 ? _ref1 : props === null || props === void 0 ? void 0 : props.channelId) !== null && _ref !== void 0 ? _ref : (_SelectedChannelStore_getChannelId = SelectedChannelStore.getChannelId) === null || _SelectedChannelStore_getChannelId === void 0 ? void 0 : _SelectedChannelStore_getChannelId.call(SelectedChannelStore);
        if (!channelId) return;
        return /*#__PURE__*/ window.React.cloneElement(parent, {}, /*#__PURE__*/ React.createElement(React.Fragment, null, withoutCounters(parent.props.children), /*#__PURE__*/ React.createElement(CharacterCounter, {
            key: "character-counter",
            channelId: String(channelId)
        })));
    });
}
/**
 * @description Shows the counter above the composer, without changing the composer's layout, once the composer loads.
 * @returns A function that stops waiting for the composer, or removes the patch.
 */ function patchFloatingChatInputContainer() {
    return whenLoaded('modules/chat_input/native/FloatingChatInputContainer.tsx', patchContainer);
}/**
 * @description The root of a plugin settings panel, laid out like Unbound's own settings pages.
 * @param props The page's children, usually `Discord.TableRowGroup`s.
 * @returns A padded scroll view with a 24px gap between groups.
 */ function Page(param) {
    var children = param.children;
    return /*#__PURE__*/ React.createElement(window.ReactNative.ScrollView, {
        contentContainerStyle: {
            padding: 16
        },
        keyboardShouldPersistTaps: "handled"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.SafeArea.SafeAreaPaddingView, {
        bottom: true
    }, /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            gap: 24
        }
    }, children)));
}function SettingsPanel() {
    var store = settings.useSettingsStore();
    return /*#__PURE__*/ React.createElement(Page, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "Appearance"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Color thresholds",
        subLabel: "Warn as the message approaches Discord’s character limit.",
        value: store.get('colorEffects', true),
        onValueChange: function onValueChange(value) {
            return store.set('colorEffects', value);
        }
    })));
}var dispose = function dispose() {};
function start() {
    if (!ensureModules('Character Counter', {
        ChatInputs: ChatInputs,
        UserStore: UserStore
    })) return;
    dispose = applyFeatures('Character Counter', [
        patchFloatingChatInputContainer
    ]);
}
function stop() {
    dispose();
    dispose = function dispose() {};
}
var index = {
    start: start,
    stop: stop,
    getSettingsPanel: function getSettingsPanel() {
        return /*#__PURE__*/ React.createElement(SettingsPanel, null);
    }
};
return index;
})();return this.__plugin;},start(context){const module=this.__load();const plugin=module?.default??module;if(plugin&&typeof plugin.start==='function')return plugin.start(context);},stop(){const module=this.__load();const plugin=module?.default??module;if(plugin&&typeof plugin.stop==='function')return plugin.stop();},getSettingsPanel(...args){const module=this.__load();const plugin=module?.default??module;const settingsPanel=plugin?.getSettingsPanel??module?.getSettingsPanel;if(typeof settingsPanel==='function')return settingsPanel.apply(plugin,args);return null;}})