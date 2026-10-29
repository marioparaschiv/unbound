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
}var MessageActions = window.unbound.metro.api.Messages;
var ReplyActions = window.unbound.metro.findByProps('deletePendingReply', {
    lazy: true
});
var PendingReplyStore = window.unbound.metro.findByProps('getPendingReply', {
    lazy: true
});
var ChatInputRegistry = window.unbound.metro.findByProps('getBestActiveInputForChannelId', {
    lazy: true
});
var Patcher = window.unbound.patcher.createPatcher('unbound.gif-paste');function _array_like_to_array(arr, len) {
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
function isGifSelection(args) {
    var _args = _sliced_to_array(args, 4), channelId = _args[0], message = _args[1], metadata = _args[3];
    return typeof channelId === 'string' && typeof (message === null || message === void 0 ? void 0 : message.content) === 'string' && (metadata === null || metadata === void 0 ? void 0 : metadata.location) === 'gif_reply';
}
/**
 * @description Pastes a GIF picker selection into the chat input instead of sending it.
 * @param keptReplies Marks the channel's pending reply so the picker's clear right after does not drop it.
 * @returns A function that removes the patch.
 */ function patchMessageActions(keptReplies) {
    return Patcher.instead(MessageActions, 'sendMessage', function(param) {
        var args = param.args, original = param.original, self = param.this;
        var _ChatInputRegistry_getBestActiveInputForChannelId, _input_closeCustomKeyboard;
        if (!isGifSelection(args)) return original.apply(self, args);
        var _args = _sliced_to_array(args, 2), channelId = _args[0], message = _args[1];
        var input = (_ChatInputRegistry_getBestActiveInputForChannelId = ChatInputRegistry.getBestActiveInputForChannelId) === null || _ChatInputRegistry_getBestActiveInputForChannelId === void 0 ? void 0 : _ChatInputRegistry_getBestActiveInputForChannelId.call(ChatInputRegistry, channelId);
        if (typeof (input === null || input === void 0 ? void 0 : input.insertText) !== 'function') return original.apply(self, args);
        input.insertText("".concat(message.content, " "));
        (_input_closeCustomKeyboard = input.closeCustomKeyboard) === null || _input_closeCustomKeyboard === void 0 ? void 0 : _input_closeCustomKeyboard.call(input);
        if (PendingReplyStore.getPendingReply(channelId)) keptReplies.keep(channelId);
    });
}/**
 * @description Skips clearing a pending reply that `keptReplies` marked during a GIF paste.
 * @param keptReplies The channels whose next reply clear is skipped.
 * @returns A function that removes the patch.
 */ function patchReplyActions(keptReplies) {
    return Patcher.instead(ReplyActions, 'deletePendingReply', function(param) {
        var args = param.args, original = param.original, self = param.this;
        if (keptReplies.release(args[0])) return;
        return original.apply(self, args);
    });
}/**
 * @description Tracks channels whose pending reply must survive the GIF picker clearing it right after a selection.
 * @returns `keep` marks a channel until the current task ends, `release` consumes the mark.
 */ function createKeptReplies() {
    var channels = new Set();
    function keep(channelId) {
        channels.add(channelId);
        // The picker clears the reply synchronously after selecting, so the mark only needs to outlive this task.
        void Promise.resolve().then(function() {
            return channels.delete(channelId);
        });
    }
    function release(channelId) {
        return channels.delete(channelId);
    }
    return {
        keep: keep,
        release: release
    };
}var dispose = function dispose() {};
function start() {
    if (!ensureModules('GIF Paste', {
        MessageActions: MessageActions,
        ReplyActions: ReplyActions,
        PendingReplyStore: PendingReplyStore
    })) return;
    var keptReplies = createKeptReplies();
    dispose = applyFeatures('GIF Paste', [
        function() {
            return patchReplyActions(keptReplies);
        },
        function() {
            return patchMessageActions(keptReplies);
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