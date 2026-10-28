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
}var PendingReplyActions = window.unbound.metro.findByProps('createPendingReply', {
    lazy: true
});
var settings = window.unbound.storage.getStore('unbound.no-reply-mention');
var Patcher = window.unbound.patcher.createPatcher('unbound.no-reply-mention');function _array_like_to_array$3(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$3(arr);
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
    return _array_without_holes(arr) || _iterable_to_array(arr) || _unsupported_iterable_to_array$3(arr) || _non_iterable_spread();
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
 * @description Reads the stored exception list, which separates IDs with commas, spaces or newlines.
 * @param value The stored `userList` setting.
 * @returns The unique user IDs, in stored order, or none when the setting is not a string.
 */ function parseUserList(// UNKNOWN: the store returns whatever was saved under `userList`, which may not be a string.
value) {
    if (typeof value !== 'string') return [];
    return _to_consumable_array(new Set(value.split(/[\s,]+/).filter(Boolean)));
}
/**
 * @description Decides whether a new reply mentions the author of the message it replies to.
 * @param authorId The replied-to message's author.
 * @param userList The stored `userList` setting.
 * @param pingListed The stored `shouldPingListed` setting.
 * @returns `true` only when listed users may be pinged and the author is on the list.
 */ function shouldMention(authorId, userList, pingListed) {
    return pingListed && authorId !== undefined && parseUserList(userList).includes(authorId);
}
/**
 * @description Checks that a value looks like a Discord user ID.
 * @param value The text the user entered.
 * @returns Whether the value is a 15 to 25 digit snowflake.
 */ function isUserId(value) {
    return /^\d{15,25}$/.test(value.trim());
}
function serializeUserList(userIds) {
    return _to_consumable_array(new Set(userIds.map(function(id) {
        return id.trim();
    }).filter(Boolean))).join('\n');
}
/**
 * @description Adds a user ID to the stored exception list.
 * @param value The stored `userList` setting.
 * @param userId The ID to add.
 * @returns The new setting value, one ID per line, without duplicates.
 */ function addUserId(value, userId) {
    return serializeUserList(_to_consumable_array(parseUserList(value)).concat([
        userId
    ]));
}
/**
 * @description Replaces a user ID in the stored exception list.
 * @param value The stored `userList` setting.
 * @param currentUserId The ID to replace.
 * @param nextUserId The ID to put in its place.
 * @returns The new setting value, one ID per line, without duplicates.
 */ function editUserId(value, currentUserId, nextUserId) {
    return serializeUserList(parseUserList(value).map(function(id) {
        return id === currentUserId ? nextUserId : id;
    }));
}
/**
 * @description Removes a user ID from the stored exception list.
 * @param value The stored `userList` setting.
 * @param userId The ID to remove.
 * @returns The new setting value, one ID per line.
 */ function removeUserId(value, userId) {
    return serializeUserList(parseUserList(value).filter(function(id) {
        return id !== userId;
    }));
}function _array_like_to_array$2(arr, len) {
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
    return _array_with_holes$2(arr) || _iterable_to_array_limit$2(arr, i) || _unsupported_iterable_to_array$2(arr, i) || _non_iterable_rest$2();
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
 * @description Starts every reply with its mention off, unless the replied-to author is on the exception list.
 * @returns A function that removes the patch.
 */ function patchPendingReplyActions() {
    return Patcher.before(PendingReplyActions, 'createPendingReply', function(param) {
        var _param_args = _sliced_to_array$2(param.args, 1), reply = _param_args[0];
        var _reply_message_author, _reply_message;
        if (!reply) return;
        reply.shouldMention = shouldMention((_reply_message = reply.message) === null || _reply_message === void 0 ? void 0 : (_reply_message_author = _reply_message.author) === null || _reply_message_author === void 0 ? void 0 : _reply_message_author.id, settings.get('userList', ''), settings.get('shouldPingListed', false));
    });
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
}function _array_like_to_array$1(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$1(arr) {
    if (Array.isArray(arr)) return arr;
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
function _sliced_to_array$1(arr, i) {
    return _array_with_holes$1(arr) || _iterable_to_array_limit$1(arr, i) || _unsupported_iterable_to_array$1(arr, i) || _non_iterable_rest$1();
}
function _unsupported_iterable_to_array$1(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$1(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$1(o, minLen);
}
function UserIdEditor(param) {
    var initialValue = param.initialValue, onCancel = param.onCancel, onSave = param.onSave;
    var _useState = _sliced_to_array$1(window.React.useState(initialValue), 2), value = _useState[0], setValue = _useState[1];
    return /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Stack, {
        spacing: 12
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TextInput, {
        title: initialValue ? 'Edit user ID' : 'Add user ID',
        placeholder: "Discord user ID",
        keyboardType: "number-pad",
        autoCapitalize: "none",
        autoCorrect: false,
        value: value,
        onChange: setValue
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Stack, {
        direction: "horizontal",
        spacing: 12
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Button, {
        grow: true,
        variant: "secondary",
        text: "Cancel",
        onPress: onCancel
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Button, {
        grow: true,
        variant: "primary",
        text: "Save",
        onPress: function onPress() {
            return onSave(value);
        }
    })));
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
function SettingsPanel() {
    var store = settings.useSettingsStore();
    var _useState = _sliced_to_array(window.React.useState(null), 2), editor = _useState[0], setEditor = _useState[1];
    var userList = store.get('userList', '');
    var pingListed = store.get('shouldPingListed', false);
    var userIds = parseUserList(userList);
    function save(value) {
        var userId = value.trim();
        if (!isUserId(userId)) {
            window.unbound.toasts.showToast({
                title: 'No Reply Mention',
                content: 'Enter a numeric Discord user ID.'
            });
            return;
        }
        store.set('userList', (editor === null || editor === void 0 ? void 0 : editor.original) ? editUserId(userList, editor.original, userId) : addUserId(userList, userId));
        setEditor(null);
    }
    function renderEditor(original) {
        return /*#__PURE__*/ React.createElement(UserIdEditor, {
            key: "editor-".concat(original !== null && original !== void 0 ? original : ''),
            initialValue: original !== null && original !== void 0 ? original : '',
            onCancel: function onCancel() {
                return setEditor(null);
            },
            onSave: save
        });
    }
    return /*#__PURE__*/ React.createElement(Page, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "Exceptions"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: "Add user ID",
        subLabel: "Replies can mention these users when the exception is enabled",
        arrow: true,
        onPress: function onPress() {
            return setEditor({
                original: null
            });
        }
    }), (editor === null || editor === void 0 ? void 0 : editor.original) === null ? renderEditor(null) : null, userIds.length ? userIds.map(function(userId) {
        return (editor === null || editor === void 0 ? void 0 : editor.original) === userId ? renderEditor(userId) : /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
            key: userId,
            label: userId,
            subLabel: "Tap to edit",
            onPress: function onPress() {
                return setEditor({
                    original: userId
                });
            },
            trailing: /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Stack, {
                direction: "horizontal",
                spacing: 8
            }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Button, {
                size: "sm",
                variant: "secondary",
                text: "Edit",
                onPress: function onPress() {
                    return setEditor({
                        original: userId
                    });
                }
            }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Button, {
                size: "sm",
                variant: "destructive",
                text: "Delete",
                onPress: function onPress() {
                    return store.set('userList', removeUserId(userList, userId));
                }
            }))
        });
    }) : /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: "No users added yet."
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Only Ping Listed Users",
        subLabel: pingListed ? 'Replies mention only the users listed above' : 'Replies do not mention anyone by default',
        value: pingListed,
        onValueChange: function onValueChange(value) {
            return store.set('shouldPingListed', value);
        }
    })));
}var dispose = function dispose() {};
function start() {
    if (!ensureModules('No Reply Mention', {
        PendingReplyActions: PendingReplyActions
    })) return;
    dispose = applyFeatures('No Reply Mention', [
        patchPendingReplyActions
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