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
}var SelectedChannelStore = window.unbound.metro.findStore('SelectedChannel', {
    lazy: true
});
var settings = window.unbound.storage.getStore('unbound.moyai');function SettingsPanel() {
    var store = settings.useSettingsStore();
    return /*#__PURE__*/ React.createElement(Page, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "General"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Play on reactions",
        subLabel: "Play the sound when someone reacts with Moyai.",
        value: store.get('allowReactions', true),
        onValueChange: function onValueChange(value) {
            return store.set('allowReactions', value);
        }
    })));
}var Sound = {
    url: 'https://raw.githubusercontent.com/MeguminSama/VencordPlugins/0814f506c4d7ca261644cc12eac996d4f2ee0155/plugins/moyai/moyai.mp3',
    id: 6969,
    fallbackDuration: 1000
};
var MESSAGE_PLAY_INTERVAL = 350;
var REACTION_DEDUPE_WINDOW = 500;/**
 * @description Counts the Moyai emoji in a message, Unicode and custom (static or animated) alike.
 * @param content The message content.
 * @returns How many Moyai the message contains.
 */ function countMoyai(content) {
    var _ref;
    var _content_match;
    return (_ref = (_content_match = content.match(/🗿|<a?:.*?moy?ai.*?:\d+>/gi)) === null || _content_match === void 0 ? void 0 : _content_match.length) !== null && _ref !== void 0 ? _ref : 0;
}
/**
 * @description Checks whether a reaction's emoji name is a Moyai.
 * @param name The reaction emoji's name.
 * @returns `true` for the Unicode Moyai or a custom emoji named like one.
 */ function isMoyaiReaction(name) {
    return name === '🗿' || /moy?ai/i.test(name);
}/**
 * @description Plays the sound once per Moyai in each message received in the selected channel.
 * @param player The plugin's sound player.
 * @returns A function that unsubscribes and cancels queued plays.
 */ function subscribeMessages(player) {
    var queued = new Set();
    function onMessageCreate(param) {
        var _loop = function(i, count) {
            var timer = setTimeout(function() {
                queued.delete(timer);
                void player.play();
            }, i * MESSAGE_PLAY_INTERVAL);
            queued.add(timer);
        };
        var channelId = param.channelId, channel_id = param.channel_id, message = param.message;
        var _ref;
        // A message with a `state` is the user's own pending send, not a received one.
        if (!(message === null || message === void 0 ? void 0 : message.content) || message.state) return;
        var channel = (_ref = channelId !== null && channelId !== void 0 ? channelId : channel_id) !== null && _ref !== void 0 ? _ref : message.channel_id;
        if (channel !== SelectedChannelStore.getChannelId()) return;
        for(var i = 0, count = countMoyai(message.content); i < count; i++)_loop(i);
    }
    window.unbound.metro.common.Dispatcher.subscribe('MESSAGE_CREATE', onMessageCreate);
    return function() {
        window.unbound.metro.common.Dispatcher.unsubscribe('MESSAGE_CREATE', onMessageCreate);
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = queued[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var timer = _step.value;
                clearTimeout(timer);
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
        queued.clear();
    };
}/**
 * @description Plays the sound when a Moyai reaction lands in the selected channel, once per message and emoji.
 * @param player The plugin's sound player.
 * @returns A function that unsubscribes and forgets recent reactions.
 */ function subscribeReactions(player) {
    var recent = new Map();
    function onReactionAdd(param) {
        var channelId = param.channelId, channel_id = param.channel_id, messageId = param.messageId, message_id = param.message_id, emoji = param.emoji;
        var name = emoji === null || emoji === void 0 ? void 0 : emoji.name;
        if (!name || !isMoyaiReaction(name)) return;
        if ((channelId !== null && channelId !== void 0 ? channelId : channel_id) !== SelectedChannelStore.getChannelId()) return;
        var key = "".concat(messageId !== null && messageId !== void 0 ? messageId : message_id, ":").concat(name);
        if (recent.has(key)) return;
        recent.set(key, setTimeout(function() {
            return recent.delete(key);
        }, REACTION_DEDUPE_WINDOW));
        void player.play();
    }
    window.unbound.metro.common.Dispatcher.subscribe('MESSAGE_REACTION_ADD', onReactionAdd);
    return function() {
        window.unbound.metro.common.Dispatcher.unsubscribe('MESSAGE_REACTION_ADD', onReactionAdd);
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = recent.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var timer = _step.value;
                clearTimeout(timer);
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
        recent.clear();
    };
}function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
    }
    if (info.done) resolve(value);
    else Promise.resolve(value).then(_next, _throw);
}
function _async_to_generator(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _ts_generator(thisArg, body) {
    var f, y, t, _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype), d = Object.defineProperty;
    return d(g, "next", {
        value: verb(0)
    }), d(g, "throw", {
        value: verb(1)
    }), d(g, "return", {
        value: verb(2)
    }), typeof Symbol === "function" && d(g, Symbol.iterator, {
        value: function() {
            return this;
        }
    }), g;
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(g && (g = 0, op[0] && (_ = 0)), _)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
}
/**
 * @description Reads a prepared sound's length, which Discord's iOS sound manager reports in seconds and its Android one in milliseconds.
 * @param duration The reported duration.
 * @param platform The platform that reported it.
 * @returns The length in milliseconds, or `null` when the duration is not usable.
 */ function soundDuration(duration, platform) {
    if (duration === undefined || !Number.isFinite(duration) || duration <= 0) return null;
    return platform === 'android' ? duration : duration * 1000;
}
/**
 * @description Prepares the Moyai sound with Discord's native sound manager and plays it on demand.
 * @param manager Discord's `DCDSoundManager` native module.
 * @param platform The platform the manager runs on, which decides the unit it reports durations in.
 * @returns `play` restarts the sound, `dispose` stops it and cancels pending work.
 */ function createPlayer(manager, platform) {
    var duration = null;
    var preparing = false;
    var disposed = false;
    var playing = false;
    var sequence = 0;
    var stopTimer;
    function release() {
        try {
            var _manager_release;
            (_manager_release = manager.release) === null || _manager_release === void 0 ? void 0 : _manager_release.call(manager, Sound.id);
        } catch (error) {
            console.error('[Moyai] Failed to release the sound:', error);
        }
    }
    function prepare() {
        if (preparing || duration !== null) return;
        preparing = true;
        try {
            manager.prepare(Sound.url, 'media', Sound.id, function(error, metadata) {
                var _soundDuration;
                preparing = false;
                if (disposed) {
                    if (!error) release();
                    return;
                }
                if (error) {
                    console.error('[Moyai] Failed to prepare the sound:', error);
                    return;
                }
                duration = (_soundDuration = soundDuration(metadata === null || metadata === void 0 ? void 0 : metadata.duration, platform)) !== null && _soundDuration !== void 0 ? _soundDuration : Sound.fallbackDuration;
            });
        } catch (error) {
            preparing = false;
            console.error('[Moyai] Failed to prepare the sound:', error);
        }
    }
    function play() {
        return _async_to_generator(function() {
            var current, error;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (disposed) return [
                            2
                        ];
                        // The first match after a failed or pending preparation retries it instead of playing.
                        if (duration === null) {
                            prepare();
                            return [
                                2
                            ];
                        }
                        current = ++sequence;
                        clearTimeout(stopTimer);
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            3,
                            ,
                            4
                        ]);
                        if (playing) manager.stop(Sound.id);
                        playing = true;
                        return [
                            4,
                            manager.play(Sound.id)
                        ];
                    case 2:
                        _state.sent();
                        return [
                            3,
                            4
                        ];
                    case 3:
                        error = _state.sent();
                        if (current === sequence) playing = false;
                        console.error('[Moyai] Failed to play the sound:', error);
                        return [
                            2
                        ];
                    case 4:
                        if (disposed || current !== sequence) return [
                            2
                        ];
                        stopTimer = setTimeout(function() {
                            playing = false;
                            manager.stop(Sound.id);
                        }, duration);
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function dispose() {
        disposed = true;
        sequence++;
        clearTimeout(stopTimer);
        if (playing) manager.stop(Sound.id);
        playing = false;
        if (duration !== null) release();
        duration = null;
    }
    prepare();
    return {
        play: play,
        dispose: dispose
    };
}var dispose = function dispose() {};
function start(context) {
    var DCDSoundManager = window.unbound.native.getNativeModule('DCDSoundManager');
    if (!ensureModules('Moyai', {
        DCDSoundManager: DCDSoundManager,
        SelectedChannelStore: SelectedChannelStore
    })) return;
    var player = createPlayer(DCDSoundManager, context.platform);
    dispose = applyFeatures('Moyai', [
        function() {
            return player.dispose;
        },
        function() {
            return subscribeMessages(player);
        },
        function() {
            return whileEnabled(settings, 'allowReactions', true, function() {
                return subscribeReactions(player);
            });
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