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
var Patcher = window.unbound.patcher.createPatcher('unbound.clear-urls');function _array_like_to_array(arr, len) {
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
function escape(text) {
    return text.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}
function paramPattern(param) {
    return new RegExp("^".concat(escape(param).replace('\\*', '.+?'), "$"));
}
function hostPattern(host) {
    var pattern = escape(host).replace(/^\\\*\\\./, '(.+?\\.)?').replace('\\*', '.+?');
    return new RegExp("^(www\\.)?".concat(pattern, "$"));
}
/**
 * @description Compiles rules written as `param` or `param@host`, where `*` matches any run of characters.
 * @param rules The rules, such as `utm_source`, `pd_rd_*@amazon.*` or `t@*.twitter.com`.
 * @returns Rules for every URL, and rules grouped by the host they apply to.
 */ function compileRules(rules) {
    var universal = [];
    var hosts = new Map();
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = rules[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var rule = _step.value;
            var _rule_split = _sliced_to_array(rule.split('@'), 2), param = _rule_split[0], host = _rule_split[1];
            var pattern = paramPattern(param);
            if (!host) {
                universal.push(pattern);
                continue;
            }
            var hostRule = hostPattern(host);
            var group = hosts.get(hostRule.source);
            if (group) {
                group.params.push(pattern);
            } else {
                hosts.set(hostRule.source, {
                    host: hostRule,
                    params: [
                        pattern
                    ]
                });
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
    return {
        universal: universal,
        hosts: _to_consumable_array(hosts.values())
    };
}
function parseUrl(text) {
    try {
        return new URL(text);
    } catch (unused) {
        return null;
    }
}
function removeParams(params, pattern) {
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        // Iterate a copy: deleting while iterating `params` skips the next entry.
        for(var _iterator = _to_consumable_array(params.keys())[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var param = _step.value;
            if (pattern.test(param)) params.delete(param);
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
function cleanUrl(text, rules) {
    var url = parseUrl(text);
    // A URL without a query is returned untouched, so it is not reformatted by `URL`.
    if (!url || url.searchParams.keys().next().done) return text;
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = rules.universal[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var pattern = _step.value;
            removeParams(url.searchParams, pattern);
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
        for(var _iterator1 = rules.hosts[Symbol.iterator](), _step1; !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
            var _step_value = _step1.value, host = _step_value.host, params = _step_value.params;
            if (!host.test(url.hostname)) continue;
            var _iteratorNormalCompletion2 = true, _didIteratorError2 = false, _iteratorError2 = undefined;
            try {
                for(var _iterator2 = params[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true){
                    var pattern1 = _step2.value;
                    removeParams(url.searchParams, pattern1);
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
    return url.toString();
}
/**
 * @description Removes tracking parameters from every link in a message.
 * @param content The message content.
 * @param rules Rules compiled with {@link compileRules}.
 * @returns The content with each link's tracking parameters removed.
 */ function cleanUrls(content, rules) {
    return content.replace(/https?:\/\/[^\s<]+[^<.,:;"'>)|\]\s]/g, function(url) {
        return cleanUrl(url, rules);
    });
}var DEFAULT_RULES = [
    'action_object_map',
    'action_type_map',
    'action_ref_map',
    'spm@*.aliexpress.com',
    'scm@*.aliexpress.com',
    'aff_platform',
    'aff_trace_key',
    'algo_expid@*.aliexpress.*',
    'algo_pvid@*.aliexpress.*',
    'btsid',
    'ws_ab_test',
    'pd_rd_*@amazon.*',
    '_encoding@amazon.*',
    'psc@amazon.*',
    'tag@amazon.*',
    'ref_@amazon.*',
    'pf_rd_*@amazon.*',
    'pf@amazon.*',
    'crid@amazon.*',
    'keywords@amazon.*',
    'sprefix@amazon.*',
    'sr@amazon.*',
    'ie@amazon.*',
    'node@amazon.*',
    'qid@amazon.*',
    'callback@bilibili.com',
    'cvid@bing.com',
    'form@bing.com',
    'sk@bing.com',
    'sp@bing.com',
    'sc@bing.com',
    'qs@bing.com',
    'pq@bing.com',
    'sc_cid',
    'mkt_tok',
    'trk',
    'trkCampaign',
    'ga_*',
    'gclid',
    'gclsrc',
    'hmb_campaign',
    'hmb_medium',
    'hmb_source',
    'spReportId',
    'spJobID',
    'spUserID',
    'spMailingID',
    'itm_*',
    's_cid',
    'elqTrackId',
    'elqTrack',
    'assetType',
    'assetId',
    'recipientId',
    'campaignId',
    'siteId',
    'mc_cid',
    'mc_eid',
    'pk_*',
    'sc_campaign',
    'sc_channel',
    'sc_content',
    'sc_medium',
    'sc_outcome',
    'sc_geo',
    'sc_country',
    'nr_email_referer',
    'vero_conv',
    'vero_id',
    'yclid',
    '_openstat',
    'mbid',
    'cmpid',
    'cid',
    'c_id',
    'campaign_id',
    'Campaign',
    'hash@ebay.*',
    'fb_action_ids',
    'fb_action_types',
    'fb_ref',
    'fb_source',
    'fbclid',
    'refsrc@facebook.com',
    'hrc@facebook.com',
    'gs_l',
    'gs_lcp@google.*',
    'ved@google.*',
    'ei@google.*',
    'sei@google.*',
    'gws_rd@google.*',
    'gs_gbg@google.*',
    'gs_mss@google.*',
    'gs_rn@google.*',
    '_hsenc',
    '_hsmi',
    '__hssc',
    '__hstc',
    'hsCtaTracking',
    'source@sourceforge.net',
    'position@sourceforge.net',
    't@*.twitter.com',
    's@*.twitter.com',
    'ref_*@*.twitter.com',
    'tt_medium',
    'tt_content',
    'lr@yandex.*',
    'redircnt@yandex.*',
    'feature@youtube.com',
    'kw@youtube.com',
    'si@youtu.be',
    'wt_zmc',
    'utm_source',
    'utm_content',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'si@open.spotify.com',
    'igsh',
    'igshid',
    'share_id@reddit.com'
];// UNKNOWN: a message action receives ids and option bags next to the draft.
function isDraft(arg) {
    return typeof (arg === null || arg === void 0 ? void 0 : arg.content) === 'string';
}
/**
 * @description Removes tracking parameters from links in messages as they are sent or edited.
 * @returns A function that removes the patches.
 */ function patchMessageActions() {
    var rules = compileRules(DEFAULT_RULES);
    var unpatches = [
        'sendMessage',
        'editMessage'
    ].filter(function(method) {
        return typeof MessageActions[method] === 'function';
    }).map(function(method) {
        return Patcher.before(MessageActions, method, function(param) {
            var args = param.args;
            var draft = args.find(isDraft);
            if (draft) draft.content = cleanUrls(draft.content, rules);
        });
    });
    return function() {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = unpatches[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
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
    if (!ensureModules('Clear URLs', {
        MessageActions: MessageActions
    })) return;
    dispose = applyFeatures('Clear URLs', [
        patchMessageActions
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