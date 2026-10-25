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
}function _array_like_to_array$5(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$4(arr) {
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
function _iterable_to_array$2(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_rest$4() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
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
            _define_property$2(target, key, source[key]);
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
function _to_array(arr) {
    return _array_with_holes$4(arr) || _iterable_to_array$2(arr) || _unsupported_iterable_to_array$5(arr) || _non_iterable_rest$4();
}
function _unsupported_iterable_to_array$5(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$5(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$5(o, minLen);
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
            var found = window.unbound.metro.findLazy(toFilter(source), _object_spread_props$1(_object_spread$1({}, options), {
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
}/**
 * @description Lets components a plugin injected hide themselves once it stops, without waiting for their parent to re-render.
 * @param pluginId The plugin's ID, which keys the state.
 * @returns The flag's setter and hook.
 */ function createRunningFlag(pluginId) {
    var _host, _key, _;
    // Every start evaluates the bundle again, so components still mounted from an earlier evaluation
    // read the state through a global key and come back when the plugin starts again.
    var host = globalThis;
    var key = Symbol.for("".concat(pluginId, ".enabled"));
    var state = (_ = (_host = host)[_key = key]) !== null && _ !== void 0 ? _ : _host[_key] = {
        running: false,
        listeners: new Set()
    };
    function set(running) {
        state.running = running;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = state.listeners[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
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
    function subscribe(listener) {
        state.listeners.add(listener);
        return function() {
            return void state.listeners.delete(listener);
        };
    }
    return {
        markRunning: function markRunning() {
            set(true);
            return function() {
                return set(false);
            };
        },
        useRunning: function useRunning() {
            return window.React.useSyncExternalStore(subscribe, function() {
                return state.running;
            });
        }
    };
}var TypingStore = window.unbound.metro.findStore('Typing', {
    lazy: true
});
var UserStore = window.unbound.metro.stores.Users;
// Optional: without them, the indicator skips the filter or detail they provide.
var RelationshipStore = window.unbound.metro.findStore('Relationship', {
    lazy: true
});
var SelectedChannelStore = window.unbound.metro.findStore('SelectedChannel', {
    lazy: true
});
var UserGuildSettingsStore = window.unbound.metro.findStore('UserGuildSettings', {
    lazy: true
});
var GuildMemberStore = window.unbound.metro.findStore('GuildMember', {
    lazy: true
});
var TypingStoreFilter = window.unbound.metro.filters.byStore('Typing');
var UserStoreFilter = window.unbound.metro.filters.byStore('User');
var TextChannelPath = 'modules/channel_list_v2/native/items/TextChannel.tsx';
var ThreadChannelPath = 'modules/channel_list_v2/native/items/ThreadChannel.tsx';
var TextChannel = window.unbound.metro.findByFilePath(TextChannelPath, {
    interop: false,
    lazy: true
});
var ThreadChannel = window.unbound.metro.findByFilePath(ThreadChannelPath, {
    interop: false,
    lazy: true
});
var UserSummaryItem = window.unbound.metro.findByFilePath('components_native/common/UserSummaryItem.tsx', {
    interop: false,
    lazy: true
});
var UserSummaryItemByName = window.unbound.metro.findByName('UserSummaryItem', {
    interop: false,
    lazy: true
});
var UserProfileActionSheet = window.unbound.metro.findByFilePath('modules/user_profile/native/UserProfileActionSheet.tsx', {
    interop: false,
    lazy: true
});
var Tooltips = window.unbound.metro.findByProps('TooltipArrowDirections', 'TooltipArrowPositions', {
    lazy: true
});
var Icons = window.unbound.metro.findByProps('UserIcon', {
    lazy: true
});
var ActionSheets = window.unbound.metro.api.ActionSheets;
// The same module as `metro.common.Theme`, which its typings do not declare yet.
var Theme = window.unbound.metro.findByProps('colors', 'internal', {
    lazy: true
});
var settings = window.unbound.storage.getStore('unbound.channel-typing-indicators');
var Patcher = window.unbound.patcher.createPatcher('unbound.channel-typing-indicators');
var IndicatorsRunning = createRunningFlag('unbound.channel-typing-indicators');function _assert_this_initialized(self) {
    if (self === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    return self;
}
function _call_super(_this, derived, args) {
    derived = _get_prototype_of(derived);
    return _possible_constructor_return(_this, _is_native_reflect_construct() ? Reflect.construct(derived, args || [], _get_prototype_of(_this).constructor) : derived.apply(_this, args));
}
function _class_call_check(instance, Constructor) {
    if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _defineProperties(target, props) {
    for(var i = 0; i < props.length; i++){
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
    }
}
function _create_class(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
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
function _get_prototype_of(o) {
    _get_prototype_of = Object.setPrototypeOf ? Object.getPrototypeOf : function getPrototypeOf(o) {
        return o.__proto__ || Object.getPrototypeOf(o);
    };
    return _get_prototype_of(o);
}
function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
        throw new TypeError("Super expression must either be null or a function");
    }
    subClass.prototype = Object.create(superClass && superClass.prototype, {
        constructor: {
            value: subClass,
            writable: true,
            configurable: true
        }
    });
    if (superClass) _set_prototype_of(subClass, superClass);
}
function _is_native_reflect_construct() {
    try {
        var result = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
    } catch (_) {}
    return (_is_native_reflect_construct = function() {
        return !!result;
    })();
}
function _possible_constructor_return(self, call) {
    if (call && (_type_of(call) === "object" || typeof call === "function")) return call;
    return _assert_this_initialized(self);
}
function _set_prototype_of(o, p) {
    _set_prototype_of = Object.setPrototypeOf || function setPrototypeOf(o, p) {
        o.__proto__ = p;
        return o;
    };
    return _set_prototype_of(o, p);
}
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
// A broken indicator hides itself instead of taking the channel row down with it.
var IndicatorBoundary = /*#__PURE__*/ function(Component) {
    _inherits(IndicatorBoundary, Component);
    function IndicatorBoundary() {
        _class_call_check(this, IndicatorBoundary);
        var _this;
        _this = _call_super(this, IndicatorBoundary, arguments), _define_property$1(_this, "state", {
            failed: false
        });
        return _this;
    }
    _create_class(IndicatorBoundary, [
        {
            key: "componentDidCatch",
            value: function componentDidCatch(error) {
                console.error('Channel typing indicator failed:', error);
            }
        },
        {
            key: "render",
            value: function render() {
                return this.state.failed ? null : this.props.children;
            }
        }
    ], [
        {
            key: "getDerivedStateFromError",
            value: function getDerivedStateFromError() {
                return {
                    failed: true
                };
            }
        }
    ]);
    return IndicatorBoundary;
}(window.React.Component);/**
 * @description Formats one of Discord's own messages in the user's locale.
 * @param messageId The message's hashed ID.
 * @param values The message's placeholders.
 * @returns The formatted text, or nothing when Discord lacks the message or cannot format it.
 */ function formatDiscordMessage(messageId, values) {
    var _i18n_t;
    var i18n = window.unbound.metro.common.i18n;
    var message = (_i18n_t = i18n.t) === null || _i18n_t === void 0 ? void 0 : _i18n_t[messageId];
    if (typeof message !== 'function') return;
    try {
        return i18n.intl.formatToPlainString(message, values);
    } catch (unused) {
        return;
    }
}// Bit flags stored in the `indicatorMode` setting.
var IndicatorMode = {
    Dots: 1,
    Avatars: 2
};
var MAX_AVATARS = 3;
// Discord's own "is typing" strings for one, two, three, and several typing users.
var TYPING_MESSAGE_IDS = [
    'lJ9sZX',
    'rB0CUa',
    'StKThj',
    'uVDhqZ'
];
// The key of every element the plugin inserts, which also marks a row as already patched.
var INDICATOR_KEY = 'unbound.channel-typing-indicators';function _array_like_to_array$4(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$3(arr) {
    if (Array.isArray(arr)) return arr;
}
function _iterable_to_array_limit$3(arr, i) {
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
function _non_iterable_rest$3() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$3(arr, i) {
    return _array_with_holes$3(arr) || _iterable_to_array_limit$3(arr, i) || _unsupported_iterable_to_array$4(arr, i) || _non_iterable_rest$3();
}
function _unsupported_iterable_to_array$4(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$4(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$4(o, minLen);
}
function englishLabel(names) {
    var _names = _sliced_to_array$3(names, 3), a = _names[0], b = _names[1], c = _names[2];
    switch(names.length){
        case 1:
            return "".concat(a, " is typing...");
        case 2:
            return "".concat(a, " and ").concat(b, " are typing...");
        case 3:
            return "".concat(a, ", ").concat(b, ", and ").concat(c, " are typing...");
        default:
            return 'Several people are typing...';
    }
}
/**
 * @description Builds the tooltip text for the typing users, in Discord's locale when it has the string.
 * @param names The display names of the typing users.
 * @param format Formats one of Discord's messages, returning nothing when it is unavailable.
 * @returns The label, or an empty string when nobody is typing.
 */ function typingLabel(names, format) {
    if (!names.length) return '';
    var _names = _sliced_to_array$3(names, 3), a = _names[0], b = _names[1], c = _names[2];
    var messageId = TYPING_MESSAGE_IDS[Math.min(names.length, TYPING_MESSAGE_IDS.length) - 1];
    return format(messageId, {
        a: a,
        b: b,
        c: c
    }) || englishLabel(names);
}var useStyles$3 = window.unbound.metro.components.Discord.createStyles({
    row: {
        alignItems: 'center',
        flexDirection: 'row',
        flexShrink: 0
    }
});/**
 * @description Places the typing tooltip above its anchor, or below when there is no room, kept inside the window.
 * @param anchor The pressed indicator's frame in window coordinates.
 * @param labelLength The tooltip text's length, used to estimate its size.
 * @param viewportWidth The window width.
 * @returns The tooltip's position, width, and arrow.
 */ function tooltipPlacement(anchor, labelLength, viewportWidth) {
    var width = Math.min(viewportWidth - 16, Math.max(120, Math.min(260, labelLength * 6 + 28)));
    var center = anchor.x + anchor.width / 2;
    var left = Math.max(8, Math.min(center - width / 2, viewportWidth - width - 8));
    var height = Math.min(100, Math.max(42, Math.ceil(labelLength / 38) * 18 + 22));
    var below = anchor.y - height - 6 < 28;
    return {
        arrowDirection: below ? 'UP' : 'DOWN',
        arrowOffset: center - left - 8,
        left: left,
        top: below ? anchor.y + anchor.height + 6 : anchor.y - height - 6,
        width: width
    };
}// A factory, so the theme is read when an indicator renders rather than when the plugin loads.
var useStyles$2 = window.unbound.metro.components.Discord.createStyles(function() {
    return {
        backdrop: {
            bottom: 0,
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0
        },
        arrow: {
            borderBottomColor: Theme.colors.BACKGROUND_SURFACE_HIGHEST,
            borderTopColor: Theme.colors.BACKGROUND_SURFACE_HIGHEST
        },
        bubble: {
            backgroundColor: Theme.colors.BACKGROUND_SURFACE_HIGHEST
        },
        label: {
            color: Theme.colors.TEXT_DEFAULT
        }
    };
});function TypingTooltip(param) {
    var anchor = param.anchor, label = param.label, onClose = param.onClose;
    var styles = useStyles$2();
    var _useWindowDimensions = window.ReactNative.useWindowDimensions(), viewportWidth = _useWindowDimensions.width;
    var placement = tooltipPlacement(anchor, label.length, viewportWidth);
    return /*#__PURE__*/ React.createElement(window.ReactNative.Modal, {
        visible: true,
        transparent: true,
        statusBarTranslucent: true,
        onRequestClose: onClose
    }, /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            flex: 1
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
        onPress: onClose,
        style: styles.backdrop
    }), /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        pointerEvents: "none",
        style: {
            left: placement.left,
            position: 'absolute',
            top: placement.top
        }
    }, /*#__PURE__*/ React.createElement(Tooltips.Tooltip, {
        arrowDirection: placement.arrowDirection,
        arrowOffset: placement.arrowOffset,
        arrowPosition: Tooltips.TooltipArrowPositions.LEFT,
        arrowStyle: styles.arrow,
        containerStyle: styles.bubble,
        label: label,
        labelStyle: styles.label,
        style: {
            width: placement.width
        }
    }))));
}// A factory, so the theme is read when an indicator renders rather than when the plugin loads.
var useStyles$1 = window.unbound.metro.components.Discord.createStyles(function() {
    return {
        container: {
            alignItems: 'center',
            flexDirection: 'row',
            marginLeft: 6
        },
        unknownAvatar: {
            alignItems: 'center',
            backgroundColor: Theme.colors.BACKGROUND_ACCENT,
            borderRadius: 8,
            height: 16,
            justifyContent: 'center',
            width: 16
        },
        unknownIcon: {
            color: Theme.colors.TEXT_DEFAULT
        },
        overflow: {
            marginLeft: -6,
            zIndex: MAX_AVATARS + 1
        },
        overflowBadge: {
            alignItems: 'center',
            backgroundColor: '#000',
            borderRadius: 8,
            height: 16,
            justifyContent: 'center',
            width: 16
        },
        overflowText: {
            color: '#fff',
            fontSize: 8,
            fontWeight: '600'
        }
    };
});function openProfile(userId, channelId) {
    if (!UserProfileActionSheet.default) return;
    ActionSheets.openLazy(Promise.resolve({
        default: UserProfileActionSheet.default
    }), "UserProfile".concat(userId), {
        userId: userId,
        channelId: channelId,
        sourceAnalyticsLocations: [
            'avatar'
        ],
        openedAt: Date.now()
    });
}
function TypingAvatars(param) {
    var users = param.users, guildId = param.guildId, channelId = param.channelId, containerRef = param.containerRef, onShowTooltip = param.onShowTooltip;
    var _UserSummaryItem_default;
    var styles = useStyles$1();
    var Summary = (_UserSummaryItem_default = UserSummaryItem.default) !== null && _UserSummaryItem_default !== void 0 ? _UserSummaryItem_default : UserSummaryItemByName.default;
    var visible = users.slice(0, MAX_AVATARS);
    var overflow = users.length - visible.length;
    if (!Summary) return null;
    // Presses stop here so the channel row underneath does not navigate.
    function showTooltip(event) {
        event.stopPropagation();
        onShowTooltip();
    }
    return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        ref: containerRef,
        style: styles.container
    }, visible.map(function(user, index) {
        var _ref;
        return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
            key: (_ref = user === null || user === void 0 ? void 0 : user.id) !== null && _ref !== void 0 ? _ref : "unknown-".concat(index),
            style: {
                marginLeft: index ? -6 : 0,
                zIndex: visible.length - index
            }
        }, user ? /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
            onPress: function onPress(event) {
                event.stopPropagation();
                openProfile(user.id, channelId);
            },
            onLongPress: showTooltip
        }, /*#__PURE__*/ React.createElement(Summary, {
            users: [
                user
            ],
            guildId: guildId,
            renderIcon: false,
            max: 1,
            size: 16,
            showDefaultAvatarsForNullUsers: true,
            showUserPopout: true
        })) : /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
            onPress: showTooltip,
            onLongPress: showTooltip
        }, /*#__PURE__*/ React.createElement(window.ReactNative.View, {
            style: styles.unknownAvatar
        }, Icons.UserIcon ? /*#__PURE__*/ React.createElement(Icons.UserIcon, {
            color: styles.unknownIcon.color,
            style: {
                transform: [
                    {
                        scale: 0.5
                    }
                ]
            }
        }) : null)));
    }), overflow > 0 ? /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
        onPress: showTooltip,
        onLongPress: showTooltip,
        style: styles.overflow
    }, /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: styles.overflowBadge
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: styles.overflowText
    }, "+".concat(overflow)))) : null);
}/**
 * @description Picks the typing users to show, leaving out the current user and, unless included, blocked and ignored users.
 * @param typingUsers The typing store's snapshot for a channel, keyed by user ID.
 * @param filter Who to leave out.
 * @returns The IDs of the typing users to show, in snapshot order.
 */ function visibleTypingIds(typingUsers, filter) {
    return Object.keys(typingUsers !== null && typingUsers !== void 0 ? typingUsers : {}).filter(function(id) {
        return id !== filter.currentUserId && (filter.includeBlocked || !filter.isBlocked(id)) && (filter.includeIgnored || !filter.isIgnored(id));
    });
}
/**
 * @description Compares two ID lists in order, so an unchanged snapshot does not re-render the indicator.
 * @param first The previous IDs.
 * @param second The next IDs.
 * @returns Whether both lists hold the same IDs in the same order.
 */ function sameIds(first, second) {
    return first.length === second.length && first.every(function(id, index) {
        return id === second[index];
    });
}/**
 * @description Tracks who is typing in a channel, filtered by the plugin's settings.
 * @param channel The channel the row shows.
 * @param muted Whether the row shows the channel as muted.
 * @returns The IDs of the typing users to show.
 */ function useTypingIds(channel, muted) {
    var store = settings.useSettingsStore();
    var includeCurrent = store.get('includeCurrentChannel', true);
    var includeMuted = store.get('includeMutedChannels', false);
    var includeBlocked = store.get('includeBlockedUsers', false);
    var includeIgnored = store.get('includeIgnoredUsers', false);
    // The optional stores are called with `?.`: a missing one reads as no filter.
    function read() {
        var _SelectedChannelStore_getChannelId, _UserGuildSettingsStore_isChannelMuted, _UserStore_getCurrentUser;
        if (!includeCurrent && ((_SelectedChannelStore_getChannelId = SelectedChannelStore.getChannelId) === null || _SelectedChannelStore_getChannelId === void 0 ? void 0 : _SelectedChannelStore_getChannelId.call(SelectedChannelStore)) === channel.id) return [];
        if (!includeMuted && (muted || ((_UserGuildSettingsStore_isChannelMuted = UserGuildSettingsStore.isChannelMuted) === null || _UserGuildSettingsStore_isChannelMuted === void 0 ? void 0 : _UserGuildSettingsStore_isChannelMuted.call(UserGuildSettingsStore, channel.guild_id, channel.id)))) {
            return [];
        }
        return visibleTypingIds(TypingStore.getTypingUsers(channel.id), {
            currentUserId: (_UserStore_getCurrentUser = UserStore.getCurrentUser()) === null || _UserStore_getCurrentUser === void 0 ? void 0 : _UserStore_getCurrentUser.id,
            includeBlocked: includeBlocked,
            includeIgnored: includeIgnored,
            isBlocked: function isBlocked(id) {
                var _ref;
                var _RelationshipStore_isBlocked;
                return (_ref = (_RelationshipStore_isBlocked = RelationshipStore.isBlocked) === null || _RelationshipStore_isBlocked === void 0 ? void 0 : _RelationshipStore_isBlocked.call(RelationshipStore, id)) !== null && _ref !== void 0 ? _ref : false;
            },
            isIgnored: function isIgnored(id) {
                var _ref;
                var _RelationshipStore_isIgnored;
                return (_ref = (_RelationshipStore_isIgnored = RelationshipStore.isIgnored) === null || _RelationshipStore_isIgnored === void 0 ? void 0 : _RelationshipStore_isIgnored.call(RelationshipStore, id)) !== null && _ref !== void 0 ? _ref : false;
            }
        });
    }
    var stores = [
        TypingStore,
        RelationshipStore,
        UserGuildSettingsStore,
        SelectedChannelStore
    ].filter(function(store) {
        return store.module;
    });
    return window.unbound.metro.common.FluxHooks.useStateFromStores(stores, read, [
        channel.id,
        channel.guild_id,
        muted,
        includeCurrent,
        includeMuted,
        includeBlocked,
        includeIgnored
    ], sameIds);
}// A factory, so the theme is read when an indicator renders rather than when the plugin loads.
var useStyles = window.unbound.metro.components.Discord.createStyles(function() {
    return {
        container: {
            alignItems: 'center',
            flexDirection: 'row',
            height: 16,
            marginLeft: 6
        },
        dot: {
            backgroundColor: Theme.colors.TEXT_MUTED,
            borderRadius: 3,
            height: 6,
            width: 6
        }
    };
});// Discord's staggered three-dot wave: each dot pulses in size and opacity on a 2.4-second cycle.
function TypingDots() {
    var styles = useStyles();
    var phase = window.React.useRef(new window.ReactNative.Animated.Value(2.8)).current;
    var waves = window.React.useMemo(function() {
        return [
            0,
            1,
            2
        ].map(function(index) {
            return window.ReactNative.Animated.modulo(window.ReactNative.Animated.add(phase, -index * 0.25), 2);
        });
    }, [
        phase
    ]);
    var inputRange = [
        0,
        0.4,
        0.8,
        1,
        1.2,
        1.6,
        2
    ];
    window.React.useEffect(function() {
        var animation = window.ReactNative.Animated.loop(window.ReactNative.Animated.timing(phase, {
            toValue: 6.8,
            duration: 2400,
            easing: window.ReactNative.Easing.linear,
            useNativeDriver: true
        }));
        animation.start();
        return function() {
            return animation.stop();
        };
    }, [
        phase
    ]);
    return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: styles.container
    }, waves.map(function(wave, index) {
        return /*#__PURE__*/ React.createElement(window.ReactNative.Animated.View, {
            key: index,
            style: [
                styles.dot,
                {
                    marginRight: index < 2 ? 1.5 : 0,
                    opacity: wave.interpolate({
                        inputRange: inputRange,
                        outputRange: [
                            0.3,
                            0.3,
                            1,
                            1,
                            1,
                            0.3,
                            0.3
                        ]
                    }),
                    transform: [
                        {
                            scale: wave.interpolate({
                                inputRange: inputRange,
                                outputRange: [
                                    0.8,
                                    0.8,
                                    1,
                                    1,
                                    1,
                                    0.8,
                                    0.8
                                ]
                            })
                        }
                    ]
                }
            ]
        });
    }));
}function _array_like_to_array$3(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$2(arr) {
    if (Array.isArray(arr)) return arr;
}
function _iterable_to_array_limit$2(arr, i) {
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
function _non_iterable_rest$2() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$2(arr, i) {
    return _array_with_holes$2(arr) || _iterable_to_array_limit$2(arr, i) || _unsupported_iterable_to_array$3(arr, i) || _non_iterable_rest$2();
}
function _unsupported_iterable_to_array$3(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$3(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$3(o, minLen);
}
function displayName(user, guildId) {
    var _ref, _ref1, _ref2;
    var _GuildMemberStore_getNick;
    return (_ref = (_ref1 = (_ref2 = guildId ? (_GuildMemberStore_getNick = GuildMemberStore.getNick) === null || _GuildMemberStore_getNick === void 0 ? void 0 : _GuildMemberStore_getNick.call(GuildMemberStore, guildId, user.id) : undefined) !== null && _ref2 !== void 0 ? _ref2 : user.globalName) !== null && _ref1 !== void 0 ? _ref1 : user.username) !== null && _ref !== void 0 ? _ref : user.id;
}
function TypingIndicator(param) {
    var channel = param.channel, muted = param.muted;
    var styles = useStyles$3();
    var avatarsRef = window.React.useRef(null);
    var dotsRef = window.React.useRef(null);
    var _useState = _sliced_to_array$2(window.React.useState(null), 2), anchor = _useState[0], setAnchor = _useState[1];
    var mode = settings.useSettingsStore().get('indicatorMode', IndicatorMode.Dots | IndicatorMode.Avatars);
    var typingIds = useTypingIds(channel, muted);
    if (!typingIds.length) return null;
    var users = typingIds.map(function(id) {
        var _UserStore_getUser;
        return (_UserStore_getUser = UserStore.getUser(id)) !== null && _UserStore_getUser !== void 0 ? _UserStore_getUser : null;
    });
    var names = users.map(function(user) {
        return user ? displayName(user, channel.guild_id) : 'Someone';
    });
    var label = typingLabel(names, formatDiscordMessage);
    function showTooltip(target) {
        var _target_current;
        (_target_current = target.current) === null || _target_current === void 0 ? void 0 : _target_current.measureInWindow(function(x, y, width, height) {
            if (![
                x,
                y,
                width,
                height
            ].every(Number.isFinite)) return;
            setAnchor({
                x: x,
                y: y,
                width: width,
                height: height
            });
        });
    }
    return /*#__PURE__*/ React.createElement(React.Fragment, null, /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: styles.row
    }, mode & IndicatorMode.Avatars ? /*#__PURE__*/ React.createElement(TypingAvatars, {
        users: users,
        guildId: channel.guild_id,
        channelId: channel.id,
        containerRef: avatarsRef,
        onShowTooltip: function onShowTooltip() {
            return showTooltip(avatarsRef);
        }
    }) : null, mode & IndicatorMode.Dots ? /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
        ref: dotsRef,
        accessibilityLabel: label,
        onPress: function onPress(event) {
            event.stopPropagation();
            showTooltip(dotsRef);
        }
    }, /*#__PURE__*/ React.createElement(TypingDots, null)) : null), anchor && Tooltips.Tooltip ? /*#__PURE__*/ React.createElement(TypingTooltip, {
        anchor: anchor,
        label: label,
        onClose: function onClose() {
            return setAnchor(null);
        }
    }) : null);
}// Stays mounted in rows rendered while the plugin ran, so it renders nothing once the plugin stops.
function ChannelTypingIndicator(param) {
    var channel = param.channel, muted = param.muted;
    if (!IndicatorsRunning.useRunning()) return null;
    return /*#__PURE__*/ React.createElement(IndicatorBoundary, null, /*#__PURE__*/ React.createElement(TypingIndicator, {
        channel: channel,
        muted: muted
    }));
}// A thread row's `channelInfo`: the row's own info, if any, followed by the indicator.
function ThreadChannelInfo(param) {
    var info = param.info, channel = param.channel, muted = param.muted;
    var indicator = /*#__PURE__*/ React.createElement(ChannelTypingIndicator, {
        channel: channel,
        muted: muted
    });
    if (!info) return indicator;
    return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            alignItems: 'center',
            flexDirection: 'row'
        }
    }, info, indicator);
}/**
 * @description Reads an element's children when they are an array, the shape every row slot has.
 * @param node A rendered element.
 * @returns The children, or nothing when the element has a single child or none.
 */ function childrenOf(node) {
    var _node_props;
    var children = node === null || node === void 0 ? void 0 : (_node_props = node.props) === null || _node_props === void 0 ? void 0 : _node_props.children;
    return Array.isArray(children) ? children : undefined;
}
function isChannelPart(node, channelId) {
    var _node_props_channel, _node_props;
    return (node === null || node === void 0 ? void 0 : (_node_props = node.props) === null || _node_props === void 0 ? void 0 : (_node_props_channel = _node_props.channel) === null || _node_props_channel === void 0 ? void 0 : _node_props_channel.id) === channelId;
}
/**
 * @description Tells whether an element is one the plugin inserted.
 * @param node A rendered element.
 * @returns Whether the element carries the plugin's key.
 */ function isIndicator(node) {
    return (node === null || node === void 0 ? void 0 : node.key) === INDICATOR_KEY;
}
/**
 * @description Finds where a text channel row shows its channel info, which the indicator goes before.
 * @param result The rendered text channel row.
 * @param channelId The row's channel ID.
 * @returns The row, its content, and the info's index, or nothing for an unfamiliar or already patched row.
 */ function findTextChannelSlot(result, channelId) {
    var _childrenOf, _childrenOf1;
    var row = (_childrenOf = childrenOf(result)) === null || _childrenOf === void 0 ? void 0 : _childrenOf.find(function(child) {
        var _child_props;
        return (child === null || child === void 0 ? void 0 : (_child_props = child.props) === null || _child_props === void 0 ? void 0 : _child_props.accessibilityRole) === 'button';
    });
    var content = (_childrenOf1 = childrenOf(row)) === null || _childrenOf1 === void 0 ? void 0 : _childrenOf1.find(function(child) {
        var _childrenOf;
        return (_childrenOf = childrenOf(child)) === null || _childrenOf === void 0 ? void 0 : _childrenOf.some(function(part) {
            return isChannelPart(part, channelId);
        });
    });
    var parts = childrenOf(content);
    if (!row || !content || !parts || parts.some(isIndicator)) return;
    return {
        row: row,
        content: content,
        parts: parts,
        index: parts.findIndex(function(part) {
            return isChannelPart(part, channelId);
        })
    };
}
/**
 * @description Finds the thread row button whose `channelInfo` the indicator joins.
 * @param result The rendered thread channel row.
 * @param channelId The thread's channel ID.
 * @returns The row and its container, or nothing for an unfamiliar or already patched row.
 */ function findThreadChannelSlot(result, channelId) {
    var _childrenOf;
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = ((_childrenOf = childrenOf(result)) !== null && _childrenOf !== void 0 ? _childrenOf : [])[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var container = _step.value;
            var _childrenOf1, _row_props;
            var row = (_childrenOf1 = childrenOf(container)) === null || _childrenOf1 === void 0 ? void 0 : _childrenOf1.find(function(child) {
                var _child_props;
                return isChannelPart(child, channelId) && ((_child_props = child.props) === null || _child_props === void 0 ? void 0 : _child_props.accessibilityRole) === 'button';
            });
            if (!row) {
                continue;
            }
            return isIndicator((_row_props = row.props) === null || _row_props === void 0 ? void 0 : _row_props.channelInfo) ? undefined : {
                container: container,
                row: row
            };
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
}/**
 * @description Copies a rendered element with new children, leaving the original untouched.
 * @param parent The element to copy.
 * @param children The copy's children.
 * @returns The copy.
 */ function withChildren(parent, children) {
    // Rendered nodes are real React elements; `RenderNode` only names the props the plugin reads.
    return window.React.cloneElement(parent, {}, children);
}
/**
 * @description Copies a rendered element with one of its children swapped out.
 * @param parent The element whose children hold `child`.
 * @param child The child to replace.
 * @param next The replacement.
 * @returns A copy of `parent` with `next` in place of `child`.
 */ function replaceChild(parent, child, next) {
    var _childrenOf;
    var children = (_childrenOf = childrenOf(parent)) !== null && _childrenOf !== void 0 ? _childrenOf : [];
    return withChildren(parent, children.map(function(node) {
        return node === child ? next : node;
    }));
}function _array_like_to_array$2(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$1(arr) {
    if (Array.isArray(arr)) return arr;
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
function _iterable_to_array_limit$1(arr, i) {
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
function _non_iterable_rest$1() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
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
function _sliced_to_array$1(arr, i) {
    return _array_with_holes$1(arr) || _iterable_to_array_limit$1(arr, i) || _unsupported_iterable_to_array$2(arr, i) || _non_iterable_rest$1();
}
function _unsupported_iterable_to_array$2(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$2(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$2(o, minLen);
}
function addIndicator(result, param) {
    var channel = param.channel, muted = param.muted;
    var _slot_row_props;
    if (!(channel === null || channel === void 0 ? void 0 : channel.id)) return;
    var slot = findThreadChannelSlot(result, channel.id);
    if (!slot) return;
    var row = /*#__PURE__*/ window.React.cloneElement(slot.row, {
        channelInfo: /*#__PURE__*/ React.createElement(ThreadChannelInfo, {
            key: INDICATOR_KEY,
            info: (_slot_row_props = slot.row.props) === null || _slot_row_props === void 0 ? void 0 : _slot_row_props.channelInfo,
            channel: channel,
            muted: Boolean(muted)
        })
    });
    return replaceChild(result, slot.container, replaceChild(slot.container, slot.row, row));
}
/**
 * @description Shows the typing indicator in thread rows, after the thread's channel info.
 * @returns A function that removes the patches.
 */ function patchThreadChannel() {
    if (typeof ThreadChannel.default !== 'function') {
        console.error('[Channel Typing Indicators] Skipped threads, the row is not a function.');
        return function() {};
    }
    var hooked;
    // The row renders an inner function component, which the patcher can only hook through a
    // holder object. The hook is redone only when Discord hands back a different component.
    function hookedRenderer(type) {
        if ((hooked === null || hooked === void 0 ? void 0 : hooked.type) !== type) {
            hooked === null || hooked === void 0 ? void 0 : hooked.unpatch();
            var host = {
                render: type
            };
            var unpatch = Patcher.after(host, 'render', function(param) {
                var _param_args = _sliced_to_array$1(param.args, 1), props = _param_args[0], result = param.result;
                return addIndicator(result, props);
            });
            hooked = {
                type: type,
                host: host,
                unpatch: unpatch
            };
        }
        return hooked.host.render;
    }
    var unpatch = Patcher.after(ThreadChannel, 'default', function(param) {
        var result = param.result;
        if (typeof (result === null || result === void 0 ? void 0 : result.type) !== 'function') return;
        var Renderer = hookedRenderer(result.type);
        return /*#__PURE__*/ React.createElement(Renderer, _object_spread_props(_object_spread({}, result.props), {
            key: result.key
        }));
    });
    return function() {
        unpatch();
        hooked === null || hooked === void 0 ? void 0 : hooked.unpatch();
    };
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
        title: "Channel typing indicators"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Include current channel",
        subLabel: "Show typing activity in the selected channel.",
        value: store.get('includeCurrentChannel', true),
        onValueChange: function onValueChange(value) {
            return store.set('includeCurrentChannel', value);
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Include muted channels",
        subLabel: "Show typing activity in muted channels.",
        value: store.get('includeMutedChannels', false),
        onValueChange: function onValueChange(value) {
            return store.set('includeMutedChannels', value);
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Include ignored users",
        subLabel: "Show typing activity from ignored users.",
        value: store.get('includeIgnoredUsers', false),
        onValueChange: function onValueChange(value) {
            return store.set('includeIgnoredUsers', value);
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Include blocked users",
        subLabel: "Show typing activity from blocked users.",
        value: store.get('includeBlockedUsers', false),
        onValueChange: function onValueChange(value) {
            return store.set('includeBlockedUsers', value);
        }
    })), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRadioGroup, {
        title: "Appearance",
        value: store.get('indicatorMode', IndicatorMode.Dots | IndicatorMode.Avatars),
        onChange: function onChange(value) {
            return store.set('indicatorMode', value);
        }
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRadioRow, {
        label: "Avatars and animated dots",
        value: IndicatorMode.Dots | IndicatorMode.Avatars
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRadioRow, {
        label: "Animated dots",
        value: IndicatorMode.Dots
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRadioRow, {
        label: "Avatars",
        value: IndicatorMode.Avatars
    })));
}function _array_like_to_array$1(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$1(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$1(arr);
}
function _iterable_to_array$1(iter) {
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
function _non_iterable_spread$1() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array(arr, i) {
    return _array_with_holes(arr) || _iterable_to_array_limit(arr, i) || _unsupported_iterable_to_array$1(arr, i) || _non_iterable_rest();
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
/**
 * @description Shows the typing indicator in text channel rows, just before the channel info.
 * @returns A function that removes the patch.
 */ function patchTextChannel() {
    var _TextChannel_default;
    if (typeof ((_TextChannel_default = TextChannel.default) === null || _TextChannel_default === void 0 ? void 0 : _TextChannel_default.type) !== 'function') {
        console.error('[Channel Typing Indicators] Skipped text channels, the row is not a memo.');
        return function() {};
    }
    return Patcher.after(TextChannel.default, 'type', function(param) {
        var _param_args = _sliced_to_array(param.args, 1), props = _param_args[0], result = param.result;
        var channel = props.channel, muted = props.muted;
        if (!(channel === null || channel === void 0 ? void 0 : channel.id)) return;
        var slot = findTextChannelSlot(result, channel.id);
        if (!slot) return;
        var indicator = /*#__PURE__*/ React.createElement(ChannelTypingIndicator, {
            key: INDICATOR_KEY,
            channel: channel,
            muted: Boolean(muted)
        });
        var parts = _to_consumable_array$1(slot.parts.slice(0, slot.index)).concat([
            indicator
        ], _to_consumable_array$1(slot.parts.slice(slot.index)));
        var content = withChildren(slot.content, parts);
        return replaceChild(result, slot.row, replaceChild(slot.row, slot.content, content));
    });
}function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes(arr) {
    if (Array.isArray(arr)) return _array_like_to_array(arr);
}
function _iterable_to_array(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
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
var dispose = function dispose() {};
function start() {
    if (!ensureModules('Channel Typing Indicators', {
        Theme: Theme
    })) return;
    var stores = [
        TypingStoreFilter,
        UserStoreFilter
    ];
    dispose = applyFeatures('Channel Typing Indicators', [
        IndicatorsRunning.markRunning,
        function() {
            return whenAllLoaded(_to_consumable_array(stores).concat([
                TextChannelPath
            ]), patchTextChannel);
        },
        function() {
            return whenAllLoaded(_to_consumable_array(stores).concat([
                ThreadChannelPath
            ]), patchThreadChannel);
        }
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