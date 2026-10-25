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
}function _define_property$1(obj, key, value) {
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
            var found = window.unbound.metro.findLazy(toFilter(source), _object_spread_props(_object_spread$1({}, options), {
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
}var Patcher = window.unbound.patcher.createPatcher('unbound.view-raw');
var ActionSheets = window.unbound.metro.api.ActionSheets;
var ContextMenusFilter = window.unbound.metro.filters.byProps('showContextMenu', 'hideContextMenu');
// The same module as `metro.common.Theme`, which its typings do not declare yet.
var Theme = window.unbound.metro.findByProps('colors', 'internal', {
    lazy: true
});
var ChannelStore = window.unbound.metro.findStore('Channel', {
    lazy: true
});
var UserProfileStore = window.unbound.metro.findStore('UserProfile', {
    lazy: true
});
var Clipboard = window.unbound.metro.common.Clipboard;
var UserStore = window.unbound.metro.stores.Users;
var GuildStore = window.unbound.metro.stores.Guilds;function _array_like_to_array$3(arr, len) {
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
function _type_of$2(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
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
 * @description Checks whether a value from Discord is a plain record whose data can be shown.
 * @param value A sheet prop or a nested field.
 * @returns `true` for any non-null object that is not an array.
 */ function isRawObject(value) {
    return (typeof value === "undefined" ? "undefined" : _type_of$2(value)) === 'object' && value !== null && !Array.isArray(value);
}
function sortValue(value) {
    if (Array.isArray(value)) return value.map(sortValue);
    return isRawObject(value) ? sortKeys(value) : value;
}
/**
 * @description Copies an object with its keys in alphabetical order at every depth, so the JSON reads predictably.
 * @param object The record to sort.
 * @returns A sorted copy; array order is kept.
 */ function sortKeys(object) {
    var entries = Object.entries(object).sort(function(param, param1) {
        var _param = _sliced_to_array$2(param, 1), left = _param[0], _param1 = _sliced_to_array$2(param1, 1), right = _param1[0];
        return left.localeCompare(right);
    });
    return Object.fromEntries(entries.map(function(param) {
        var _param = _sliced_to_array$2(param, 2), key = _param[0], value = _param[1];
        return [
            key,
            sortValue(value)
        ];
    }));
}
/**
 * @description Copies a message without its author's private account fields and Discord's client-only bookkeeping.
 * @param message The message record from the action sheet.
 * @returns A sorted, JSON-safe copy of the message.
 */ function cleanMessage(message) {
    // The JSON round trip also turns timestamps into the strings the sheet shows.
    var clone = JSON.parse(JSON.stringify(message));
    var author = clone.author, attachments = clone.attachments;
    if (isRawObject(author)) {
        for(var _i = 0, _iter = [
            'email',
            'phone',
            'mfaEnabled',
            'personalConnectionId'
        ]; _i < _iter.length; _i++){
            var field = _iter[_i];
            delete author[field];
        }
    }
    delete clone.editHistory;
    delete clone.deleted;
    delete clone.firstEditTimestamp;
    if (Array.isArray(attachments)) {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = attachments[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var attachment = _step.value;
                if (isRawObject(attachment)) delete attachment.deleted;
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
    return sortKeys(clone);
}// UNKNOWN: sheet props come from Discord untyped.
function asString(value) {
    return typeof value === 'string' ? value : undefined;
}
function supportsRawSheet(key) {
    return /MessageLongPressActionSheet$/i.test(key) || /^UserProfile/i.test(key) || /^GuildActionSheet:/i.test(key) || /Channel(?:LongPress)?ActionSheet/i.test(key);
}
/**
 * @description Picks the record an action sheet is about: its message, profile, channel, guild or user.
 * @param key The action sheet's key, which names the sheet.
 * @param props The props Discord opened the sheet with.
 * @returns The item to show raw, or `null` when the sheet is not one View Raw supports.
 */ function getRawItem(key, props) {
    var _asString, _ref;
    var _ChannelStore_getChannel, _UserProfileStore_getGuildMemberProfile, _UserProfileStore_getUserProfile;
    if (!supportsRawSheet(key)) return null;
    var message = props.message, profile = props.profile, channel = props.channel, guild = props.guild;
    if (isRawObject(message)) {
        var _asString1;
        return {
            type: 'Message',
            data: cleanMessage(message),
            content: (_asString1 = asString(message.content)) !== null && _asString1 !== void 0 ? _asString1 : ''
        };
    }
    if (isRawObject(profile)) return {
        type: 'Profile',
        data: sortKeys(profile)
    };
    if (isRawObject(channel)) return {
        type: 'Channel',
        data: sortKeys(channel)
    };
    if (isRawObject(guild)) return {
        type: 'Guild',
        data: sortKeys(guild)
    };
    var channelId = asString(props.channelId);
    // Optional: without the channel or profile store, the item falls back to what the props carry.
    var storedChannel = channelId ? (_ChannelStore_getChannel = ChannelStore.getChannel) === null || _ChannelStore_getChannel === void 0 ? void 0 : _ChannelStore_getChannel.call(ChannelStore, channelId) : undefined;
    if (storedChannel) return {
        type: 'Channel',
        data: sortKeys(storedChannel)
    };
    var propUser = isRawObject(props.user) ? props.user : undefined;
    var userId = (_asString = asString(props.userId)) !== null && _asString !== void 0 ? _asString : asString(propUser === null || propUser === void 0 ? void 0 : propUser.id);
    var user = propUser !== null && propUser !== void 0 ? propUser : userId ? UserStore.getUser(userId) : undefined;
    if (!user) return null;
    if (!/profile/i.test(key) || !userId) return {
        type: 'User',
        data: sortKeys(user)
    };
    var userProfile = (_ref = (_UserProfileStore_getGuildMemberProfile = UserProfileStore.getGuildMemberProfile) === null || _UserProfileStore_getGuildMemberProfile === void 0 ? void 0 : _UserProfileStore_getGuildMemberProfile.call(UserProfileStore, userId, asString(props.guildId))) !== null && _ref !== void 0 ? _ref : (_UserProfileStore_getUserProfile = UserProfileStore.getUserProfile) === null || _UserProfileStore_getUserProfile === void 0 ? void 0 : _UserProfileStore_getUserProfile.call(UserProfileStore, userId);
    return userProfile ? {
        type: 'Profile',
        data: sortKeys(userProfile)
    } : {
        type: 'User',
        data: sortKeys(user)
    };
}function SheetButton(param) {
    var label = param.label, onPress = param.onPress;
    return /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
        onPress: onPress,
        style: function style(param) {
            var pressed = param.pressed;
            return {
                alignItems: 'center',
                backgroundColor: pressed ? '#4752c4' : '#5865f2',
                borderRadius: 9,
                flex: 1,
                justifyContent: 'center',
                minHeight: 34,
                paddingHorizontal: 6
            };
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        numberOfLines: 1,
        style: {
            color: '#f2f3f5',
            fontSize: 12,
            fontWeight: '700'
        }
    }, label));
}
function CodeField(param) {
    var value = param.value, style = param.style;
    return /*#__PURE__*/ React.createElement(window.ReactNative.TextInput, {
        multiline: true,
        scrollEnabled: true,
        selectTextOnFocus: true,
        showSoftInputOnFocus: false,
        style: [
            {
                backgroundColor: '#1e1f22',
                borderRadius: 8,
                color: '#dbdee1',
                fontFamily: 'Menlo',
                padding: 12,
                textAlignVertical: 'top'
            },
            style
        ],
        value: value
    });
}
function RawSheet(param) {
    var type = param.type, json = param.json, content = param.content, onCopy = param.onCopy, onClose = param.onClose;
    return /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.ActionSheet, {
        startExpanded: true
    }, /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            maxHeight: '85%',
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 18
        }
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Text, {
        variant: "text-lg/semibold"
    }, "Raw ".concat(type, " Data")), content ? /*#__PURE__*/ React.createElement(React.Fragment, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Text, {
        style: {
            marginTop: 16
        },
        variant: "text-sm/semibold"
    }, "Message Content"), /*#__PURE__*/ React.createElement(CodeField, {
        value: content,
        style: {
            fontSize: 13,
            height: 96,
            marginTop: 6
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Text, {
        style: {
            marginTop: 16
        },
        variant: "text-sm/semibold"
    }, "Message Data")) : null, /*#__PURE__*/ React.createElement(CodeField, {
        value: json,
        style: {
            fontSize: 12,
            marginTop: content ? 6 : 16,
            maxHeight: 480
        }
    }), /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            flexDirection: 'row',
            gap: 6,
            marginTop: 16
        }
    }, /*#__PURE__*/ React.createElement(SheetButton, {
        label: "Copy data",
        onPress: function onPress() {
            return onCopy(json, "".concat(type, " data"));
        }
    }), content ? /*#__PURE__*/ React.createElement(SheetButton, {
        label: "Copy content",
        onPress: function onPress() {
            return onCopy(content, 'Raw content');
        }
    }) : null, /*#__PURE__*/ React.createElement(SheetButton, {
        label: "Close",
        onPress: onClose
    }))));
}function copy(value, label) {
    void Promise.resolve(Clipboard.setString(value)).then(function() {
        return window.unbound.toasts.showToast({
            title: 'View Raw',
            content: "".concat(label, " copied to clipboard.")
        });
    });
}
/**
 * @description Opens a sheet showing an item's raw JSON, with buttons to copy it.
 * @param item The record to show.
 */ function openRawSheet(item) {
    var key = "unbound-view-raw-".concat(Date.now());
    var json = JSON.stringify(item.data, null, 4);
    function close() {
        ActionSheets.hideActionSheet(key);
    }
    ActionSheets.openLazy(Promise.resolve({
        default: function _default() {
            var _item_content;
            return /*#__PURE__*/ React.createElement(RawSheet, {
                type: item.type,
                json: json,
                content: (_item_content = item.content) !== null && _item_content !== void 0 ? _item_content : '',
                onCopy: copy,
                onClose: close
            });
        }
    }), key, {
        onClose: close
    }, {
        initialSnapIndex: 1
    });
}// A factory, so the theme is read when a sheet or menu renders rather than when the plugin loads.
var useStyles = window.unbound.metro.components.Discord.createStyles(function() {
    return {
        icon: {
            color: Theme.colors.TEXT_DEFAULT
        }
    };
});function RawIcon() {
    var styles = useStyles();
    var _metro_common_SVG = window.unbound.metro.common.SVG, Svg = _metro_common_SVG.Svg, Path = _metro_common_SVG.Path;
    return /*#__PURE__*/ React.createElement(Svg, {
        width: 20,
        height: 20,
        viewBox: "0 0 20 20"
    }, /*#__PURE__*/ React.createElement(Path, {
        fill: styles.icon.color,
        d: "M12.9297 3.25007C12.7343 3.05261 12.4154 3.05226 12.2196 3.24928L11.5746 3.89824C11.3811 4.09297 11.3808 4.40733 11.5739 4.60245L16.5685 9.64824C16.7614 9.84309 16.7614 10.1569 16.5685 10.3517L11.5739 15.3975C11.3808 15.5927 11.3811 15.907 11.5746 16.1017L12.2196 16.7507C12.4154 16.9477 12.7343 16.9474 12.9297 16.7499L19.2604 10.3517C19.4532 10.1568 19.4532 9.84314 19.2604 9.64832L12.9297 3.25007Z"
    }), /*#__PURE__*/ React.createElement(Path, {
        fill: styles.icon.color,
        d: "M8.42616 4.60245C8.6193 4.40733 8.61898 4.09297 8.42545 3.89824L7.78047 3.24928C7.58466 3.05226 7.26578 3.05261 7.07041 3.25007L0.739669 9.64832C0.5469 9.84314 0.546901 10.1568 0.739669 10.3517L7.07041 16.7499C7.26578 16.9474 7.58465 16.9477 7.78047 16.7507L8.42545 16.1017C8.61898 15.907 8.6193 15.5927 8.42616 15.3975L3.43155 10.3517C3.23869 10.1569 3.23869 9.84309 3.43155 9.64824L8.42616 4.60245Z"
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
function addItem(menu, item, close, showIcon) {
    if (!Array.isArray(menu.items) || menu.items.some(function(entry) {
        return entry.label === 'View Raw';
    })) return;
    menu.items.push(_object_spread({
        label: 'View Raw',
        action: function action() {
            close();
            openRawSheet(item);
        }
    }, showIcon ? {
        IconComponent: RawIcon
    } : {}));
}
/**
 * @description Adds View Raw to a guild's context menu, and to the profile overflow menu of the last opened profile.
 * @param state The action sheet patch's record of the last opened profile.
 * @returns A function that removes the patch, or stops waiting for Discord's context menu module.
 */ function patchContextMenus(state) {
    return whenLoaded(ContextMenusFilter, function(ContextMenus) {
        function close() {
            ContextMenus.hideContextMenu();
        }
        return Patcher.before(ContextMenus, 'showContextMenu', function(param) {
            var _param_args = _sliced_to_array$1(param.args, 1), menu = _param_args[0];
            var _menu_items;
            if (!menu) return;
            var guild = typeof menu.key === 'string' ? GuildStore.getGuild(menu.key) : undefined;
            if (guild) {
                addItem(menu, {
                    type: 'Guild',
                    data: sortKeys(guild)
                }, close, true);
                return;
            }
            var profileUserId = state.profileUserId;
            if (!profileUserId || !((_menu_items = menu.items) === null || _menu_items === void 0 ? void 0 : _menu_items.some(function(item) {
                return item.label === 'View Main Profile';
            }))) {
                return;
            }
            var profile = getRawItem("UserProfile".concat(profileUserId), {
                userId: profileUserId
            });
            if (profile) addItem(menu, profile, close, false);
        });
    });
}/**
 * @description Returns Discord's action sheet row, with the `Group` and `Icon` parts it carries, as Unbound's own sheets use it.
 * @returns The `ActionSheetRow` from Unbound's `BottomSheets` handle.
 */ function getActionSheetRow() {
    return window.unbound.metro.components.BottomSheets.ActionSheetRow;
}function _type_of$1(obj) {
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
    while(current && (typeof current === "undefined" ? "undefined" : _type_of$1(current)) === 'object'){
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
}function _array_like_to_array$1(arr, len) {
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
    return _array_with_holes(arr) || _iterable_to_array_limit(arr, i) || _unsupported_iterable_to_array$1(arr, i) || _non_iterable_rest();
}
function _unsupported_iterable_to_array$1(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$1(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$1(o, minLen);
}
var DIRECT_SHEETS = [
    [
        'modules/messages/native/long_press/LongPressMessageActionSheet.tsx',
        'MessageLongPressActionSheet'
    ]
];
/**
 * @description Lets a plugin change the action sheets Discord opens through `openLazy`, and the sheets it opens without it, such as Android's message long-press sheet, patching each sheet component once.
 * @template P The sheet props the plugin reads.
 * @param Patcher The plugin's patcher.
 * @param ActionSheets Discord's action sheet module.
 * @param onOpen Runs on every opened sheet and returns the render patch for its component, or `undefined` to leave it alone.
 * @returns A function that removes every patch and ignores sheets that finish loading afterwards.
 */ function patchLazySheets(Patcher, ActionSheets, onOpen) {
    var patchedModules = new WeakSet();
    var unpatches = [];
    var disposed = false;
    function patchModule(module, render) {
        if (disposed || !module || patchedModules.has(module)) return;
        patchedModules.add(module);
        var target = findRenderTarget(module);
        if (!target) return;
        unpatches.push(Patcher.after(target.holder, target.key, function(param) {
            var result = param.result;
            return render(result);
        }));
    }
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        var _loop = function() {
            var _step_value = _sliced_to_array(_step.value, 2), path = _step_value[0], key = _step_value[1];
            unpatches.push(whenLoaded(path, function(module) {
                var target = findRenderTarget(module);
                if (disposed || !target || patchedModules.has(module)) return;
                patchedModules.add(module);
                return Patcher.after(target.holder, target.key, function(param) {
                    var _param_args = _sliced_to_array(param.args, 1), props = _param_args[0], result = param.result;
                    var render = props ? onOpen(key, props) : undefined;
                    return render ? render(result) : result;
                });
            }));
        };
        for(var _iterator = DIRECT_SHEETS[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true)_loop();
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
    unpatches.push(Patcher.before(ActionSheets, 'openLazy', function(param) {
        var _param_args = _sliced_to_array(param.args, 3), sheet = _param_args[0], key = _param_args[1], props = _param_args[2];
        if (typeof key !== 'string' || !(sheet === null || sheet === void 0 ? void 0 : sheet.then) || !props) return;
        var render = onOpen(key, props);
        if (!render) return;
        // Discord surfaces a sheet that fails to load; the plugin only skips patching it.
        sheet.then(function(module) {
            return patchModule(module, render);
        }).catch(function() {
            return undefined;
        });
    }));
    return function() {
        disposed = true;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = unpatches.splice(0)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var unpatch = _step.value;
                unpatch();
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
    };
}// UNKNOWN: a component may render any node.
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
var MAX_DEPTH = 15;
/**
 * @description Checks whether a value can be read as a rendered React element.
 * @param value Any node from a render result.
 * @returns `true` for any non-null object, including arrays of children.
 */ function isElementNode(value) {
    return (typeof value === "undefined" ? "undefined" : _type_of(value)) === 'object' && value !== null;
}
/**
 * @description Reads the component name of an element, looking through `memo` and `forwardRef` wrappers.
 * @param element The rendered element.
 * @returns The host tag, display name or function name, or `undefined` when the component is anonymous.
 */ function getElementName(element) {
    var _ref, _ref1, _ref2, _ref3, _ref4;
    var _type_render, _type_render1, _type_type, _type_type1;
    var type = element.type;
    if (typeof type === 'string') {
        return type;
    }
    if (typeof type === 'function') {
        var _type_displayName;
        return (_type_displayName = type.displayName) !== null && _type_displayName !== void 0 ? _type_displayName : type.name;
    }
    return (_ref = (_ref1 = (_ref2 = (_ref3 = (_ref4 = type === null || type === void 0 ? void 0 : type.displayName) !== null && _ref4 !== void 0 ? _ref4 : type === null || type === void 0 ? void 0 : type.name) !== null && _ref3 !== void 0 ? _ref3 : type === null || type === void 0 ? void 0 : (_type_render = type.render) === null || _type_render === void 0 ? void 0 : _type_render.displayName) !== null && _ref2 !== void 0 ? _ref2 : type === null || type === void 0 ? void 0 : (_type_render1 = type.render) === null || _type_render1 === void 0 ? void 0 : _type_render1.name) !== null && _ref1 !== void 0 ? _ref1 : type === null || type === void 0 ? void 0 : (_type_type = type.type) === null || _type_type === void 0 ? void 0 : _type_type.displayName) !== null && _ref !== void 0 ? _ref : type === null || type === void 0 ? void 0 : (_type_type1 = type.type) === null || _type_type1 === void 0 ? void 0 : _type_type1.name;
}
/**
 * @description Searches a render result depth-first for the first element matching a predicate, through children only.
 * @param node A render result: an element, an array of children, or anything else React accepts.
 * @param predicate Decides whether an element is the one being searched for.
 * @param depth The current depth; the search stops past 15 levels.
 * @returns The matching element, or `undefined` when none matches.
 */ function findElement(// UNKNOWN: a component may render any node, not only elements.
node, predicate) {
    var depth = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 0;
    var _node_props;
    if (depth > MAX_DEPTH || !isElementNode(node)) return;
    if (Array.isArray(node)) {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = node[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var child = _step.value;
                var match = findElement(child, predicate, depth + 1);
                if (match) {
                    return match;
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
        return;
    }
    if (predicate(node)) {
        return node;
    }
    return findElement((_node_props = node.props) === null || _node_props === void 0 ? void 0 : _node_props.children, predicate, depth + 1);
}function isRow(value) {
    if (!isElementNode(value) || !isElementNode(value.props) || Array.isArray(value.props)) {
        return false;
    }
    return typeof value.props.label === 'string' && typeof value.props.onPress === 'function';
}
/**
 * @description Recognizes the group that holds an action sheet's rows, including the anonymous group newer Discord builds render.
 * @param value Any node from an action sheet's render result.
 * @returns `true` for an `ActionSheetRowGroup`, or an unnamed element whose children are all labelled rows.
 */ function isActionSheetRowGroup(value) {
    var _value_props, _value_props1;
    if (!isElementNode(value) || Array.isArray(value)) {
        return false;
    }
    if (getElementName(value) === 'ActionSheetRowGroup') {
        return true;
    }
    var children = (_value_props = value.props) === null || _value_props === void 0 ? void 0 : _value_props.children;
    if (typeof ((_value_props1 = value.props) === null || _value_props1 === void 0 ? void 0 : _value_props1.hasIcons) !== 'boolean' || !Array.isArray(children)) {
        return false;
    }
    return children.length > 0 && children.every(isRow);
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
/**
 * @description Adds a View Raw row to the message, profile, channel and guild action sheets.
 * @param state Where the patch records the open sheet for the context menu patch.
 * @returns A function that removes the row and every sheet patch.
 */ function patchActionSheets(state) {
    var unpatches = [];
    var patchedOwners = new WeakSet();
    // UNKNOWN: an action sheet may render any node.
    function addRow(result) {
        var _findElement_props, _findElement;
        var open = state.open;
        if (!open) return;
        var rows = (_findElement = findElement(result, isActionSheetRowGroup)) === null || _findElement === void 0 ? void 0 : (_findElement_props = _findElement.props) === null || _findElement_props === void 0 ? void 0 : _findElement_props.children;
        if (!Array.isArray(rows) || rows.some(function(row) {
            return isElementNode(row) && row.key === 'unbound-view-raw';
        })) {
            return;
        }
        var ActionSheetRow = getActionSheetRow();
        rows.splice(1, 0, /*#__PURE__*/ React.createElement(ActionSheetRow, {
            key: "unbound-view-raw",
            label: "View Raw",
            icon: /*#__PURE__*/ React.createElement(RawIcon, null),
            onPress: function onPress() {
                ActionSheets.hideActionSheet(open.key);
                openRawSheet(open.item);
            }
        }));
    }
    // The row group can sit inside wrapper components that render after the sheet, so each wrapper is patched as it appears.
    function createRenderer() {
        // A plain function component is swapped for a wrapper, cached so every render reuses the same component.
        var wrappers = new WeakMap();
        var wrapped = new WeakSet();
        function wrap(type, depth) {
            var wrapper = wrappers.get(type);
            if (!wrapper) {
                wrapper = function wrapper() {
                    for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
                        args[_key] = arguments[_key];
                    }
                    return render(type.apply(void 0, _to_consumable_array(args)), depth + 1);
                };
                wrappers.set(type, wrapper);
                wrapped.add(wrapper);
            }
            return wrapper;
        }
        // UNKNOWN: an action sheet may render any node.
        function render(result) {
            var depth = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
            addRow(result);
            if (depth >= 15 || !isElementNode(result) || Array.isArray(result)) return result;
            if (typeof result.type === 'function') {
                if (!wrapped.has(result.type)) result.type = wrap(result.type, depth);
                return result;
            }
            var target = findRenderTarget(result, 'type');
            if (!target || patchedOwners.has(target.holder)) return result;
            patchedOwners.add(target.holder);
            unpatches.push(Patcher.after(target.holder, target.key, function(ctx) {
                return render(ctx.result, depth + 1);
            }));
            return result;
        }
        return render;
    }
    var unpatchSheets = patchLazySheets(Patcher, ActionSheets, function(key, props) {
        if (key.startsWith('UserProfile') && typeof props.userId === 'string') {
            state.profileUserId = props.userId;
        }
        var item = getRawItem(key, props);
        state.open = item ? {
            key: key,
            item: item
        } : null;
        if (!item) return;
        var render = createRenderer();
        return function(result) {
            return render(result);
        };
    });
    return function() {
        unpatchSheets();
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = unpatches.splice(0)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var unpatch = _step.value;
                unpatch();
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
    };
}var dispose = function dispose() {};
function start() {
    if (!ensureModules('View Raw', {
        ActionSheets: ActionSheets,
        Theme: Theme
    })) return;
    var state = {
        open: null,
        profileUserId: null
    };
    dispose = applyFeatures('View Raw', [
        function() {
            return patchActionSheets(state);
        },
        function() {
            return patchContextMenus(state);
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