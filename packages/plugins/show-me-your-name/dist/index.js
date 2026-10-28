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
}/**
 * @description Runs `enable` while a boolean setting is on and its cleanup while it is off, so a feature's patches exist only when the user wants them.
 * @param store The plugin's settings store from `storage.getStore`.
 * @param key The boolean setting that gates the feature.
 * @param def The setting's default value.
 * @param enable Applies the feature and returns the function that removes it.
 * @returns A function that removes the feature and stops listening; call it in `stop`.
 */ function whileEnabled(store, key, def, enable) {
    var disable = null;
    function sync() {
        var enabled = store.get(key, def);
        if (enabled && !disable) {
            disable = enable();
        } else if (!enabled && disable) {
            disable();
            disable = null;
        }
    }
    var unsubscribe = store.addListener(function(payload) {
        return payload.key === null || payload.key === key;
    }, sync);
    sync();
    return function() {
        unsubscribe();
        disable === null || disable === void 0 ? void 0 : disable();
        disable = null;
    };
}var MessageRowData = window.unbound.metro.findByProps('generateMessageRowData', {
    lazy: true
});
var RelationshipStore = window.unbound.metro.findStore('Relationship', {
    lazy: true
});
var UserStore = window.unbound.metro.stores.Users;
var settings = window.unbound.storage.getStore('unbound.show-me-your-name');
var Patcher = window.unbound.patcher.createPatcher('unbound.show-me-your-name');/**
 * @description Builds the author label shown on a message from the name Discord displays and the account's username.
 * @param parts The displayed name (with its `@` when it has one), the username, a friend nickname to prefer, and the mode.
 * @returns The label, or the displayed name unchanged when it already is the username.
 */ function formatName(param) {
    var displayed = param.displayed, username = param.username, nickname = param.nickname, mode = param.mode;
    var prefix = displayed.startsWith('@') ? '@' : '';
    var nick = nickname !== null && nickname !== void 0 ? nickname : displayed.slice(prefix.length);
    var tag = "@".concat(username);
    if (username === nick) return displayed;
    if (mode === 'user') return tag;
    if (mode === 'user-nick') return "".concat(tag, " (").concat(nick, ")");
    return "".concat(prefix).concat(nick, " (").concat(tag, ")");
}var AUTOMOD_MESSAGE_TYPE = 24;function isAutomod(message) {
    var type = message === null || message === void 0 ? void 0 : message.type;
    return Number(type) === AUTOMOD_MESSAGE_TYPE || type === 'AUTOMOD_ACTION' || type === 'AUTO_MODERATION_ACTION' || (message === null || message === void 0 ? void 0 : message.isAutomod) === true || (message === null || message === void 0 ? void 0 : message.isAutoModAction) === true;
}
function relabel(row, messageAuthor) {
    var _RelationshipStore_getNickname;
    if (typeof (row === null || row === void 0 ? void 0 : row.username) !== 'string') return;
    var author = messageAuthor !== null && messageAuthor !== void 0 ? messageAuthor : row.authorId ? UserStore.getUser(row.authorId) : undefined;
    if (!author) return;
    var username = settings.get('displayNames', false) && author.globalName ? author.globalName : author.username;
    if (!username) return;
    var nickname = settings.get('friendNicknames', true) && author.id ? (_RelationshipStore_getNickname = RelationshipStore.getNickname) === null || _RelationshipStore_getNickname === void 0 ? void 0 : _RelationshipStore_getNickname.call(RelationshipStore, author.id) : null;
    row.username = formatName({
        displayed: row.username,
        username: username,
        nickname: nickname,
        mode: settings.get('mode', 'nick-user')
    });
}
/**
 * @description Shows usernames in the author label of each message.
 * @returns A function that removes the patch.
 */ function patchAuthorNames() {
    return Patcher.after(MessageRowData, 'generateMessageRowData', function(param) {
        var args = param.args, result = param.result;
        var _args_;
        var message = (_args_ = args[0]) === null || _args_ === void 0 ? void 0 : _args_.message;
        if (isAutomod(message)) return;
        relabel(result === null || result === void 0 ? void 0 : result.message, message === null || message === void 0 ? void 0 : message.author);
    });
}
/**
 * @description Shows usernames in the author label of reply previews.
 * @returns A function that removes the patch.
 */ function patchReplyNames() {
    return Patcher.after(MessageRowData, 'generateMessageRowData', function(param) {
        var args = param.args, result = param.result;
        var _ref;
        var _args_, _message_referencedMessage, _result_message_referencedMessage, _result_message;
        var message = (_args_ = args[0]) === null || _args_ === void 0 ? void 0 : _args_.message;
        var reply = (_ref = message === null || message === void 0 ? void 0 : (_message_referencedMessage = message.referencedMessage) === null || _message_referencedMessage === void 0 ? void 0 : _message_referencedMessage.message) !== null && _ref !== void 0 ? _ref : message === null || message === void 0 ? void 0 : message.referenced_message;
        if (isAutomod(message) || isAutomod(reply)) return;
        relabel(result === null || result === void 0 ? void 0 : (_result_message = result.message) === null || _result_message === void 0 ? void 0 : (_result_message_referencedMessage = _result_message.referencedMessage) === null || _result_message_referencedMessage === void 0 ? void 0 : _result_message_referencedMessage.message, reply === null || reply === void 0 ? void 0 : reply.author);
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
}function SettingsPanel() {
    var store = settings.useSettingsStore();
    return /*#__PURE__*/ React.createElement(Page, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRadioGroup, {
        title: "Display Mode",
        value: store.get('mode', 'nick-user'),
        onChange: function onChange(value) {
            return store.set('mode', value);
        }
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRadioRow, {
        label: "Display name then username",
        subLabel: "Display Name (@username)",
        value: "nick-user"
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRadioRow, {
        label: "Username then display name",
        subLabel: "@username (Display Name)",
        value: "user-nick"
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRadioRow, {
        label: "Username only",
        subLabel: "@username",
        value: "user"
    })), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "Preferences"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Show Friend Nicknames",
        subLabel: "Prefer a friend's nickname wherever it applies",
        value: store.get('friendNicknames', true),
        onValueChange: function onValueChange(value) {
            return store.set('friendNicknames', value);
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Use Global Names",
        subLabel: "Show the account's global name instead of its username",
        value: store.get('displayNames', false),
        onValueChange: function onValueChange(value) {
            return store.set('displayNames', value);
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Apply To Replies",
        subLabel: "Also apply to reply previews",
        value: store.get('inReplies', false),
        onValueChange: function onValueChange(value) {
            return store.set('inReplies', value);
        }
    })));
}var dispose = function dispose() {};
function start() {
    if (!ensureModules('Show Me Your Name', {
        MessageRowData: MessageRowData,
        UserStore: UserStore
    })) return;
    dispose = applyFeatures('Show Me Your Name', [
        patchAuthorNames,
        function() {
            return whileEnabled(settings, 'inReplies', false, patchReplyNames);
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