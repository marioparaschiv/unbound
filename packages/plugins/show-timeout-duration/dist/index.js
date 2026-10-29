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
}var MessageRowData = window.unbound.metro.findByProps('generateMessageRowData', {
    lazy: true
});
var GuildMemberStore = window.unbound.metro.findStore('GuildMember', {
    lazy: true
});
var ChannelStore = window.unbound.metro.findStore('Channel', {
    lazy: true
});
var Patcher = window.unbound.patcher.createPatcher('unbound.show-timeout-duration');/**
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
 * @description Formats the time left until a deadline as its two largest units, such as `2d 3h` or `5m`.
 * @param deadline The deadline in milliseconds.
 * @param now The current time in milliseconds.
 * @returns The remaining time, rounded up to whole minutes and never below `1m`.
 */ function formatRemaining(deadline) {
    var now = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : Date.now();
    var totalMinutes = Math.max(1, Math.ceil((deadline - now) / 60000));
    var days = Math.floor(totalMinutes / 1440);
    var hours = Math.floor(totalMinutes % 1440 / 60);
    var minutes = totalMinutes % 60;
    if (days > 0) return hours > 0 ? "".concat(days, "d ").concat(hours, "h") : "".concat(days, "d");
    if (hours > 0) return minutes > 0 ? "".concat(hours, "h ").concat(minutes, "m") : "".concat(hours, "h");
    return "".concat(minutes, "m");
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
function getDeadline(param) {
    var channel_id = param.channel_id, author = param.author;
    var _ChannelStore_getChannel, _GuildMemberStore_getMember;
    var guildId = channel_id ? (_ChannelStore_getChannel = ChannelStore.getChannel(channel_id)) === null || _ChannelStore_getChannel === void 0 ? void 0 : _ChannelStore_getChannel.guild_id : undefined;
    if (!guildId || !(author === null || author === void 0 ? void 0 : author.id)) return null;
    return getTimeoutDeadline((_GuildMemberStore_getMember = GuildMemberStore.getMember(guildId, author.id)) === null || _GuildMemberStore_getMember === void 0 ? void 0 : _GuildMemberStore_getMember.communicationDisabledUntil);
}
/**
 * @description Appends the time left on the author's timeout to the timestamp of their messages.
 * @returns A function that removes the patch and stops refreshing the countdown.
 */ function patchTimeoutDurations() {
    var timedOut = new Map();
    var unpatch = Patcher.after(MessageRowData, 'generateMessageRowData', function(param) {
        var args = param.args, result = param.result;
        var _args_;
        var message = (_args_ = args[0]) === null || _args_ === void 0 ? void 0 : _args_.message;
        if (!(message === null || message === void 0 ? void 0 : message.id)) return;
        var deadline = getDeadline(message);
        if (!deadline) {
            timedOut.delete(message.id);
            return;
        }
        timedOut.set(message.id, message);
        var row = result === null || result === void 0 ? void 0 : result.message;
        if (typeof (row === null || row === void 0 ? void 0 : row.timestamp) !== 'string' || row.timestamp.includes('timeout remaining')) return;
        var remaining = formatRemaining(deadline);
        row.timestamp = "".concat(row.timestamp, " • ").concat(remaining, " timeout remaining");
        if (typeof row.timestampAccessibilityLabel === 'string') {
            row.timestampAccessibilityLabel = "".concat(row.timestampAccessibilityLabel, " • Timeout expires in ").concat(remaining);
        }
    });
    // Rows are only regenerated on an update, so re-dispatch each timed-out message to tick its countdown.
    var refresh = setInterval(function() {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = timedOut.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var message = _step.value;
                window.unbound.metro.common.Dispatcher.dispatch({
                    type: 'MESSAGE_UPDATE',
                    message: _object_spread({}, message),
                    log_edit: false
                });
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
    }, 30000);
    return function() {
        clearInterval(refresh);
        unpatch();
        timedOut.clear();
    };
}var dispose = function dispose() {};
function start() {
    if (!ensureModules('Show Timeout Duration', {
        MessageRowData: MessageRowData,
        GuildMemberStore: GuildMemberStore,
        ChannelStore: ChannelStore
    })) {
        return;
    }
    dispose = applyFeatures('Show Timeout Duration', [
        patchTimeoutDurations
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