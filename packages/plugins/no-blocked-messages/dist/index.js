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
}var ChatManager = window.unbound.metro.findByName('ChatManager', {
    lazy: true
});
var RowManager = window.unbound.metro.findByName('RowManager', {
    lazy: true
});
var ChatUpdatesQueue = window.unbound.metro.findByName('ChatUpdatesQueue', {
    lazy: true
});
var Patcher = window.unbound.patcher.createPatcher('unbound.no-blocked-messages');var _globalThis, ___unboundNoBlockedMessagesRuntime;
// Unbound evaluates the bundle again on each start; keeping the chat on `globalThis` lets a restart refresh it.
var chat = (___unboundNoBlockedMessagesRuntime = (_globalThis = globalThis).__unboundNoBlockedMessagesRuntime) !== null && ___unboundNoBlockedMessagesRuntime !== void 0 ? ___unboundNoBlockedMessagesRuntime : _globalThis.__unboundNoBlockedMessagesRuntime = {
    chatManager: null,
    rowManager: null,
    messages: null,
    updatesQueue: null
};
/**
 * @description Rebuilds every row of the open chat, so hiding or showing blocked messages applies without reopening it.
 */ function refreshChat() {
    var chatManager = chat.chatManager, rowManager = chat.rowManager, messages = chat.messages, updatesQueue = chat.updatesQueue;
    if (!chatManager || !rowManager || !messages || !updatesQueue) return;
    chatManager.setup(messages);
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = messages[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var message = _step.value;
            chatManager.createRow(rowManager.generate(message));
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
    updatesQueue.add(chatManager.createChangeset());
    updatesQueue.tryFlush();
}/**
 * @description Remembers the open chat's update queue so the chat can be refreshed.
 * @returns A function that removes the patch.
 */ function patchChatUpdatesQueue() {
    var _ChatUpdatesQueue_prototype;
    if (typeof ((_ChatUpdatesQueue_prototype = ChatUpdatesQueue.prototype) === null || _ChatUpdatesQueue_prototype === void 0 ? void 0 : _ChatUpdatesQueue_prototype.add) !== 'function') {
        console.error('[No Blocked Messages] Skipped, ChatUpdatesQueue.add not found.');
        return function() {};
    }
    return Patcher.before(ChatUpdatesQueue.prototype, 'add', function(param) {
        var self = param.this;
        chat.updatesQueue = self;
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
/**
 * @description Skips the rows that stand in for blocked messages, remembers the open chat, and refreshes it on apply and removal.
 * @returns A function that removes the patches and shows blocked messages in the open chat again.
 */ function patchChatManager() {
    var prototype = ChatManager.prototype;
    if (typeof (prototype === null || prototype === void 0 ? void 0 : prototype.setup) !== 'function' || typeof prototype.createRow !== 'function') {
        console.error('[No Blocked Messages] Skipped, ChatManager.createRow not found.');
        return function() {};
    }
    var unpatchSetup = Patcher.before(prototype, 'setup', function(param) {
        var args = param.args, self = param.this;
        chat.chatManager = self;
        chat.messages = args[0];
    });
    var unpatchCreateRow = Patcher.instead(prototype, 'createRow', function(param) {
        var args = param.args, original = param.original;
        var _args_;
        // Row type 2 stands in for a blocked message.
        if (((_args_ = args[0]) === null || _args_ === void 0 ? void 0 : _args_.type) === 2) return;
        return original.apply(void 0, _to_consumable_array(args));
    });
    refreshChat();
    return function() {
        unpatchCreateRow();
        refreshChat();
        unpatchSetup();
    };
}/**
 * @description Remembers the open chat's row manager so the chat can be refreshed.
 * @returns A function that removes the patch.
 */ function patchRowManager() {
    var _RowManager_prototype;
    if (typeof ((_RowManager_prototype = RowManager.prototype) === null || _RowManager_prototype === void 0 ? void 0 : _RowManager_prototype.generate) !== 'function') {
        console.error('[No Blocked Messages] Skipped, RowManager.generate not found.');
        return function() {};
    }
    return Patcher.before(RowManager.prototype, 'generate', function(param) {
        var self = param.this;
        chat.rowManager = self;
    });
}var dispose = function dispose() {};
function start() {
    if (!ensureModules('No Blocked Messages', {
        ChatManager: ChatManager,
        RowManager: RowManager,
        ChatUpdatesQueue: ChatUpdatesQueue
    })) {
        return;
    }
    // The chat manager patch refreshes the open chat, so the managers it reads are captured first.
    dispose = applyFeatures('No Blocked Messages', [
        patchRowManager,
        patchChatUpdatesQueue,
        patchChatManager
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