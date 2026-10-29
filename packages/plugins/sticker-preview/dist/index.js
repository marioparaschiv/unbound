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
}function _array_like_to_array$4(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$1(arr) {
    if (Array.isArray(arr)) return arr;
}
function _define_property$2(obj, key, value) {
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
function _iterable_to_array$4(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_rest$1() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _object_spread$2(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property$2(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys$2(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props$2(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    else {
        ownKeys$2(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
}
function _to_array(arr) {
    return _array_with_holes$1(arr) || _iterable_to_array$4(arr) || _unsupported_iterable_to_array$4(arr) || _non_iterable_rest$1();
}
function _unsupported_iterable_to_array$4(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$4(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$4(o, minLen);
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
            var found = window.unbound.metro.findLazy(toFilter(source), _object_spread_props$2(_object_spread$2({}, options), {
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
}
/**
 * @description Applies a feature once every module it needs has loaded, now or later, for features that read their modules through lazy handles.
 * @param sources One entry per module, each a filter, a file path, or candidates as `whenLoaded` takes them.
 * @param apply Applies the feature and returns the function that removes it, or nothing when it did not apply.
 * @returns A function that stops waiting and removes the feature if it was applied; call it in `stop`.
 */ function whenAllLoaded(sources, apply) {
    var _sources = _to_array(sources), first = _sources[0], rest = _sources.slice(1);
    if (!first) {
        var remove = apply();
        return function() {
            return remove === null || remove === void 0 ? void 0 : remove();
        };
    }
    return whenLoaded(first, function() {
        return whenAllLoaded(rest, apply);
    });
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
}// What the plugin waits for before it starts: every module below, by file path or else by name.
var RequiredModules = [
    window.unbound.metro.filters.byProps('getBestActiveInputForChannelId'),
    window.unbound.metro.filters.byStore('Draft'),
    window.unbound.metro.filters.byProps('sendMessage', 'receiveMessage'),
    window.unbound.metro.filters.byStore('SelectedChannel'),
    [
        'modules/stickers/native/Sticker.tsx',
        window.unbound.metro.filters.byName('Sticker')
    ],
    [
        'modules/stickers/native/StickerPickerListRow.tsx',
        window.unbound.metro.filters.byName('StickerPickerListRow')
    ],
    'modules/chat_input/native/accessories/ChatInputSendButton.tsx',
    'modules/chat_input/native/FloatingChatInputContainer.tsx'
];
var ChatInputs = window.unbound.metro.findByProps('getBestActiveInputForChannelId', {
    lazy: true
});
var SelectedChannelStore = window.unbound.metro.findStore('SelectedChannel', {
    lazy: true
});
var DraftStore = window.unbound.metro.findStore('Draft', {
    lazy: true
});
var ChannelStore = window.unbound.metro.findStore('Channel', {
    lazy: true
});
var MessageActions = window.unbound.metro.api.Messages;
// Components are found with `interop: false`, by file path first, then by name.
var StickerModules = [
    window.unbound.metro.findByFilePath('modules/stickers/native/Sticker.tsx', {
        lazy: true,
        interop: false
    }),
    window.unbound.metro.findByName('Sticker', {
        lazy: true,
        interop: false
    })
];
var StickerPickerListRowModules = [
    window.unbound.metro.findByFilePath('modules/stickers/native/StickerPickerListRow.tsx', {
        lazy: true,
        interop: false
    }),
    window.unbound.metro.findByName('StickerPickerListRow', {
        lazy: true,
        interop: false
    })
];
var ChatInputSendButton = window.unbound.metro.findByFilePath('modules/chat_input/native/accessories/ChatInputSendButton.tsx', {
    lazy: true,
    interop: false
});
var FloatingChatInputContainer = window.unbound.metro.findByFilePath('modules/chat_input/native/FloatingChatInputContainer.tsx', {
    lazy: true,
    interop: false
});
var Patcher = window.unbound.patcher.createPatcher('unbound.sticker-preview');var COMPOSER_ROW_BOTTOM = -6;
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
}var PREVIEW_SIZE = 80;
var STICKER_SIZE = 76;/**
 * @description The channel the user is looking at.
 * @returns Its id, or `undefined` when no channel is selected.
 */ function selectedChannelId() {
    var _SelectedChannelStore_getCurrentlySelectedChannelId;
    return (_SelectedChannelStore_getCurrentlySelectedChannelId = SelectedChannelStore.getCurrentlySelectedChannelId()) !== null && _SelectedChannelStore_getCurrentlySelectedChannelId !== void 0 ? _SelectedChannelStore_getCurrentlySelectedChannelId : SelectedChannelStore.getChannelId();
}function StickerPreview(param) {
    var channelId = param.channelId, staging = param.staging, Sticker = param.Sticker;
    var _sticker_opaque;
    var _ChannelStore_getChannel;
    var sticker = window.React.useSyncExternalStore(function(onChange) {
        return staging.subscribe(channelId, onChange);
    }, function() {
        return staging.get(channelId)[0];
    });
    var selectedId = selectedChannelId();
    var shown = Boolean(sticker) && (!selectedId || selectedId === channelId);
    var top = useComposerRow({
        channel: (_ChannelStore_getChannel = ChannelStore.getChannel) === null || _ChannelStore_getChannel === void 0 ? void 0 : _ChannelStore_getChannel.call(ChannelStore, channelId),
        channelId: channelId,
        id: 'sticker-preview',
        order: 1,
        height: PREVIEW_SIZE,
        shown: shown
    });
    if (!sticker || !shown) return null;
    return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        pointerEvents: "box-none",
        style: {
            position: 'absolute',
            right: COMPOSER_ROW_RIGHT,
            top: top,
            zIndex: 10
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
        accessibilityLabel: "Remove sticker preview",
        accessibilityRole: "button",
        hitSlop: 8,
        onPress: function onPress() {
            return staging.clear(channelId);
        },
        style: {
            alignItems: 'center',
            backgroundColor: 'rgba(46,40,59,0.96)',
            borderColor: 'rgba(255,255,255,0.48)',
            borderWidth: 1.5,
            justifyContent: 'center',
            height: PREVIEW_SIZE,
            width: PREVIEW_SIZE,
            borderRadius: 18,
            overflow: 'hidden'
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        pointerEvents: "none",
        style: {
            borderRadius: 16,
            height: STICKER_SIZE,
            overflow: 'hidden',
            width: STICKER_SIZE
        }
    }, /*#__PURE__*/ React.createElement(Sticker, {
        animated: true,
        opaque: (_sticker_opaque = sticker.opaque) !== null && _sticker_opaque !== void 0 ? _sticker_opaque : true,
        size: STICKER_SIZE,
        sticker: sticker
    }))));
}/**
 * @description Shows the staged sticker above the composer.
 * @param target The render function of `FloatingChatInputContainer`.
 * @param staging The plugin's staged stickers.
 * @param Sticker Discord's sticker component, used to draw the preview.
 * @returns A function that removes the patch.
 */ function patchFloatingChatInputContainer(target, staging, Sticker) {
    return Patcher.after(target.holder, target.key, function(param) {
        var args = param.args, result = param.result;
        var _ref;
        var _props_channel;
        var props = args[0];
        var container = result;
        var channelId = (_ref = props === null || props === void 0 ? void 0 : (_props_channel = props.channel) === null || _props_channel === void 0 ? void 0 : _props_channel.id) !== null && _ref !== void 0 ? _ref : selectedChannelId();
        if (!channelId || !(container === null || container === void 0 ? void 0 : container.props)) return container;
        return /*#__PURE__*/ window.React.cloneElement(container, {}, /*#__PURE__*/ React.createElement(React.Fragment, null, container.props.children, /*#__PURE__*/ React.createElement(StickerPreview, {
            key: "sticker-preview",
            channelId: channelId,
            staging: staging,
            Sticker: Sticker
        })));
    });
}function _array_like_to_array$3(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$3(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$3(arr);
}
function _define_property$1(obj, key, value) {
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
function _iterable_to_array$3(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$3() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _object_spread$1(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property$1(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys$1(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props$1(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    else {
        ownKeys$1(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
}
function _to_consumable_array$3(arr) {
    return _array_without_holes$3(arr) || _iterable_to_array$3(arr) || _unsupported_iterable_to_array$3(arr) || _non_iterable_spread$3();
}
function _unsupported_iterable_to_array$3(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$3(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$3(o, minLen);
}
/**
 * @description Stages a sticker picked from the picker instead of sending it.
 * @param target The render function of `StickerPickerListRow`.
 * @param staging The plugin's staged stickers.
 * @returns A function that removes the patch.
 */ function patchStickerPickerListRow(target, staging) {
    return Patcher.before(target.holder, target.key, function(param) {
        var args = param.args;
        var props = args[0];
        var onPressSticker = props === null || props === void 0 ? void 0 : props.onPressSticker;
        if (typeof onPressSticker !== 'function') return;
        args[0] = _object_spread_props$1(_object_spread$1({}, props), {
            onPressSticker: function onPressSticker1(sticker) {
                for(var _len = arguments.length, rest = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++){
                    rest[_key - 1] = arguments[_key];
                }
                var _onPressSticker;
                var _ref;
                var _props_channel;
                var channelId = (_ref = props === null || props === void 0 ? void 0 : (_props_channel = props.channel) === null || _props_channel === void 0 ? void 0 : _props_channel.id) !== null && _ref !== void 0 ? _ref : selectedChannelId();
                if (!channelId) return (_onPressSticker = onPressSticker).call.apply(_onPressSticker, [
                    props,
                    sticker
                ].concat(_to_consumable_array$3(rest)));
                staging.stage(channelId, sticker);
            }
        });
    });
}function _array_like_to_array$2(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$2(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$2(arr);
}
function _define_property(obj, key, value) {
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
function _iterable_to_array$2(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$2() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
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
function _to_consumable_array$2(arr) {
    return _array_without_holes$2(arr) || _iterable_to_array$2(arr) || _unsupported_iterable_to_array$2(arr) || _non_iterable_spread$2();
}
function _unsupported_iterable_to_array$2(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$2(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$2(o, minLen);
}
/**
 * @description Lets the send button send a staged sticker, and keeps its ref so the plugin can update it.
 * @param target The render function of `ChatInputSendButton`.
 * @param staging The plugin's staged stickers.
 * @returns A function that removes the patch.
 */ function patchChatInputSendButton(target, staging) {
    return Patcher.before(target.holder, target.key, function(param) {
        var args = param.args;
        var _staging;
        var _ref;
        var _props_channel;
        var props = args[0];
        var ref = (_ref = props === null || props === void 0 ? void 0 : props.ref) !== null && _ref !== void 0 ? _ref : args[1];
        var channelId = props === null || props === void 0 ? void 0 : (_props_channel = props.channel) === null || _props_channel === void 0 ? void 0 : _props_channel.id;
        if (!channelId) return;
        if (ref) staging.trackSendButton(channelId, ref);
        if (!staging.get(channelId).length) return;
        args[0] = _object_spread_props(_object_spread({}, props), {
            hasPendingAttachments: true,
            requireTextContent: false,
            onSendMessage: function onSendMessage() {
                for(var _len = arguments.length, sendArgs = new Array(_len), _key = 0; _key < _len; _key++){
                    sendArgs[_key] = arguments[_key];
                }
                return (_staging = staging).send.apply(_staging, [
                    channelId
                ].concat(_to_consumable_array$2(sendArgs)));
            }
        });
    });
}/**
 * @description Reads the text typed in a channel's composer, from the input or else its saved draft.
 * @param channelId The composer's channel.
 * @param input The composer's chat input, when one is mounted.
 * @returns The text, or an empty string.
 */ function composerText(channelId, input) {
    var _input_flushPendingDraftSave, _input_getText;
    input === null || input === void 0 ? void 0 : (_input_flushPendingDraftSave = input.flushPendingDraftSave) === null || _input_flushPendingDraftSave === void 0 ? void 0 : _input_flushPendingDraftSave.call(input);
    return (input === null || input === void 0 ? void 0 : (_input_getText = input.getText) === null || _input_getText === void 0 ? void 0 : _input_getText.call(input)) || DraftStore.getDraft(channelId, 0) || '';
}
/**
 * @description Empties a composer and saves the empty draft.
 * @param input The composer's chat input.
 */ function clearComposer(input) {
    var _input_setText, _input_clearText, _input_flushPendingDraftSave;
    input === null || input === void 0 ? void 0 : (_input_setText = input.setText) === null || _input_setText === void 0 ? void 0 : _input_setText.call(input, '');
    input === null || input === void 0 ? void 0 : (_input_clearText = input.clearText) === null || _input_clearText === void 0 ? void 0 : _input_clearText.call(input);
    input === null || input === void 0 ? void 0 : (_input_flushPendingDraftSave = input.flushPendingDraftSave) === null || _input_flushPendingDraftSave === void 0 ? void 0 : _input_flushPendingDraftSave.call(input);
}function _array_like_to_array$1(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$1(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$1(arr);
}
function _iterable_to_array$1(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$1() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array$1(arr) {
    return _array_without_holes$1(arr) || _iterable_to_array$1(arr) || _unsupported_iterable_to_array$1(arr) || _non_iterable_spread$1();
}
function _unsupported_iterable_to_array$1(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$1(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$1(o, minLen);
}
var NO_STICKERS = Object.freeze([]);
/**
 * @description Holds the stickers waiting to be sent in each channel, notifying that channel's subscribers on change.
 * @returns `get`, `set` and `add` the channel's stickers, `subscribe` to a channel, and list the `channels` holding any.
 */ function createStagedStickers() {
    var staged = new Map();
    var listeners = new Map();
    function get(channelId) {
        var _staged_get;
        return (_staged_get = staged.get(channelId)) !== null && _staged_get !== void 0 ? _staged_get : NO_STICKERS;
    }
    function set(channelId, stickers) {
        var _listeners_get;
        if (stickers.length) {
            staged.set(channelId, stickers);
        } else {
            staged.delete(channelId);
        }
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = ((_listeners_get = listeners.get(channelId)) !== null && _listeners_get !== void 0 ? _listeners_get : [])[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
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
    function add(channelId, sticker) {
        var current = get(channelId);
        if (current.some(function(item) {
            return String(item.id) === String(sticker.id);
        })) return;
        set(channelId, _to_consumable_array$1(current).concat([
            sticker
        ]));
    }
    function subscribe(channelId, listener) {
        var _listeners_get;
        var channelListeners = (_listeners_get = listeners.get(channelId)) !== null && _listeners_get !== void 0 ? _listeners_get : new Set();
        channelListeners.add(listener);
        listeners.set(channelId, channelListeners);
        return function() {
            channelListeners.delete(listener);
            if (!channelListeners.size) {
                listeners.delete(channelId);
            }
        };
    }
    function channels() {
        return _to_consumable_array$1(staged.keys());
    }
    return {
        get: get,
        set: set,
        add: add,
        subscribe: subscribe,
        channels: channels
    };
}
/**
 * @description Returns the staged stickers every plugin bundle shares, so Preview Message can show what Sticker Preview staged.
 * @returns The one staged-sticker store kept on `globalThis`.
 */ function sharedStagedStickers() {
    var _globalThis, ___unboundStagedStickers;
    return (___unboundStagedStickers = (_globalThis = globalThis).__unboundStagedStickers) !== null && ___unboundStagedStickers !== void 0 ? ___unboundStagedStickers : _globalThis.__unboundStagedStickers = createStagedStickers();
}function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes(arr) {
    if (Array.isArray(arr)) return _array_like_to_array(arr);
}
function _iterable_to_array(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
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
function _non_iterable_spread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array(arr, i) {
    return _array_with_holes(arr) || _iterable_to_array_limit(arr, i) || _unsupported_iterable_to_array(arr, i) || _non_iterable_rest();
}
function _to_consumable_array(arr) {
    return _array_without_holes(arr) || _iterable_to_array(arr) || _unsupported_iterable_to_array(arr) || _non_iterable_spread();
}
function _unsupported_iterable_to_array(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array(o, minLen);
}
function canSend(input) {
    return typeof (input === null || input === void 0 ? void 0 : input.handleSend) === 'function';
}
/**
 * @description Holds the stickers picked in each channel until the user sends them from the composer.
 * @returns The staged stickers, the actions to `stage`, `clear` and `send` them, and `dispose` to undo everything.
 */ function createStaging() {
    var stickers = sharedStagedStickers();
    var sendHooks = new Map();
    var sendButtons = new Map();
    var keptOn = new Map();
    var pending = new Set();
    var disposed = false;
    function getInput(channelId) {
        var _ref, _ChatInputs_getBestActiveInputForChannelId;
        var _sendHooks_get, _ChatInputs_getBestActiveInput;
        return (_ref = (_ChatInputs_getBestActiveInputForChannelId = ChatInputs.getBestActiveInputForChannelId(channelId)) !== null && _ChatInputs_getBestActiveInputForChannelId !== void 0 ? _ChatInputs_getBestActiveInputForChannelId : (_sendHooks_get = sendHooks.get(channelId)) === null || _sendHooks_get === void 0 ? void 0 : _sendHooks_get.input) !== null && _ref !== void 0 ? _ref : (_ChatInputs_getBestActiveInput = ChatInputs.getBestActiveInput) === null || _ChatInputs_getBestActiveInput === void 0 ? void 0 : _ChatInputs_getBestActiveInput.call(ChatInputs);
    }
    function keepOnWhileStaged(channelId) {
        var _sendButtons_get;
        var button = (_sendButtons_get = sendButtons.get(channelId)) === null || _sendButtons_get === void 0 ? void 0 : _sendButtons_get.current;
        var original = button === null || button === void 0 ? void 0 : button.setHasText;
        if (!button || typeof original !== 'function' || keptOn.has(button)) return;
        keptOn.set(button, original);
        button.setHasText = function(hasText) {
            return original.call(button, hasText || !disposed && stickers.get(channelId).length > 0);
        };
    }
    function setHasText(channelId, hasText) {
        var _sendButtons_get_current_setHasText, _sendButtons_get_current, _sendButtons_get;
        keepOnWhileStaged(channelId);
        (_sendButtons_get = sendButtons.get(channelId)) === null || _sendButtons_get === void 0 ? void 0 : (_sendButtons_get_current = _sendButtons_get.current) === null || _sendButtons_get_current === void 0 ? void 0 : (_sendButtons_get_current_setHasText = _sendButtons_get_current.setHasText) === null || _sendButtons_get_current_setHasText === void 0 ? void 0 : _sendButtons_get_current_setHasText.call(_sendButtons_get_current, hasText);
    }
    // Assigned by hand rather than patched, so a handler Discord installs meanwhile is not overwritten on restore.
    function unhookSend(channelId) {
        var hook = sendHooks.get(channelId);
        if (!hook) return;
        if (hook.input.handleSend === hook.hooked) {
            hook.input.handleSend = hook.original;
        }
        sendHooks.delete(channelId);
    }
    function hookSend(channelId, input) {
        if (!canSend(input)) return;
        var hook = sendHooks.get(channelId);
        if ((hook === null || hook === void 0 ? void 0 : hook.input) === input && input.handleSend === hook.hooked) return;
        unhookSend(channelId);
        var original = input.handleSend;
        function hooked() {
            for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
                args[_key] = arguments[_key];
            }
            return pending.has(channelId) || stickers.get(channelId).length ? send.apply(void 0, [
                channelId
            ].concat(_to_consumable_array(args))) : original.apply(input, args);
        }
        sendHooks.set(channelId, {
            input: input,
            original: original,
            hooked: hooked
        });
        input.handleSend = hooked;
    }
    function clear(channelId) {
        stickers.set(channelId, []);
        unhookSend(channelId);
        setHasText(channelId, Boolean(composerText(channelId, getInput(channelId)).trim()));
    }
    function stage(channelId, sticker) {
        var _input_showSideActions;
        if (!(sticker === null || sticker === void 0 ? void 0 : sticker.id)) return;
        stickers.add(channelId, sticker);
        var input = getInput(channelId);
        hookSend(channelId, input);
        input === null || input === void 0 ? void 0 : (_input_showSideActions = input.showSideActions) === null || _input_showSideActions === void 0 ? void 0 : _input_showSideActions.call(input);
        if (typeof (input === null || input === void 0 ? void 0 : input.openSystemKeyboard) === 'function') {
            input.openSystemKeyboard();
        } else {
            var _input_closeCustomKeyboard;
            input === null || input === void 0 ? void 0 : (_input_closeCustomKeyboard = input.closeCustomKeyboard) === null || _input_closeCustomKeyboard === void 0 ? void 0 : _input_closeCustomKeyboard.call(input);
        }
        setHasText(channelId, true);
    }
    function send(channelId) {
        for(var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++){
            args[_key - 1] = arguments[_key];
        }
        var _input_handleSend;
        var _input_handleSend1;
        if (pending.has(channelId)) return;
        var staged = stickers.get(channelId);
        var input = getInput(channelId);
        if (!staged.length) return input === null || input === void 0 ? void 0 : (_input_handleSend1 = input.handleSend) === null || _input_handleSend1 === void 0 ? void 0 : (_input_handleSend = _input_handleSend1).call.apply(_input_handleSend, [
            input
        ].concat(_to_consumable_array(args)));
        var content = composerText(channelId, input);
        var stickerIds = staged.map(function(sticker) {
            return String(sticker.id);
        });
        var result;
        pending.add(channelId);
        try {
            result = content ? MessageActions._sendMessage(channelId, {
                content: content,
                tts: false,
                invalidEmojis: [],
                validNonShortcutEmojis: []
            }, {
                stickerIds: stickerIds
            }) : MessageActions.sendStickers(channelId, stickerIds);
        } catch (error) {
            pending.delete(channelId);
            throw error;
        }
        stickers.set(channelId, []);
        function finish() {
            pending.delete(channelId);
            clearComposer(input);
            clear(channelId);
        }
        if (typeof (result === null || result === void 0 ? void 0 : result.then) !== 'function') {
            finish();
            return result;
        }
        return result.then(function(value) {
            finish();
            return value;
        }, function(error) {
            pending.delete(channelId);
            // A failed send puts the stickers back, unless the plugin stopped meanwhile.
            if (!disposed) {
                stickers.set(channelId, staged);
                setHasText(channelId, true);
            }
            throw error;
        });
    }
    function trackSendButton(channelId, ref) {
        sendButtons.set(channelId, ref);
        setTimeout(function() {
            if (!disposed) keepOnWhileStaged(channelId);
        }, 0);
    }
    function dispose() {
        disposed = true;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = _to_consumable_array(sendHooks.keys()).reverse()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var channelId = _step.value;
                unhookSend(channelId);
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
        var _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
        try {
            for(var _iterator1 = new Set(_to_consumable_array(stickers.channels()).concat(_to_consumable_array(pending)))[Symbol.iterator](), _step1; !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                var channelId1 = _step1.value;
                clear(channelId1);
            }
        } catch (err) {
            _didIteratorError1 = true;
            _iteratorError1 = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion1 && _iterator1.return != null) {
                    _iterator1.return();
                }
            } finally{
                if (_didIteratorError1) {
                    throw _iteratorError1;
                }
            }
        }
        pending.clear();
        sendButtons.clear();
        var _iteratorNormalCompletion2 = true, _didIteratorError2 = false, _iteratorError2 = undefined;
        try {
            for(var _iterator2 = keptOn[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true){
                var _step_value = _sliced_to_array(_step2.value, 2), button = _step_value[0], original = _step_value[1];
                button.setHasText = original;
            }
        } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
                    _iterator2.return();
                }
            } finally{
                if (_didIteratorError2) {
                    throw _iteratorError2;
                }
            }
        }
        keptOn.clear();
    }
    return {
        get: stickers.get,
        subscribe: stickers.subscribe,
        stage: stage,
        clear: clear,
        send: send,
        trackSendButton: trackSendButton,
        dispose: dispose
    };
}function firstTarget(candidates) {
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = candidates[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var candidate = _step.value;
            var target = findRenderTarget(candidate);
            if (target) {
                return target;
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
    return null;
}
/**
 * @description Stages picked stickers in the composer with a preview, and sends them with the message.
 * @returns A function that removes the patches and clears every staged sticker.
 */ function applyStickerPreview() {
    var sticker = firstTarget(StickerModules);
    var pickerRow = firstTarget(StickerPickerListRowModules);
    var sendButton = findRenderTarget(ChatInputSendButton);
    var container = findRenderTarget(FloatingChatInputContainer);
    if (!sticker || !pickerRow || !sendButton || !container) {
        console.error('[Sticker Preview] Skipped, render functions not found: Sticker, StickerPickerListRow, ChatInputSendButton or FloatingChatInputContainer.');
        return function() {};
    }
    var Sticker = sticker.holder[sticker.key];
    var staging = createStaging();
    return applyFeatures('Sticker Preview', [
        function() {
            return staging.dispose;
        },
        function() {
            return patchStickerPickerListRow(pickerRow, staging);
        },
        function() {
            return patchChatInputSendButton(sendButton, staging);
        },
        function() {
            return patchFloatingChatInputContainer(container, staging, Sticker);
        }
    ]);
}var dispose = function dispose() {};
function start() {
    dispose = applyFeatures('Sticker Preview', [
        function() {
            return whenAllLoaded(RequiredModules, applyStickerPreview);
        }
    ]);
}
function stop() {
    dispose();
    dispose = function dispose() {};
}
var index = {
    start: start,
    stop: stop
};
return index;
})();return this.__plugin;},start(context){const module=this.__load();const plugin=module?.default??module;if(plugin&&typeof plugin.start==='function')return plugin.start(context);},stop(){const module=this.__load();const plugin=module?.default??module;if(plugin&&typeof plugin.stop==='function')return plugin.stop();}})