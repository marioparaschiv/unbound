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
}var MessageRowData = window.unbound.metro.findByProps('generateMessageRowData', {
    lazy: true
});
var InvitePermissions = window.unbound.metro.findByProps('useInvitesDisabledPermission', {
    lazy: true
});
var GuildMemberStore = window.unbound.metro.findStore('GuildMember', {
    lazy: true
});
var ChannelStore = window.unbound.metro.findStore('Channel', {
    lazy: true
});
var settings = window.unbound.storage.getStore('unbound.show-hidden-things');
var Patcher = window.unbound.patcher.createPatcher('unbound.show-hidden-things');/**
 * @description Shows the Pause Invites setting in Server Settings to every member, not only to moderators.
 * @returns A function that removes the patch.
 */ function patchInvitePermissions() {
    if (!ensureModules('Show Hidden Things: paused invites', {
        InvitePermissions: InvitePermissions
    })) {
        return function() {};
    }
    return Patcher.after(InvitePermissions, 'useInvitesDisabledPermission', function() {
        return true;
    });
}/**
 * @description Reads when a member's timeout ends, if it has not ended yet.
 * @param until The member's `communicationDisabledUntil`.
 * @param now The current time in milliseconds.
 * @returns The end of the timeout in milliseconds, or `null` when the member is not timed out.
 */ function getTimeoutDeadline(until) {
    var now = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : Date.now();
    if (!until) return null;
    var deadline = new Date(until).getTime();
    return deadline > now ? deadline : null;
}/**
 * @description Shows the timeout icon next to timed-out members in chat.
 * @returns A function that removes the patch.
 */ function patchTimeoutIcons() {
    if (!ensureModules('Show Hidden Things: timeout icons', {
        MessageRowData: MessageRowData,
        GuildMemberStore: GuildMemberStore,
        ChannelStore: ChannelStore
    })) {
        return function() {};
    }
    return Patcher.after(MessageRowData, 'generateMessageRowData', function(param) {
        var args = param.args, result = param.result;
        var _ref, _message_guild_id, _message_channel_id, _ref1, _ref2;
        var _args_, _ChannelStore_getChannel, _message_author;
        var row = result === null || result === void 0 ? void 0 : result.message;
        var message = (_args_ = args[0]) === null || _args_ === void 0 ? void 0 : _args_.message;
        if (!row || !message) return;
        var guildId = (_ref = (_message_guild_id = message.guild_id) !== null && _message_guild_id !== void 0 ? _message_guild_id : message.guildId) !== null && _ref !== void 0 ? _ref : (_ChannelStore_getChannel = ChannelStore.getChannel((_message_channel_id = message.channel_id) !== null && _message_channel_id !== void 0 ? _message_channel_id : message.channelId)) === null || _ChannelStore_getChannel === void 0 ? void 0 : _ChannelStore_getChannel.guild_id;
        var userId = (_ref1 = (_ref2 = (_message_author = message.author) === null || _message_author === void 0 ? void 0 : _message_author.id) !== null && _ref2 !== void 0 ? _ref2 : message.authorId) !== null && _ref1 !== void 0 ? _ref1 : row.authorId;
        if (!guildId || !userId) return;
        var member = GuildMemberStore.getMember(guildId, userId);
        if (getTimeoutDeadline(member === null || member === void 0 ? void 0 : member.communicationDisabledUntil)) row.communicationDisabled = true;
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
    return /*#__PURE__*/ React.createElement(Page, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "Visibility"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Show Timeout Icons",
        subLabel: "Show member timeout icons in chat",
        value: store.get('showTimeouts', true),
        onValueChange: function onValueChange(value) {
            return store.set('showTimeouts', value);
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Show Paused Invites",
        subLabel: "Show the Pause Invites setting in Server Settings to everyone",
        value: store.get('showInvitesPaused', true),
        onValueChange: function onValueChange(value) {
            return store.set('showInvitesPaused', value);
        }
    })));
}var dispose = function dispose() {};
function start() {
    dispose = applyFeatures('Show Hidden Things', [
        function() {
            return whileEnabled(settings, 'showTimeouts', true, patchTimeoutIcons);
        },
        function() {
            return whileEnabled(settings, 'showInvitesPaused', true, patchInvitePermissions);
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