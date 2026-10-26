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
}var UserProfileCard = window.unbound.metro.findByFilePath('modules/user_profile/native/UserProfileCard.tsx', {
    interop: false,
    lazy: true
});
var UserProfileCardByName = window.unbound.metro.findByName('UserProfileCard', {
    interop: false,
    lazy: true
});
// The same module as `metro.common.Theme`, which its typings do not declare yet.
var Theme = window.unbound.metro.findByProps('colors', 'internal', {
    lazy: true
});
var RelationshipStore = window.unbound.metro.findStore('Relationship', {
    lazy: true
});
var settings = window.unbound.storage.getStore('unbound.reviewdb');
var Patcher = window.unbound.patcher.createPatcher('unbound.reviewdb');function _define_property$3(obj, key, value) {
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
function _object_spread$3(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property$3(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys$3(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props$3(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    else {
        ownKeys$3(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
}
/**
 * @description Opens a component as a Discord action sheet that can close itself.
 * @template P The sheet's own props.
 * @param key A key unique to this sheet.
 * @param Sheet The sheet component, which also receives `onClose`.
 * @param props The sheet's own props.
 */ function openSheet(key, Sheet, props) {
    var ActionSheets = window.unbound.metro.api.ActionSheets;
    ActionSheets.openLazy(Promise.resolve({
        default: Sheet
    }), key, _object_spread_props$3(_object_spread$3({}, props), {
        onClose: function onClose() {
            return ActionSheets.hideActionSheet(key);
        }
    }));
}var API_URL = 'https://manti.vendicated.dev/api/reviewdb';
var AUTH_REDIRECT_URI = "".concat(API_URL, "/auth");
var COMMENT_MAX_LENGTH = 1000;
var COMMENT_PREVIEW_LENGTH = 200;function _define_property$2(obj, key, value) {
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
function _object_spread$2(target) {
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
function ownKeys$2(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props$2(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    else {
        ownKeys$2(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
}
/**
 * @description Works out the viewer's new vote and the score change when they press a vote arrow.
 * @param current The viewer's vote before the press.
 * @param isUpvote Whether the up arrow was pressed.
 * @returns The new vote, which is `null` when pressing the same arrow again, and the score delta.
 */ function changeVote(current, isUpvote) {
    var step = isUpvote ? 1 : -1;
    if (current === isUpvote) return {
        vote: null,
        delta: -step
    };
    return {
        vote: isUpvote,
        delta: current === null ? step : step * 2
    };
}
/**
 * @description Marks each review with the viewer's vote on it.
 * @param reviews The reviews to mark.
 * @param votes The viewer's votes on the profile's reviews.
 * @returns The reviews with `userVote` set, `null` where the viewer has not voted; unchanged when there are no votes.
 */ function withVotes(reviews, votes) {
    if (!votes.length) return reviews;
    var voteByReview = new Map(votes.map(function(vote) {
        return [
            vote.reviewID,
            vote.isUpvote
        ];
    }));
    return reviews.map(function(review) {
        var _voteByReview_get;
        return _object_spread_props$2(_object_spread$2({}, review), {
            userVote: (_voteByReview_get = voteByReview.get(review.id)) !== null && _voteByReview_get !== void 0 ? _voteByReview_get : null
        });
    });
}function _array_like_to_array$7(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$1(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$7(arr);
}
function asyncGeneratorStep$6(gen, resolve, reject, _next, _throw, key, arg) {
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
function _async_to_generator$6(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$6(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$6(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
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
function _iterable_to_array$1(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$1() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
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
function _to_consumable_array$1(arr) {
    return _array_without_holes$1(arr) || _iterable_to_array$1(arr) || _unsupported_iterable_to_array$7(arr) || _non_iterable_spread$1();
}
function _ts_generator$6(thisArg, body) {
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
function _unsupported_iterable_to_array$7(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$7(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$7(o, minLen);
}
var currentUser = null;
function getToken() {
    return settings.get('token', '');
}
function showToast(content) {
    window.unbound.toasts.showToast({
        title: 'ReviewDB',
        content: content
    });
}
/**
 * @description Returns the signed-in ReviewDB account, once `fetchCurrentUser` has fetched it.
 * @returns The account, or `null` before sign-in or the first fetch.
 */ function getCurrentUser() {
    return currentUser;
}
// Resolves to the parsed body, or `null` after toasting a network or server failure.
function request(path) {
    var method = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 'GET', body = arguments.length > 2 ? arguments[2] : void 0;
    return _async_to_generator$6(function() {
        var headers, response, data;
        return _ts_generator$6(this, function(_state) {
            switch(_state.label){
                case 0:
                    headers = {
                        Accept: 'application/json',
                        Authorization: getToken()
                    };
                    if (body) {
                        headers['Content-Type'] = 'application/json';
                    }
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        3,
                        ,
                        4
                    ]);
                    return [
                        4,
                        fetch("".concat(API_URL).concat(path), {
                            method: method,
                            headers: headers,
                            body: body && JSON.stringify(body)
                        })
                    ];
                case 2:
                    response = _state.sent();
                    return [
                        3,
                        4
                    ];
                case 3:
                    _state.sent();
                    showToast('Network error: Failed to connect to ReviewDB.');
                    return [
                        2,
                        null
                    ];
                case 4:
                    return [
                        4,
                        response.json().catch(function() {
                            return null;
                        })
                    ];
                case 5:
                    data = _state.sent();
                    if (!response.ok) {
                        showToast(typeof (data === null || data === void 0 ? void 0 : data.message) === 'string' ? data.message : "ReviewDB: Request failed with status ".concat(response.status));
                        return [
                            2,
                            null
                        ];
                    }
                    return [
                        2,
                        data
                    ];
            }
        });
    })();
}
function noReviews() {
    return {
        message: '',
        reviews: [],
        hasNextPage: false,
        reviewCount: 0
    };
}
function getReviewVotes(userId) {
    return _async_to_generator$6(function() {
        var _ref, data;
        return _ts_generator$6(this, function(_state) {
            switch(_state.label){
                case 0:
                    if (!getToken()) return [
                        2,
                        []
                    ];
                    return [
                        4,
                        request("/users/".concat(userId, "/reviews/votes"))
                    ];
                case 1:
                    data = _state.sent();
                    return [
                        2,
                        (_ref = data === null || data === void 0 ? void 0 : data.votes) !== null && _ref !== void 0 ? _ref : []
                    ];
            }
        });
    })();
}
/**
 * @description Fetches a page of reviews on a profile, marked with the viewer's votes.
 * @param userId The Discord ID of the profile.
 * @param offset How many reviews to skip.
 * @returns The page, or an empty page after toasting the failure.
 */ function getReviews(userId, offset) {
    return _async_to_generator$6(function() {
        var votes, params, response, data, _tmp, _tmp1, _tmp2;
        return _ts_generator$6(this, function(_state) {
            switch(_state.label){
                case 0:
                    votes = getReviewVotes(userId);
                    params = new URLSearchParams();
                    if (offset) {
                        params.append('offset', String(offset));
                    }
                    params.append('limit', '50');
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        3,
                        ,
                        4
                    ]);
                    return [
                        4,
                        fetch("".concat(API_URL, "/users/").concat(userId, "/reviews?").concat(params.toString()))
                    ];
                case 2:
                    response = _state.sent();
                    return [
                        3,
                        4
                    ];
                case 3:
                    _state.sent();
                    showToast('Network error: Failed to connect to ReviewDB.');
                    return [
                        2,
                        noReviews()
                    ];
                case 4:
                    if (!response.ok) {
                        showToast(response.status === 429 ? 'You are sending requests too fast. Wait a few seconds and try again.' : 'An error occurred while fetching reviews. Please try again later.');
                        return [
                            2,
                            noReviews()
                        ];
                    }
                    return [
                        4,
                        response.json()
                    ];
                case 5:
                    data = _state.sent();
                    _tmp = [
                        _object_spread$1({}, data)
                    ];
                    _tmp1 = {};
                    _tmp2 = [
                        data.reviews
                    ];
                    return [
                        4,
                        votes
                    ];
                case 6:
                    return [
                        2,
                        _object_spread_props$1.apply(void 0, _tmp.concat([
                            (_tmp1.reviews = withVotes.apply(void 0, _tmp2.concat([
                                _state.sent()
                            ])), _tmp1)
                        ]))
                    ];
            }
        });
    })();
}
/**
 * @description Posts the viewer's review on a profile, replacing their earlier one.
 * @param userId The Discord ID of the profile.
 * @param comment The review text.
 * @returns The server's response, or `null` when the review was not posted.
 */ function addReview(userId, comment) {
    return _async_to_generator$6(function() {
        var data;
        return _ts_generator$6(this, function(_state) {
            switch(_state.label){
                case 0:
                    if (!getToken()) {
                        showToast('Please authorize to add a review.');
                        return [
                            2,
                            null
                        ];
                    }
                    return [
                        4,
                        request("/users/".concat(userId, "/reviews"), 'PUT', {
                            userid: userId,
                            comment: comment
                        })
                    ];
                case 1:
                    data = _state.sent();
                    if (data === null || data === void 0 ? void 0 : data.message) {
                        showToast(data.message);
                    }
                    return [
                        2,
                        data
                    ];
            }
        });
    })();
}
/**
 * @description Deletes a review.
 * @param reviewId The review's ID.
 * @returns The server's response, or `null` when the review was not deleted.
 */ function deleteReview(reviewId) {
    return _async_to_generator$6(function() {
        var data;
        return _ts_generator$6(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        request("/users/".concat(reviewId, "/reviews"), 'DELETE', {
                            reviewid: reviewId
                        })
                    ];
                case 1:
                    data = _state.sent();
                    if (data === null || data === void 0 ? void 0 : data.message) {
                        showToast(data.message);
                    }
                    return [
                        2,
                        data
                    ];
            }
        });
    })();
}
/**
 * @description Reports a review to ReviewDB's moderators.
 * @param reviewId The review's ID.
 */ function reportReview(reviewId) {
    return _async_to_generator$6(function() {
        var data;
        return _ts_generator$6(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        request('/reports', 'PUT', {
                            reviewid: reviewId
                        })
                    ];
                case 1:
                    data = _state.sent();
                    if (data === null || data === void 0 ? void 0 : data.message) {
                        showToast(data.message);
                    }
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Sets or clears the viewer's vote on a review.
 * @param reviewId The review's ID.
 * @param vote `true` to upvote, `false` to downvote, `null` to remove the vote.
 * @returns Whether ReviewDB accepted the change.
 */ function setReviewVote(reviewId, vote) {
    return _async_to_generator$6(function() {
        var data, _tmp;
        return _ts_generator$6(this, function(_state) {
            switch(_state.label){
                case 0:
                    if (!getToken()) {
                        showToast('Please authorize to vote on reviews.');
                        return [
                            2,
                            false
                        ];
                    }
                    if (!(vote === null)) return [
                        3,
                        2
                    ];
                    return [
                        4,
                        request("/reviews/".concat(reviewId, "/vote"), 'DELETE')
                    ];
                case 1:
                    _tmp = _state.sent();
                    return [
                        3,
                        4
                    ];
                case 2:
                    return [
                        4,
                        request("/reviews/".concat(reviewId, "/vote"), 'POST', {
                            isUpvote: vote
                        })
                    ];
                case 3:
                    _tmp = _state.sent();
                    _state.label = 4;
                case 4:
                    data = _tmp;
                    return [
                        2,
                        data != null
                    ];
            }
        });
    })();
}
/**
 * @description Blocks or unblocks a user from reviewing the viewer's profile.
 * @param userId The Discord ID of the user.
 * @param blocked Whether to block or unblock them.
 */ function setUserBlocked(userId, blocked) {
    return _async_to_generator$6(function() {
        var action, data;
        return _ts_generator$6(this, function(_state) {
            switch(_state.label){
                case 0:
                    action = blocked ? 'block' : 'unblock';
                    return [
                        4,
                        request('/blocks', 'PATCH', {
                            action: action,
                            discordId: userId
                        })
                    ];
                case 1:
                    data = _state.sent();
                    if (!data) return [
                        2
                    ];
                    showToast("Successfully ".concat(action, "ed user"));
                    if (!(currentUser === null || currentUser === void 0 ? void 0 : currentUser.blockedUsers)) return [
                        2
                    ];
                    currentUser = _object_spread_props$1(_object_spread$1({}, currentUser), {
                        blockedUsers: blocked ? _to_consumable_array$1(currentUser.blockedUsers).concat([
                            userId
                        ]) : currentUser.blockedUsers.filter(function(id) {
                            return id !== userId;
                        })
                    });
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Fetches the users the viewer has blocked from reviewing their profile.
 * @returns The blocked users, or an empty list on failure.
 */ function getBlockedUsers() {
    return _async_to_generator$6(function() {
        var _ref;
        return _ts_generator$6(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        request('/blocks')
                    ];
                case 1:
                    return [
                        2,
                        (_ref = _state.sent()) !== null && _ref !== void 0 ? _ref : []
                    ];
            }
        });
    })();
}
/**
 * @description Fetches the signed-in ReviewDB account and caches it for the session.
 * @returns The account, or `null` when the user has not authorized or the request failed.
 */ function fetchCurrentUser() {
    return _async_to_generator$6(function() {
        var user;
        return _ts_generator$6(this, function(_state) {
            switch(_state.label){
                case 0:
                    if (!getToken()) return [
                        2,
                        null
                    ];
                    return [
                        4,
                        request('/users', 'POST')
                    ];
                case 1:
                    user = _state.sent();
                    if (user) {
                        currentUser = user;
                    }
                    return [
                        2,
                        user
                    ];
            }
        });
    })();
}function _array_like_to_array$6(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$6(arr) {
    if (Array.isArray(arr)) return arr;
}
function asyncGeneratorStep$5(gen, resolve, reject, _next, _throw, key, arg) {
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
function _async_to_generator$5(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$5(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$5(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _iterable_to_array_limit$6(arr, i) {
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
function _non_iterable_rest$6() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$6(arr, i) {
    return _array_with_holes$6(arr) || _iterable_to_array_limit$6(arr, i) || _unsupported_iterable_to_array$6(arr, i) || _non_iterable_rest$6();
}
function _ts_generator$5(thisArg, body) {
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
function _unsupported_iterable_to_array$6(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$6(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$6(o, minLen);
}
function ReviewComposer(param) {
    var discordId = param.discordId, name = param.name, isUpdate = param.isUpdate, colors = param.colors, onSubmitted = param.onSubmitted;
    var _useState = _sliced_to_array$6(window.React.useState(''), 2), comment = _useState[0], setComment = _useState[1];
    var _useState1 = _sliced_to_array$6(window.React.useState(false), 2), submitting = _useState1[0], setSubmitting = _useState1[1];
    var trimmed = comment.trim();
    var disabled = !trimmed || submitting;
    function submit() {
        return _async_to_generator$5(function() {
            return _ts_generator$5(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (!trimmed) return [
                            2
                        ];
                        setSubmitting(true);
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            ,
                            3,
                            4
                        ]);
                        return [
                            4,
                            addReview(discordId, trimmed)
                        ];
                    case 2:
                        if (_state.sent()) {
                            setComment('');
                            onSubmitted();
                        }
                        return [
                            3,
                            4
                        ];
                    case 3:
                        setSubmitting(false);
                        return [
                            7
                        ];
                    case 4:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: 16,
            borderWidth: 1,
            gap: 10,
            padding: 14
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            gap: 4
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: colors.text,
            fontSize: 17,
            fontWeight: '800'
        }
    }, isUpdate ? 'Update your review' : 'Leave a review'), /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: colors.muted,
            fontSize: 13,
            lineHeight: 18
        }
    }, isUpdate ? 'Your new text will replace your existing review.' : "Share helpful feedback about @".concat(name, "."))), /*#__PURE__*/ React.createElement(window.ReactNative.TextInput, {
        maxLength: COMMENT_MAX_LENGTH,
        multiline: true,
        onChangeText: setComment,
        placeholder: isUpdate ? "Update review for @".concat(name) : "Review @".concat(name),
        placeholderTextColor: colors.muted,
        style: {
            backgroundColor: colors.input,
            borderColor: colors.border,
            borderRadius: 12,
            borderWidth: 1,
            color: colors.text,
            fontSize: 15,
            minHeight: 92,
            paddingHorizontal: 12,
            paddingVertical: 11,
            textAlignVertical: 'top'
        },
        value: comment
    }), /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 10
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: colors.muted,
            flex: 1,
            fontSize: 12
        }
    }, comment.length, "/", COMMENT_MAX_LENGTH), /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
        disabled: disabled,
        onPress: function onPress() {
            return void submit();
        },
        style: function style(param) {
            var pressed = param.pressed;
            return {
                backgroundColor: colors.accent,
                borderRadius: 11,
                minHeight: 44,
                justifyContent: 'center',
                opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
                paddingHorizontal: 16
            };
        }
    }, submitting ? /*#__PURE__*/ React.createElement(window.ReactNative.ActivityIndicator, {
        color: colors.accentText
    }) : /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: colors.accentText,
            fontSize: 14,
            fontWeight: '800'
        }
    }, isUpdate ? 'Update review' : 'Submit review'))));
}function Pill(param) {
    var color = param.color, background = param.background, border = param.border, children = param.children;
    return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            backgroundColor: background,
            borderColor: border,
            borderRadius: 8,
            borderWidth: 1,
            paddingHorizontal: 9,
            paddingVertical: 5
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: color,
            fontSize: 12,
            fontWeight: '700'
        }
    }, children));
}
function ReviewsHeader(param) {
    var name = param.name, reviewCount = param.reviewCount, authorized = param.authorized, colors = param.colors;
    return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            gap: 8,
            paddingBottom: 4
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: colors.text,
            fontSize: 24,
            fontWeight: '800'
        }
    }, "Reviews for @", name), /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: colors.muted,
            fontSize: 14,
            lineHeight: 20
        }
    }, "Community feedback shared through ReviewDB."), /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8
        }
    }, /*#__PURE__*/ React.createElement(Pill, {
        color: colors.text,
        background: colors.surfaceAlt,
        border: colors.border
    }, reviewCount, " reviews"), authorized ? /*#__PURE__*/ React.createElement(Pill, {
        color: colors.positive,
        background: "".concat(colors.positive, "22"),
        border: "".concat(colors.positive, "66")
    }, "ReviewDB connected") : null));
}function color(key, fallback) {
    var _Theme_colors;
    // Optional: without the theme module, every color falls back.
    var value = (_Theme_colors = Theme.colors) === null || _Theme_colors === void 0 ? void 0 : _Theme_colors[key];
    return typeof value === 'string' ? value : fallback;
}
/**
 * @description Resolves the review sheets' palette from Discord's theme, with dark-theme defaults for missing keys.
 * @returns The palette, keyed by role.
 */ function getReviewColors() {
    return {
        page: color('BACKGROUND_MOBILE_PRIMARY', color('BACKGROUND_PRIMARY', '#111214')),
        surface: color('BACKGROUND_SECONDARY', '#1e1f22'),
        surfaceAlt: color('BACKGROUND_SECONDARY_ALT', '#232428'),
        input: color('BACKGROUND_TERTIARY', '#111214'),
        border: color('BACKGROUND_MODIFIER_ACCENT', '#4e5058'),
        text: color('TEXT_NORMAL', '#f2f3f5'),
        muted: color('TEXT_MUTED', '#b5bac1'),
        accent: color('BRAND_500', '#5865f2'),
        accentText: '#ffffff',
        positive: color('GREEN_360', '#23a559'),
        danger: color('RED_400', '#ed4245'),
        link: color('TEXT_LINK', '#00a8fc')
    };
}var UserType = /*#__PURE__*/ function(UserType) {
    UserType[UserType["Banned"] = -1] = "Banned";
    UserType[UserType["Normal"] = 0] = "Normal";
    UserType[UserType["Admin"] = 1] = "Admin";
    return UserType;
}({});
var ReviewType = /*#__PURE__*/ function(ReviewType) {
    ReviewType[ReviewType["User"] = 0] = "User";
    ReviewType[ReviewType["Server"] = 1] = "Server";
    ReviewType[ReviewType["Support"] = 2] = "Support";
    ReviewType[ReviewType["System"] = 3] = "System";
    return ReviewType;
}({});function _array_like_to_array$5(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$5(arr) {
    if (Array.isArray(arr)) return arr;
}
function _iterable_to_array_limit$5(arr, i) {
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
function _non_iterable_rest$5() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$5(arr, i) {
    return _array_with_holes$5(arr) || _iterable_to_array_limit$5(arr, i) || _unsupported_iterable_to_array$5(arr, i) || _non_iterable_rest$5();
}
function _unsupported_iterable_to_array$5(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$5(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$5(o, minLen);
}
function ActionButton(param) {
    var label = param.label, _param_danger = param.danger, danger = _param_danger === void 0 ? false : _param_danger, colors = param.colors, onPress = param.onPress;
    return /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
        onPress: onPress,
        hitSlop: 6,
        style: function style(param) {
            var pressed = param.pressed;
            return {
                backgroundColor: danger ? "".concat(colors.danger, "22") : colors.surface,
                borderColor: danger ? "".concat(colors.danger, "66") : colors.border,
                borderRadius: 9,
                borderWidth: 1,
                opacity: pressed ? 0.65 : 1,
                minHeight: 38,
                justifyContent: 'center',
                paddingHorizontal: 12
            };
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: danger ? colors.danger : colors.text,
            fontSize: 13,
            fontWeight: '700'
        }
    }, label));
}
function ReviewActions(param) {
    var can = param.can, isAuthorBlocked = param.isAuthorBlocked, colors = param.colors, onReport = param.onReport, onToggleBlock = param.onToggleBlock, onDelete = param.onDelete, onClose = param.onClose;
    var _useState = _sliced_to_array$5(window.React.useState(false), 2), deleteArmed = _useState[0], setDeleteArmed = _useState[1];
    return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.border,
            borderRadius: 13,
            borderWidth: 1,
            gap: 10,
            padding: 12
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: colors.muted,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 0.6
        }
    }, "REVIEW ACTIONS"), /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8
        }
    }, can.report ? /*#__PURE__*/ React.createElement(ActionButton, {
        colors: colors,
        label: "Report",
        onPress: onReport
    }) : null, can.block ? /*#__PURE__*/ React.createElement(ActionButton, {
        colors: colors,
        label: isAuthorBlocked ? 'Unblock user' : 'Block user',
        onPress: onToggleBlock
    }) : null, can.delete ? /*#__PURE__*/ React.createElement(ActionButton, {
        colors: colors,
        danger: true,
        label: deleteArmed ? 'Confirm delete' : 'Delete review',
        onPress: deleteArmed ? onDelete : function() {
            return setDeleteArmed(true);
        }
    }) : null, /*#__PURE__*/ React.createElement(ActionButton, {
        colors: colors,
        label: "Close",
        onPress: onClose
    })));
}function VoteButton(param) {
    var glyph = param.glyph, active = param.active, activeColor = param.activeColor, busy = param.busy, colors = param.colors, onPress = param.onPress;
    return /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
        disabled: busy,
        hitSlop: 6,
        onPress: onPress,
        style: function style(param) {
            var pressed = param.pressed;
            return {
                alignItems: 'center',
                backgroundColor: active ? "".concat(activeColor, "33") : 'transparent',
                borderRadius: 8,
                height: 36,
                justifyContent: 'center',
                opacity: pressed || busy ? 0.6 : 1,
                width: 36
            };
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: active ? activeColor : colors.muted,
            fontSize: 18,
            fontWeight: '800'
        }
    }, glyph));
}
function VoteControls(param) {
    var vote = param.vote, score = param.score, busy = param.busy, colors = param.colors, onVote = param.onVote;
    return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            alignItems: 'center',
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.border,
            borderRadius: 10,
            borderWidth: 1,
            flexDirection: 'row',
            height: 38,
            overflow: 'hidden'
        }
    }, /*#__PURE__*/ React.createElement(VoteButton, {
        glyph: "▲",
        active: vote === true,
        activeColor: colors.positive,
        busy: busy,
        colors: colors,
        onPress: function onPress() {
            return onVote(true);
        }
    }), /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: colors.text,
            fontSize: 14,
            fontWeight: '800',
            minWidth: 24,
            textAlign: 'center'
        }
    }, score), /*#__PURE__*/ React.createElement(VoteButton, {
        glyph: "▼",
        active: vote === false,
        activeColor: colors.danger,
        busy: busy,
        colors: colors,
        onPress: function onPress() {
            return onVote(false);
        }
    }));
}/**
 * @description Decides which actions the viewer may take on a review shown on a profile.
 * @param review The review.
 * @param profileId The Discord ID of the profile the review is on.
 * @param viewer The person looking at the review.
 * @returns Which of vote, delete, report and block-author are allowed.
 */ function getReviewPermissions(review, profileId, viewer) {
    var vote = review.id !== 0;
    if (viewer.id === undefined) {
        return {
            vote: vote,
            delete: false,
            report: false,
            block: false
        };
    }
    var isAuthor = review.sender.discordID === viewer.id;
    var isOwnProfile = profileId === viewer.id;
    return {
        vote: vote,
        delete: isOwnProfile || isAuthor || viewer.isAdmin,
        report: !isAuthor,
        block: isOwnProfile && !isAuthor
    };
}function _array_like_to_array$4(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$4(arr) {
    if (Array.isArray(arr)) return arr;
}
function asyncGeneratorStep$4(gen, resolve, reject, _next, _throw, key, arg) {
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
function _async_to_generator$4(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$4(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$4(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _iterable_to_array_limit$4(arr, i) {
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
function _non_iterable_rest$4() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$4(arr, i) {
    return _array_with_holes$4(arr) || _iterable_to_array_limit$4(arr, i) || _unsupported_iterable_to_array$4(arr, i) || _non_iterable_rest$4();
}
function _ts_generator$4(thisArg, body) {
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
function _unsupported_iterable_to_array$4(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$4(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$4(o, minLen);
}
function Badge(param) {
    var label = param.label, color = param.color, colors = param.colors;
    return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            backgroundColor: color,
            borderRadius: 6,
            paddingHorizontal: 7,
            paddingVertical: 3
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: colors.accentText,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 0.4
        }
    }, label));
}
function ReviewItem(param) {
    var review = param.review, profileId = param.profileId, hideTimestamps = param.hideTimestamps, onChanged = param.onChanged;
    var _review_userVote, _review_score, _ref, _review_comment;
    var _Users_getCurrentUser, _account_blockedUsers;
    var colors = getReviewColors();
    var _useState = _sliced_to_array$4(window.React.useState(false), 2), expanded = _useState[0], setExpanded = _useState[1];
    var _useState1 = _sliced_to_array$4(window.React.useState(false), 2), busy = _useState1[0], setBusy = _useState1[1];
    var _useState2 = _sliced_to_array$4(window.React.useState((_review_userVote = review.userVote) !== null && _review_userVote !== void 0 ? _review_userVote : null), 2), vote = _useState2[0], setVote = _useState2[1];
    var _useState3 = _sliced_to_array$4(window.React.useState((_review_score = review.score) !== null && _review_score !== void 0 ? _review_score : 0), 2), score = _useState3[0], setScore = _useState3[1];
    var _useState4 = _sliced_to_array$4(window.React.useState(false), 2), actionsVisible = _useState4[0], setActionsVisible = _useState4[1];
    var myId = (_Users_getCurrentUser = window.unbound.metro.stores.Users.getCurrentUser()) === null || _Users_getCurrentUser === void 0 ? void 0 : _Users_getCurrentUser.id;
    var account = getCurrentUser();
    var author = review.sender.discordID;
    var isAuthorBlocked = (_ref = account === null || account === void 0 ? void 0 : (_account_blockedUsers = account.blockedUsers) === null || _account_blockedUsers === void 0 ? void 0 : _account_blockedUsers.includes(author)) !== null && _ref !== void 0 ? _ref : false;
    var can = getReviewPermissions(review, profileId, {
        id: myId,
        isAdmin: (account === null || account === void 0 ? void 0 : account.type) === UserType.Admin
    });
    var comment = (_review_comment = review.comment) !== null && _review_comment !== void 0 ? _review_comment : '';
    var isLong = comment.length > COMMENT_PREVIEW_LENGTH;
    var showTimestamp = !hideTimestamps && review.type !== ReviewType.System && review.timestamp > 0;
    function run(action) {
        return _async_to_generator$4(function() {
            return _ts_generator$4(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (busy) return [
                            2
                        ];
                        setBusy(true);
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            ,
                            3,
                            4
                        ]);
                        return [
                            4,
                            action()
                        ];
                    case 2:
                        _state.sent();
                        return [
                            3,
                            4
                        ];
                    case 3:
                        setBusy(false);
                        return [
                            7
                        ];
                    case 4:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function handleVote(isUpvote) {
        void run(function() {
            return _async_to_generator$4(function() {
                var change;
                return _ts_generator$4(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            if (author === myId) {
                                window.unbound.toasts.showToast({
                                    title: 'ReviewDB',
                                    content: 'You cannot vote on your own review.'
                                });
                                return [
                                    2
                                ];
                            }
                            change = changeVote(vote, isUpvote);
                            return [
                                4,
                                setReviewVote(review.id, change.vote)
                            ];
                        case 1:
                            if (!_state.sent()) return [
                                2
                            ];
                            setVote(change.vote);
                            setScore(function(current) {
                                return current + change.delta;
                            });
                            return [
                                2
                            ];
                    }
                });
            })();
        });
    }
    function handleDelete() {
        void run(function() {
            return _async_to_generator$4(function() {
                return _ts_generator$4(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            return [
                                4,
                                deleteReview(review.id)
                            ];
                        case 1:
                            if (_state.sent()) {
                                onChanged();
                            }
                            return [
                                2
                            ];
                    }
                });
            })();
        });
    }
    function handleReport() {
        void run(function() {
            return reportReview(review.id);
        });
    }
    function handleToggleBlock() {
        void run(function() {
            return _async_to_generator$4(function() {
                return _ts_generator$4(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            return [
                                4,
                                setUserBlocked(author, !isAuthorBlocked)
                            ];
                        case 1:
                            _state.sent();
                            onChanged();
                            return [
                                2
                            ];
                    }
                });
            })();
        });
    }
    function openActions() {
        if (!can.delete && !can.report && !can.block) return;
        setActionsVisible(true);
    }
    return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            gap: 8
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
        delayLongPress: 350,
        onLongPress: openActions,
        style: function style(param) {
            var pressed = param.pressed;
            return {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: 16,
                borderWidth: 1,
                opacity: pressed ? 0.82 : 1,
                padding: 14
            };
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            flexDirection: 'row',
            gap: 11
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Image, {
        source: {
            uri: review.sender.profilePhoto
        },
        style: {
            backgroundColor: colors.surfaceAlt,
            borderRadius: 22,
            height: 44,
            width: 44
        }
    }), /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            flex: 1,
            gap: 7
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            alignItems: 'center',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: colors.text,
            flexShrink: 1,
            fontSize: 16,
            fontWeight: '800'
        },
        numberOfLines: 1
    }, review.sender.username), review.type === ReviewType.System ? /*#__PURE__*/ React.createElement(Badge, {
        color: colors.accent,
        colors: colors,
        label: "SYSTEM"
    }) : null, isAuthorBlocked ? /*#__PURE__*/ React.createElement(Badge, {
        color: colors.danger,
        colors: colors,
        label: "BLOCKED"
    }) : null), showTimestamp ? /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: colors.muted,
            fontSize: 12
        }
    }, new Intl.DateTimeFormat().format(review.timestamp * 1000)) : null), can.vote ? /*#__PURE__*/ React.createElement(VoteControls, {
        vote: vote,
        score: score,
        busy: busy,
        colors: colors,
        onVote: handleVote
    }) : null), /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            backgroundColor: colors.border,
            height: 1,
            marginTop: 13,
            opacity: 0.55
        }
    }), /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: colors.text,
            fontSize: 15,
            lineHeight: 22,
            paddingTop: 12
        }
    }, isLong && !expanded ? "".concat(comment.slice(0, COMMENT_PREVIEW_LENGTH), "...") : comment), isLong ? /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
        hitSlop: 6,
        onPress: function onPress() {
            return setExpanded(function(value) {
                return !value;
            });
        },
        style: {
            alignSelf: 'flex-start',
            marginTop: 6
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: colors.link,
            fontSize: 13,
            fontWeight: '700'
        }
    }, expanded ? 'Show less' : 'Read more')) : null), actionsVisible ? /*#__PURE__*/ React.createElement(ReviewActions, {
        can: can,
        isAuthorBlocked: isAuthorBlocked,
        colors: colors,
        onReport: handleReport,
        onToggleBlock: handleToggleBlock,
        onDelete: handleDelete,
        onClose: function onClose() {
            return setActionsVisible(false);
        }
    }) : null);
}/**
 * @description Opens Discord's in-app OAuth2 authorize screen and waits for the user's answer.
 * @param options The application's client ID, redirect URI, scopes and optional state.
 * @returns The redirect URL Discord produced, or `undefined` when the user cancelled or closed the screen.
 */ function authorize(param) {
    var clientId = param.clientId, redirectUri = param.redirectUri, scopes = param.scopes, state = param.state;
    return new Promise(function(resolve) {
        window.unbound.metro.api.OAuth2.openOAuth2Modal({
            clientId: clientId,
            redirectUri: redirectUri,
            scopes: scopes,
            state: state,
            responseType: 'code',
            permissions: 0n,
            cancelCompletesFlow: false,
            callback: function callback(param) {
                var location = param.location, canceled = param.canceled;
                resolve(canceled || !location ? undefined : location);
            },
            onClose: function onClose() {
                return resolve(undefined);
            }
        });
    });
}function _array_like_to_array$3(arr, len) {
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
    return _array_with_holes$3(arr) || _iterable_to_array_limit$3(arr, i) || _unsupported_iterable_to_array$3(arr, i) || _non_iterable_rest$3();
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
 * @description Reads the query parameters of a URL by hand, since `URL`'s query support differs across React Native versions.
 * @param location The URL to read.
 * @returns The decoded parameters; the first value wins for a repeated key.
 */ function readQuery(location) {
    var _ref;
    var _location_split_;
    var query = (_ref = (_location_split_ = location.split('#')[0]) === null || _location_split_ === void 0 ? void 0 : _location_split_.split('?')[1]) !== null && _ref !== void 0 ? _ref : '';
    var params = {};
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = query.split('&')[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var pair = _step.value;
            var _pair_split = _sliced_to_array$3(pair.split('='), 2), tmp = _pair_split[0], key = tmp === void 0 ? '' : tmp, tmp1 = _pair_split[1], value = tmp1 === void 0 ? '' : tmp1;
            var name = decodeURIComponent(key);
            if (name && !(name in params)) {
                params[name] = decodeURIComponent(value.replace(/\+/g, ' '));
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
    return params;
}function asyncGeneratorStep$3(gen, resolve, reject, _next, _throw, key, arg) {
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
function _async_to_generator$3(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$3(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$3(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _instanceof(left, right) {
    "@swc/helpers - instanceof";
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else return left instanceof right;
}
function _ts_generator$3(thisArg, body) {
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
function notify(content) {
    window.unbound.toasts.showToast({
        title: 'ReviewDB',
        content: content
    });
}
function finishLogin(location) {
    return _async_to_generator$3(function() {
        var _readQuery, error, description, response, payload;
        return _ts_generator$3(this, function(_state) {
            switch(_state.label){
                case 0:
                    _readQuery = readQuery(location), error = _readQuery.error, description = _readQuery.error_description;
                    if (error) {
                        if (error !== 'access_denied') notify(description !== null && description !== void 0 ? description : error);
                        return [
                            2,
                            false
                        ];
                    }
                    if (!location.startsWith(AUTH_REDIRECT_URI)) return [
                        2,
                        false
                    ];
                    return [
                        4,
                        fetch("".concat(location, "&clientMod=enmity"), {
                            headers: {
                                Accept: 'application/json'
                            }
                        })
                    ];
                case 1:
                    response = _state.sent();
                    return [
                        4,
                        response.json().catch(function() {
                            return null;
                        })
                    ];
                case 2:
                    payload = _state.sent();
                    if (!response.ok) {
                        notify(typeof (payload === null || payload === void 0 ? void 0 : payload.message) === 'string' ? payload.message : 'ReviewDB login failed.');
                        return [
                            2,
                            false
                        ];
                    }
                    if (typeof (payload === null || payload === void 0 ? void 0 : payload.token) !== 'string') {
                        notify('ReviewDB login returned an invalid payload.');
                        return [
                            2,
                            false
                        ];
                    }
                    settings.set('token', payload.token);
                    notify('Successfully authorized with ReviewDB.');
                    return [
                        2,
                        true
                    ];
            }
        });
    })();
}
/**
 * @description Opens Discord's OAuth2 authorize screen for ReviewDB and stores the token it grants.
 * @param onSuccess Called once the token is stored.
 */ function signIn(onSuccess) {
    return _async_to_generator$3(function() {
        var location, _tmp, error;
        return _ts_generator$3(this, function(_state) {
            switch(_state.label){
                case 0:
                    _state.trys.push([
                        0,
                        4,
                        ,
                        5
                    ]);
                    return [
                        4,
                        authorize({
                            clientId: '915703782174752809',
                            redirectUri: AUTH_REDIRECT_URI,
                            scopes: [
                                'identify'
                            ]
                        })
                    ];
                case 1:
                    location = _state.sent();
                    _tmp = location;
                    if (!_tmp) return [
                        3,
                        3
                    ];
                    return [
                        4,
                        finishLogin(location)
                    ];
                case 2:
                    _tmp = _state.sent();
                    _state.label = 3;
                case 3:
                    if (_tmp) onSuccess === null || onSuccess === void 0 ? void 0 : onSuccess();
                    return [
                        3,
                        5
                    ];
                case 4:
                    error = _state.sent();
                    notify(_instanceof(error, Error) ? error.message : 'Authorization failed.');
                    return [
                        3,
                        5
                    ];
                case 5:
                    return [
                        2
                    ];
            }
        });
    })();
}function _array_like_to_array$2(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$2(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$2(arr);
}
function asyncGeneratorStep$2(gen, resolve, reject, _next, _throw, key, arg) {
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
function _async_to_generator$2(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$2(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$2(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
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
function _iterable_to_array(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
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
function _non_iterable_spread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
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
function _sliced_to_array$2(arr, i) {
    return _array_with_holes$2(arr) || _iterable_to_array_limit$2(arr, i) || _unsupported_iterable_to_array$2(arr, i) || _non_iterable_rest$2();
}
function _to_consumable_array(arr) {
    return _array_without_holes(arr) || _iterable_to_array(arr) || _unsupported_iterable_to_array$2(arr) || _non_iterable_spread();
}
function _ts_generator$2(thisArg, body) {
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
function _unsupported_iterable_to_array$2(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$2(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$2(o, minLen);
}
function ReviewsSheet(param) {
    var discordId = param.discordId, name = param.name, onClose = param.onClose;
    var _ref, _ref1;
    var _Users_getCurrentUser;
    var colors = getReviewColors();
    var store = settings.useSettingsStore();
    var _useState = _sliced_to_array$2(window.React.useState(null), 2), data = _useState[0], setData = _useState[1];
    var _useState1 = _sliced_to_array$2(window.React.useState(true), 2), loading = _useState1[0], setLoading = _useState1[1];
    var myId = (_Users_getCurrentUser = window.unbound.metro.stores.Users.getCurrentUser()) === null || _Users_getCurrentUser === void 0 ? void 0 : _Users_getCurrentUser.id;
    var authorized = Boolean(store.get('token', ''));
    var hideBlockedUsers = store.get('hideBlockedUsers', true);
    var isOwnProfile = discordId === myId;
    var load = window.React.useCallback(function(offset) {
        return _async_to_generator$2(function() {
            var page;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        setLoading(true);
                        return [
                            4,
                            getReviews(discordId, offset)
                        ];
                    case 1:
                        page = _state.sent();
                        setData(function(previous) {
                            return offset && previous ? _object_spread_props(_object_spread({}, page), {
                                reviews: _to_consumable_array(previous.reviews).concat(_to_consumable_array(page.reviews))
                            }) : page;
                        });
                        setLoading(false);
                        return [
                            2
                        ];
                }
            });
        })();
    }, [
        discordId
    ]);
    window.React.useEffect(function() {
        void load(0);
    }, [
        load
    ]);
    function refetch() {
        void load(0);
    }
    function startSignIn() {
        onClose();
        void signIn(function() {
            return openReviewsSheet(discordId, name);
        });
    }
    // Optional: without the relationship store, nobody counts as blocked.
    var reviews = ((_ref = data === null || data === void 0 ? void 0 : data.reviews) !== null && _ref !== void 0 ? _ref : []).filter(function(review) {
        var _RelationshipStore_isBlocked;
        return !hideBlockedUsers || !((_RelationshipStore_isBlocked = RelationshipStore.isBlocked) === null || _RelationshipStore_isBlocked === void 0 ? void 0 : _RelationshipStore_isBlocked.call(RelationshipStore, review.sender.discordID));
    });
    var hasOwnReview = reviews.some(function(review) {
        return review.sender.discordID === myId;
    });
    return /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.ActionSheet, {
        startExpanded: true
    }, /*#__PURE__*/ React.createElement(window.ReactNative.ScrollView, {
        contentContainerStyle: {
            backgroundColor: colors.page,
            gap: 12,
            padding: 16,
            paddingBottom: 32
        },
        keyboardShouldPersistTaps: "handled",
        style: {
            backgroundColor: colors.page,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            overflow: 'hidden'
        }
    }, /*#__PURE__*/ React.createElement(ReviewsHeader, {
        name: name,
        reviewCount: (_ref1 = data === null || data === void 0 ? void 0 : data.reviewCount) !== null && _ref1 !== void 0 ? _ref1 : reviews.length,
        authorized: authorized,
        colors: colors
    }), loading ? /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: 16,
            borderWidth: 1,
            gap: 8,
            padding: 28
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.ActivityIndicator, {
        color: colors.link
    }), /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: colors.muted,
            fontSize: 14
        }
    }, "Loading reviews…")) : null, !loading && !reviews.length ? /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: 16,
            borderWidth: 1,
            gap: 6,
            padding: 24
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: colors.text,
            fontSize: 17,
            fontWeight: '800'
        }
    }, "No reviews yet"), /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: colors.muted,
            fontSize: 14,
            textAlign: 'center'
        }
    }, "Be the first person to leave feedback.")) : null, reviews.map(function(review) {
        return /*#__PURE__*/ React.createElement(ReviewItem, {
            key: review.id,
            review: review,
            profileId: discordId,
            hideTimestamps: store.get('hideTimestamps', false),
            onChanged: refetch
        });
    }), (data === null || data === void 0 ? void 0 : data.hasNextPage) && !loading ? /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
        onPress: function onPress() {
            return void load(data.reviews.length);
        },
        style: function style(param) {
            var pressed = param.pressed;
            return {
                alignItems: 'center',
                backgroundColor: colors.surfaceAlt,
                borderColor: colors.border,
                borderRadius: 12,
                borderWidth: 1,
                opacity: pressed ? 0.7 : 1,
                paddingVertical: 13
            };
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: colors.link,
            fontSize: 14,
            fontWeight: '800'
        }
    }, "Load more reviews")) : null, !isOwnProfile && authorized ? /*#__PURE__*/ React.createElement(ReviewComposer, {
        discordId: discordId,
        name: name,
        isUpdate: hasOwnReview,
        colors: colors,
        onSubmitted: refetch
    }) : null, !isOwnProfile && !authorized ? /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
        onPress: startSignIn,
        style: function style(param) {
            var pressed = param.pressed;
            return {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: 16,
                borderWidth: 1,
                opacity: pressed ? 0.7 : 1,
                padding: 16
            };
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: colors.link,
            fontSize: 15,
            fontWeight: '800',
            textAlign: 'center'
        }
    }, "Sign in to leave a review")) : null));
}
/**
 * @description Opens the sheet listing a profile's reviews, with a form to leave one.
 * @param discordId The Discord ID of the profile.
 * @param name The name shown in the sheet's title.
 */ function openReviewsSheet(discordId, name) {
    openSheet("unbound-reviewdb-".concat(discordId, "-").concat(Date.now()), ReviewsSheet, {
        discordId: discordId,
        name: name
    });
}function ReviewsButton(param) {
    var userId = param.userId;
    function open() {
        var _ref, _ref1;
        var user = window.unbound.metro.stores.Users.getUser(userId);
        openReviewsSheet(userId, (_ref = (_ref1 = user === null || user === void 0 ? void 0 : user.globalName) !== null && _ref1 !== void 0 ? _ref1 : user === null || user === void 0 ? void 0 : user.username) !== null && _ref !== void 0 ? _ref : 'User');
    }
    return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            marginTop: 8,
            alignSelf: 'flex-start'
        }
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Button, {
        text: "View Reviews",
        variant: "secondary",
        size: "sm",
        onPress: open
    }));
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
function findUserId(param) {
    var title = param.title, children = param.children;
    if (title || !Array.isArray(children)) return;
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = children[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var child = _step.value;
            var _child_props;
            var userId = child === null || child === void 0 ? void 0 : (_child_props = child.props) === null || _child_props === void 0 ? void 0 : _child_props.userId;
            if (typeof userId === 'string') return userId;
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
/**
 * @description Adds a View Reviews button under the user info card on profiles.
 * @returns A function that removes the button.
 */ function patchUserProfileCard() {
    var card = [
        UserProfileCard,
        UserProfileCardByName
    ].find(function(module) {
        return typeof module.default === 'function';
    });
    if (!ensureModules('ReviewDB', {
        UserProfileCard: card
    }) || !card) return function() {};
    return Patcher.after(card, 'default', function(param) {
        var _param_args = _sliced_to_array$1(param.args, 1), props = _param_args[0], result = param.result;
        var userId = findUserId(props);
        if (!userId) return;
        return /*#__PURE__*/ React.createElement(React.Fragment, null, result, /*#__PURE__*/ React.createElement(ReviewsButton, {
            userId: userId
        }));
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
}function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes(arr) {
    if (Array.isArray(arr)) return arr;
}
function asyncGeneratorStep$1(gen, resolve, reject, _next, _throw, key, arg) {
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
function _async_to_generator$1(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$1(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$1(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
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
function _ts_generator$1(thisArg, body) {
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
function _unsupported_iterable_to_array(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array(o, minLen);
}
function BlockedUsersSheet() {
    var _useState = _sliced_to_array(window.React.useState(null), 2), users = _useState[0], setUsers = _useState[1];
    var _useState1 = _sliced_to_array(window.React.useState(null), 2), busyId = _useState1[0], setBusyId = _useState1[1];
    window.React.useEffect(function() {
        void getBlockedUsers().then(setUsers);
    }, []);
    function unblock(userId) {
        return _async_to_generator$1(function() {
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (busyId) return [
                            2
                        ];
                        setBusyId(userId);
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            ,
                            3,
                            4
                        ]);
                        return [
                            4,
                            setUserBlocked(userId, false)
                        ];
                    case 2:
                        _state.sent();
                        setUsers(function(current) {
                            var _ref;
                            return (_ref = current === null || current === void 0 ? void 0 : current.filter(function(user) {
                                return user.discordID !== userId;
                            })) !== null && _ref !== void 0 ? _ref : null;
                        });
                        return [
                            3,
                            4
                        ];
                    case 3:
                        setBusyId(null);
                        return [
                            7
                        ];
                    case 4:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    return /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.ActionSheet, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Text, {
        variant: "heading-lg/semibold",
        style: {
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: 8
        }
    }, "Blocked Users"), /*#__PURE__*/ React.createElement(window.ReactNative.View, null, users === null ? /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            padding: 12,
            alignItems: 'center'
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.ActivityIndicator, null)) : null, (users === null || users === void 0 ? void 0 : users.length) === 0 ? /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Text, {
        style: {
            padding: 12
        },
        color: "text-muted"
    }, "No blocked users.") : null, users === null || users === void 0 ? void 0 : users.map(function(user) {
        return /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Card, {
            key: user.discordID,
            variant: "secondary",
            border: "subtle",
            radius: 8,
            style: {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 8,
                paddingHorizontal: 12,
                marginBottom: 8,
                marginHorizontal: 12
            }
        }, /*#__PURE__*/ React.createElement(window.ReactNative.Image, {
            source: {
                uri: user.profilePhoto
            },
            style: {
                width: 28,
                height: 28,
                borderRadius: 14
            }
        }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Text, {
            style: {
                flex: 1
            }
        }, user.username), /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
            disabled: busyId === user.discordID,
            onPress: function onPress() {
                return void unblock(user.discordID);
            }
        }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Text, {
            variant: "text-sm/semibold",
            color: "text-danger"
        }, "Unblock")));
    })));
}
/**
 * @description Opens the sheet listing users blocked from reviewing the viewer's profile.
 */ function openBlockedUsersSheet() {
    openSheet("unbound-reviewdb-blocked-".concat(Date.now()), BlockedUsersSheet, {});
}function SettingsPanel() {
    var _Users_getCurrentUser;
    var store = settings.useSettingsStore();
    var authorized = Boolean(store.get('token', ''));
    var myId = (_Users_getCurrentUser = window.unbound.metro.stores.Users.getCurrentUser()) === null || _Users_getCurrentUser === void 0 ? void 0 : _Users_getCurrentUser.id;
    return /*#__PURE__*/ React.createElement(Page, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "Account"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: authorized ? 'Reauthorize with ReviewDB' : 'Authorize with ReviewDB',
        subLabel: authorized ? 'You are connected to ReviewDB' : 'Sign in to review users and see your reviews',
        onPress: function onPress() {
            return void signIn();
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: "View My Reviews",
        arrow: true,
        disabled: !myId,
        onPress: myId ? function() {
            return openReviewsSheet(myId, 'You');
        } : undefined
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: "Manage Blocked Users",
        subLabel: "Users you have blocked from leaving reviews",
        arrow: true,
        disabled: !authorized,
        onPress: authorized ? openBlockedUsersSheet : undefined
    })), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "Preferences"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Notify About New Reviews",
        subLabel: "Show a toast on startup when you have new reviews",
        value: store.get('notifyReviews', true),
        onValueChange: function onValueChange(value) {
            return store.set('notifyReviews', value);
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Hide Timestamps",
        value: store.get('hideTimestamps', false),
        onValueChange: function onValueChange(value) {
            return store.set('hideTimestamps', value);
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Hide Reviews From Blocked Users",
        subLabel: "Hide reviews from users you have blocked on Discord",
        value: store.get('hideBlockedUsers', true),
        onValueChange: function onValueChange(value) {
            return store.set('hideBlockedUsers', value);
        }
    })), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "Links"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: "ReviewDB Website",
        arrow: true,
        onPress: function onPress() {
            return void window.ReactNative.Linking.openURL('https://reviewdb.mantikafasi.dev');
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: "ReviewDB Support Server",
        arrow: true,
        onPress: function onPress() {
            return void window.ReactNative.Linking.openURL('https://discord.gg/eWPBSbvznt');
        }
    })));
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
 * @description Fetches the signed-in account, then toasts when its profile got reviews since the last check and records the newest one.
 * @returns A promise that settles once the check is done.
 */ function notifyNewReviews() {
    return _async_to_generator(function() {
        var user, lastReviewId;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        fetchCurrentUser()
                    ];
                case 1:
                    user = _state.sent();
                    if (!user || !settings.get('notifyReviews', true)) return [
                        2
                    ];
                    lastReviewId = settings.get('lastReviewId', 0);
                    if (lastReviewId && lastReviewId < user.lastReviewID) {
                        window.unbound.toasts.showToast({
                            title: 'ReviewDB',
                            content: 'You have new reviews on your profile!'
                        });
                    }
                    settings.set('lastReviewId', user.lastReviewID);
                    return [
                        2
                    ];
            }
        });
    })();
}var dispose = function dispose() {};
function start() {
    void notifyNewReviews();
    dispose = applyFeatures('ReviewDB', [
        patchUserProfileCard
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