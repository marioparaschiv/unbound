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
}var MAX_ATTACHMENTS = 10;
var MAX_DESCRIPTION_LENGTH = 100;
var ARGUMENT_PATTERN = /{{(.+?)}}/g;
var ApplicationCommandType = {
    Chat: 1
};
var ApplicationCommandInputType = {
    BuiltInText: 1
};
var ApplicationCommandOptionType = {
    String: 3,
    Boolean: 5
};
var MIME_TYPES = {
    gif: 'image/gif',
    heic: 'image/heic',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    m4v: 'video/x-m4v',
    mov: 'video/quicktime',
    mp4: 'video/mp4',
    png: 'image/png',
    webm: 'video/webm',
    webp: 'image/webp'
};function isMediaType(type) {
    return Boolean((type === null || type === void 0 ? void 0 : type.startsWith('image/')) || (type === null || type === void 0 ? void 0 : type.startsWith('video/')));
}
/**
 * @description Gets a file name's extension.
 * @param fileName The file name.
 * @returns The extension without its dot, or `undefined` when there is none.
 */ function fileExtension(fileName) {
    var _fileName_match;
    return (_fileName_match = fileName.match(/\.([a-z0-9]+)$/i)) === null || _fileName_match === void 0 ? void 0 : _fileName_match[1];
}
/**
 * @description Turns a `file://` URI into a file system path.
 * @param uri The URI, or a path that is returned unchanged.
 * @returns The decoded path.
 */ function localPath(uri) {
    return uri.startsWith('file://') ? decodeURI(uri.slice('file://'.length)) : uri;
}
/**
 * @description Checks an asset from Discord's media picker and fills in its name and MIME type.
 * @param asset One asset from the picker's result.
 * @returns The asset's metadata.
 * @throws When the asset is not a local file, has no file size, or is not an image or video.
 */ function resolvePickedMedia(asset) {
    var _find, _ref;
    var _asset_uri, _asset_fileName, _fileExtension;
    if (!((_asset_uri = asset.uri) === null || _asset_uri === void 0 ? void 0 : _asset_uri.startsWith('file://'))) {
        throw new Error('The selected media is unavailable. Choose a local photo or video.');
    }
    var fileName = ((_asset_fileName = asset.fileName) === null || _asset_fileName === void 0 ? void 0 : _asset_fileName.trim()) || localPath(asset.uri).split('/').pop();
    if (!fileName) {
        throw new Error('The selected media is unavailable. Choose a local photo or video.');
    }
    var fileSize = asset.fileSize;
    if (fileSize === undefined || !Number.isSafeInteger(fileSize) || fileSize < 0) {
        throw new Error('The media picker did not provide a valid file size.');
    }
    var type = (_find = [
        asset.mimeType,
        asset.type
    ].find(isMediaType)) !== null && _find !== void 0 ? _find : MIME_TYPES[(_ref = (_fileExtension = fileExtension(fileName)) === null || _fileExtension === void 0 ? void 0 : _fileExtension.toLowerCase()) !== null && _ref !== void 0 ? _ref : ''];
    if (!type) {
        throw new Error('Choose an image or video attachment.');
    }
    return {
        id: asset.id,
        uri: asset.uri,
        type: type,
        fileName: fileName,
        fileSize: fileSize,
        width: asset.width,
        height: asset.height,
        duration: asset.duration
    };
}var _metro_common = window.unbound.metro.common;
var Commands = _metro_common.Commands, Dispatcher = _metro_common.Dispatcher;
var Messages = window.unbound.metro.api.Messages;
var PendingReplyStore = window.unbound.metro.findStore('PendingReply', {
    lazy: true
});
var CloudUploader = window.unbound.metro.findByProps('CloudUpload', {
    lazy: true
});
var ImagePicker = window.unbound.metro.findByProps('launchImageLibraryAsync', {
    lazy: true
});
var settings = window.unbound.storage.getStore('unbound.custom-commands');
var Patcher = window.unbound.patcher.createPatcher('unbound.custom-commands');function asyncGeneratorStep$3(gen, resolve, reject, _next, _throw, key, arg) {
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
/**
 * @description Checks whether a form attachment is already saved in the plugin's documents.
 * @param media The attachment.
 * @returns `true` for a saved attachment.
 */ function isSaved(media) {
    return 'storedName' in media;
}
/**
 * @description Builds the `file://` URI of a saved attachment.
 * @param media The saved attachment.
 * @returns The attachment's URI in the app's documents directory.
 */ function mediaUri(media) {
    return "file://".concat(window.unbound.fs.Documents, "/").concat(media.storedName);
}
/**
 * @description Opens Discord's photo library picker.
 * @returns The picked images and videos.
 * @throws When the picker is unavailable, fails, or returns an unusable asset.
 */ function pickMedia() {
    return _async_to_generator$3(function() {
        var _result_assets, result;
        return _ts_generator$3(this, function(_state) {
            switch(_state.label){
                case 0:
                    if (!ImagePicker.launchImageLibraryAsync) {
                        throw new Error('The media picker is unavailable on this Discord build.');
                    }
                    return [
                        4,
                        ImagePicker.launchImageLibraryAsync({
                            includeBase64: false,
                            mediaType: 'mixed',
                            selectionLimit: MAX_ATTACHMENTS
                        })
                    ];
                case 1:
                    result = _state.sent();
                    if (result.errorCode) {
                        throw new Error(result.errorMessage || result.errorCode);
                    }
                    return [
                        2,
                        ((_result_assets = result.assets) !== null && _result_assets !== void 0 ? _result_assets : []).map(resolvePickedMedia)
                    ];
            }
        });
    })();
}
/**
 * @description Copies a picked file into the plugin's documents so the command keeps working after the picker's copy is gone.
 * @param media The picked file.
 * @returns The saved attachment.
 */ function persistMedia(media) {
    return _async_to_generator$3(function() {
        var _ref, _fileExtension, extension, id, storedName, _, _tmp;
        return _ts_generator$3(this, function(_state) {
            switch(_state.label){
                case 0:
                    extension = (_ref = (_fileExtension = fileExtension(media.fileName)) !== null && _fileExtension !== void 0 ? _fileExtension : media.type.split('/')[1]) !== null && _ref !== void 0 ? _ref : 'bin';
                    id = Math.random().toString(36).slice(2, 10);
                    storedName = "custom-commands-".concat(Date.now(), "-").concat(id, ".").concat(extension.toLowerCase());
                    _ = window.unbound.fs.write;
                    _tmp = [
                        storedName
                    ];
                    return [
                        4,
                        window.unbound.fs.read(localPath(media.uri), 'base64', false)
                    ];
                case 1:
                    return [
                        4,
                        _.apply(window.unbound.fs, _tmp.concat([
                            _state.sent(),
                            'base64'
                        ]))
                    ];
                case 2:
                    _state.sent();
                    return [
                        2,
                        {
                            storedName: storedName,
                            fileName: media.fileName || storedName,
                            mimeType: media.type,
                            fileSize: media.fileSize,
                            width: media.width,
                            height: media.height,
                            duration: media.duration
                        }
                    ];
            }
        });
    })();
}
/**
 * @description Deletes a saved attachment's file.
 * @param media The saved attachment.
 * @returns A promise that settles once the file is gone.
 */ function removeStoredMedia(media) {
    return _async_to_generator$3(function() {
        return _ts_generator$3(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        window.unbound.fs.rm(media.storedName)
                    ];
                case 1:
                    _state.sent();
                    return [
                        2
                    ];
            }
        });
    })();
}function _array_like_to_array$4(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$3(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$2(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$4(arr);
}
function _define_property$3(obj, key, value) {
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
function _iterable_to_array$2(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_rest$3() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _non_iterable_spread$2() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
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
function _to_array(arr) {
    return _array_with_holes$3(arr) || _iterable_to_array$2(arr) || _unsupported_iterable_to_array$4(arr) || _non_iterable_rest$3();
}
function _to_consumable_array$2(arr) {
    return _array_without_holes$2(arr) || _iterable_to_array$2(arr) || _unsupported_iterable_to_array$4(arr) || _non_iterable_spread$2();
}
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _unsupported_iterable_to_array$4(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$4(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$4(o, minLen);
}
function parseArgument(body) {
    var _body_split = _to_array(body.split('=')), name = _body_split[0], defaultParts = _body_split.slice(1);
    return {
        name: name.trim().toLowerCase(),
        defaultValue: defaultParts.length ? defaultParts.join('=').trim() : null
    };
}
function isStoredTag(entry) {
    return (typeof entry === "undefined" ? "undefined" : _type_of(entry)) === 'object' && entry !== null && 'name' in entry && typeof entry.name === 'string' && 'message' in entry && typeof entry.message === 'string';
}
function isStoredMedia(item) {
    return (typeof item === "undefined" ? "undefined" : _type_of(item)) === 'object' && item !== null && 'storedName' in item && typeof item.storedName === 'string' && /^custom-commands-[a-z0-9-]+\.[a-z0-9]+$/i.test(item.storedName) && 'fileName' in item && typeof item.fileName === 'string' && 'mimeType' in item && typeof item.mimeType === 'string';
}
/**
 * @description Gets the text shown under a command in Discord's slash-command list.
 * @param tag The saved command.
 * @returns The tag's own description, or a generated one when it has none.
 */ function getTagDescription(tag) {
    var _tag_description;
    return ((_tag_description = tag.description) === null || _tag_description === void 0 ? void 0 : _tag_description.trim()) || "Send the ".concat(tag.name, " command");
}
/**
 * @description Finds the `{{name}}` and `{{name = default}}` placeholders in a response.
 * @param message The command's response template.
 * @returns Each argument once, lowercased, in order of first appearance.
 */ function parseTagArguments(message) {
    var argumentsByName = new Map();
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = message.matchAll(ARGUMENT_PATTERN)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var match = _step.value;
            var argument = parseArgument(match[1]);
            if (!argument.name || argumentsByName.has(argument.name)) {
                continue;
            }
            argumentsByName.set(argument.name, argument);
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
    return _to_consumable_array$2(argumentsByName.values());
}
/**
 * @description Checks a command against the rules Discord and this plugin place on it.
 * @param tag The command to check.
 * @param existing The commands already saved.
 * @param originalName The name the command had before this edit, if it is being edited.
 * @param mediaCount How many attachments the command will have, including ones not yet saved.
 * @returns A message describing the first problem, or `null` when the command is valid.
 */ function validateTag(tag, existing, originalName) {
    var mediaCount = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : tag.media.length;
    if (!/^[a-z0-9_-]{1,32}$/.test(tag.name)) {
        return 'Use 1–32 lowercase letters, numbers, hyphens, or underscores for the command name.';
    }
    if (tag.description && tag.description.trim().length > MAX_DESCRIPTION_LENGTH) {
        return "Use at most ".concat(MAX_DESCRIPTION_LENGTH, " characters for the command description.");
    }
    if (!tag.message.trim() && !mediaCount) {
        return 'Add a response or at least one image or video.';
    }
    if (parseTagArguments(tag.message).some(function(argument) {
        return argument.name === 'ephemeral';
    })) {
        return 'The argument name “ephemeral” is reserved.';
    }
    if (mediaCount > MAX_ATTACHMENTS) {
        return "A command can have at most ".concat(MAX_ATTACHMENTS, " attachments.");
    }
    if (existing.some(function(entry) {
        return entry.name === tag.name && entry.name !== originalName;
    })) {
        return 'A command with this name already exists.';
    }
    return null;
}
// UNKNOWN: the saved `tags` setting is user data read from disk and may be malformed.
/**
 * @description Parses the saved `tags` setting, dropping malformed, invalid, and duplicate entries.
 * @param value The raw setting value.
 * @returns The valid commands; the first command with a given name wins.
 */ function normalizeTags(value) {
    if (!Array.isArray(value)) return [];
    var tags = [];
    var names = new Set();
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = value[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var entry = _step.value;
            if (!isStoredTag(entry)) {
                continue;
            }
            var description = typeof entry.description === 'string' && entry.description.trim().length <= MAX_DESCRIPTION_LENGTH ? entry.description.trim() : '';
            var tag = _object_spread$3({
                name: entry.name,
                message: entry.message,
                media: Array.isArray(entry.media) ? entry.media.filter(isStoredMedia) : []
            }, description ? {
                description: description
            } : {});
            if (names.has(tag.name) || validateTag(tag, []) !== null) {
                continue;
            }
            names.add(tag.name);
            tags.push(tag);
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
    return tags;
}
/**
 * @description Finds a command option by name, searching nested sub-command options too.
 * @param options The options Discord passed to the command.
 * @param name The option's name.
 * @returns The option's value, or `undefined` when it was not supplied.
 */ function getOptionValue(options, name) {
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = options[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var option = _step.value;
            if (option.name === name) return option.value;
            var nested = option.options && getOptionValue(option.options, name);
            if (nested !== undefined) return nested;
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
    return undefined;
}
/**
 * @description Fills a response template with the command's options and turns a typed `\n` into a line break.
 * @param message The command's response template.
 * @param options The options Discord passed to the command.
 * @returns The text to send. A placeholder with no value and no default is left as written.
 */ function renderTagMessage(message, options) {
    return message.replace(ARGUMENT_PATTERN, function(placeholder, body) {
        var _parseArgument = parseArgument(body), name = _parseArgument.name, defaultValue = _parseArgument.defaultValue;
        var value = getOptionValue(options, name);
        if (value !== undefined && value !== null) {
            return String(value);
        }
        return defaultValue !== null && defaultValue !== void 0 ? defaultValue : placeholder;
    }).replaceAll('\\n', '\n');
}function _array_like_to_array$3(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$1(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$3(arr);
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
function _define_property$2(obj, key, value) {
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
function _to_consumable_array$1(arr) {
    return _array_without_holes$1(arr) || _iterable_to_array$1(arr) || _unsupported_iterable_to_array$3(arr) || _non_iterable_spread$1();
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
function _unsupported_iterable_to_array$3(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$3(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$3(o, minLen);
}
/**
 * @description Reads the saved commands.
 * @returns The valid saved commands.
 */ function getTags() {
    return normalizeTags(settings.get('tags', []));
}
/**
 * @description Saves a new or edited command, copying newly picked attachments and deleting the files of removed ones.
 * @param fields The command's name, description, and response.
 * @param media The command's attachments, saved or newly picked.
 * @param original The command as it was before this edit, or `null` for a new command.
 * @returns A promise that settles once the command is saved. On failure, newly copied files are deleted.
 */ function saveTag(_0, _1, _2) {
    return _async_to_generator$2(function(param, media, original) {
        var name, description, message, added, _ref, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, item, _, err, tag, retained, _iteratorNormalCompletion1, _didIteratorError1, _iteratorError1, _iterator1, _step1, item1, err, error;
        return _ts_generator$2(this, function(_state) {
            switch(_state.label){
                case 0:
                    name = param.name, description = param.description, message = param.message;
                    added = [];
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        18,
                        ,
                        20
                    ]);
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    _state.label = 2;
                case 2:
                    _state.trys.push([
                        2,
                        7,
                        8,
                        9
                    ]);
                    _iterator = media[Symbol.iterator]();
                    _state.label = 3;
                case 3:
                    if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                        3,
                        6
                    ];
                    item = _step.value;
                    if (isSaved(item)) {
                        return [
                            3,
                            5
                        ];
                    }
                    _ = added.push;
                    return [
                        4,
                        persistMedia(item)
                    ];
                case 4:
                    _.apply(added, [
                        _state.sent()
                    ]);
                    _state.label = 5;
                case 5:
                    _iteratorNormalCompletion = true;
                    return [
                        3,
                        3
                    ];
                case 6:
                    return [
                        3,
                        9
                    ];
                case 7:
                    err = _state.sent();
                    _didIteratorError = true;
                    _iteratorError = err;
                    return [
                        3,
                        9
                    ];
                case 8:
                    try {
                        if (!_iteratorNormalCompletion && _iterator.return != null) {
                            _iterator.return();
                        }
                    } finally{
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                    return [
                        7
                    ];
                case 9:
                    tag = _object_spread_props$2(_object_spread$2({
                        name: name
                    }, description ? {
                        description: description
                    } : {}), {
                        message: message,
                        media: _to_consumable_array$1(media.filter(isSaved)).concat(_to_consumable_array$1(added))
                    });
                    settings.set('tags', _to_consumable_array$1(getTags().filter(function(entry) {
                        return entry.name !== (original === null || original === void 0 ? void 0 : original.name);
                    })).concat([
                        tag
                    ]));
                    retained = new Set(tag.media.map(function(item) {
                        return item.storedName;
                    }));
                    _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
                    _state.label = 10;
                case 10:
                    _state.trys.push([
                        10,
                        15,
                        16,
                        17
                    ]);
                    _iterator1 = ((_ref = original === null || original === void 0 ? void 0 : original.media) !== null && _ref !== void 0 ? _ref : [])[Symbol.iterator]();
                    _state.label = 11;
                case 11:
                    if (!!(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done)) return [
                        3,
                        14
                    ];
                    item1 = _step1.value;
                    if (!!retained.has(item1.storedName)) return [
                        3,
                        13
                    ];
                    return [
                        4,
                        removeStoredMedia(item1)
                    ];
                case 12:
                    _state.sent();
                    _state.label = 13;
                case 13:
                    _iteratorNormalCompletion1 = true;
                    return [
                        3,
                        11
                    ];
                case 14:
                    return [
                        3,
                        17
                    ];
                case 15:
                    err = _state.sent();
                    _didIteratorError1 = true;
                    _iteratorError1 = err;
                    return [
                        3,
                        17
                    ];
                case 16:
                    try {
                        if (!_iteratorNormalCompletion1 && _iterator1.return != null) {
                            _iterator1.return();
                        }
                    } finally{
                        if (_didIteratorError1) {
                            throw _iteratorError1;
                        }
                    }
                    return [
                        7
                    ];
                case 17:
                    return [
                        3,
                        20
                    ];
                case 18:
                    error = _state.sent();
                    return [
                        4,
                        Promise.allSettled(added.map(removeStoredMedia))
                    ];
                case 19:
                    _state.sent();
                    throw error;
                case 20:
                    return [
                        2
                    ];
            }
        });
    }).apply(this, arguments);
}
/**
 * @description Deletes a command and, in the background, its attachment files.
 * @param tag The command to delete.
 */ function deleteTag(tag) {
    settings.set('tags', getTags().filter(function(entry) {
        return entry.name !== tag.name;
    }));
    void Promise.allSettled(tag.media.map(removeStoredMedia));
}function summarize(tag) {
    var count = tag.media.length;
    return tag.description || tag.message || "".concat(count, " attachment").concat(count === 1 ? '' : 's');
}
function confirmDelete(tag) {
    window.ReactNative.Alert.alert('Delete command', "Delete /".concat(tag.name, " and its saved attachments?"), [
        {
            text: 'Cancel',
            style: 'cancel'
        },
        {
            text: 'Delete',
            style: 'destructive',
            onPress: function onPress() {
                return deleteTag(tag);
            }
        }
    ]);
}
function CommandList(param) {
    var tags = param.tags, onCreate = param.onCreate, onEdit = param.onEdit;
    return /*#__PURE__*/ React.createElement(React.Fragment, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "Registered commands"
    }, tags.length ? tags.map(function(tag) {
        return /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
            key: tag.name,
            label: "/".concat(tag.name),
            subLabel: summarize(tag),
            subLabelLineClamp: 2,
            trailing: /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Stack, {
                direction: "horizontal",
                spacing: 8
            }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Button, {
                size: "sm",
                variant: "secondary",
                text: "Edit",
                accessibilityLabel: "Edit ".concat(tag.name),
                onPress: function onPress() {
                    return onEdit(tag);
                }
            }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Button, {
                size: "sm",
                variant: "destructive",
                text: "Delete",
                accessibilityLabel: "Delete ".concat(tag.name),
                onPress: function onPress() {
                    return confirmDelete(tag);
                }
            }))
        });
    }) : /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: "No custom commands yet."
    })), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Button, {
        text: "Create command",
        onPress: onCreate
    }));
}function MediaRow(param) {
    var media = param.media, onRemove = param.onRemove;
    var mimeType = isSaved(media) ? media.mimeType : media.type;
    var uri = isSaved(media) ? mediaUri(media) : media.uri;
    var kind = mimeType.startsWith('video/') ? 'Video' : 'Image';
    var size = new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 0
    }).format(media.fileSize / 1024);
    return /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: media.fileName,
        labelLineClamp: 1,
        subLabel: "".concat(kind, " \xb7 ").concat(size, " KB"),
        icon: mimeType.startsWith('image/') ? /*#__PURE__*/ React.createElement(window.ReactNative.Image, {
            source: {
                uri: uri
            },
            style: {
                borderRadius: 8,
                height: 48,
                width: 48
            }
        }) : /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow.Icon, {
            source: window.unbound.assets.getIDByName('VideoIcon')
        }),
        trailing: /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.IconButton, {
            size: "sm",
            variant: "secondary",
            icon: window.unbound.assets.getIDByName('XSmallIcon'),
            accessibilityLabel: "Remove ".concat(media.fileName),
            onPress: onRemove
        })
    });
}function _instanceof(left, right) {
    "@swc/helpers - instanceof";
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else return left instanceof right;
}
/**
 * @description Shows a toast titled with the plugin's name.
 * @param content The toast's text.
 */ function notify(content) {
    window.unbound.toasts.showToast({
        title: 'Custom Commands',
        content: content
    });
}
// UNKNOWN: a caught error can be any thrown value.
/**
 * @description Shows a caught error's message in a toast.
 * @param error The caught error.
 * @param fallback The text to show when the error has no message.
 */ function notifyError(error, fallback) {
    notify(_instanceof(error, Error) ? error.message : fallback);
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
function _sliced_to_array$2(arr, i) {
    return _array_with_holes$2(arr) || _iterable_to_array_limit$2(arr, i) || _unsupported_iterable_to_array$2(arr, i) || _non_iterable_rest$2();
}
function _to_consumable_array(arr) {
    return _array_without_holes(arr) || _iterable_to_array(arr) || _unsupported_iterable_to_array$2(arr) || _non_iterable_spread();
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
function _unsupported_iterable_to_array$2(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$2(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$2(o, minLen);
}
function isBuiltInCommand(name) {
    var _Commands_BUILT_IN_COMMANDS;
    var commands = (_Commands_BUILT_IN_COMMANDS = Commands.BUILT_IN_COMMANDS) !== null && _Commands_BUILT_IN_COMMANDS !== void 0 ? _Commands_BUILT_IN_COMMANDS : [];
    return commands.some(function(command) {
        return command.displayName === name;
    });
}
function CommandForm(param) {
    var original = param.original, tags = param.tags, onClose = param.onClose;
    var _ref, _ref1, _ref2, _ref3;
    var _useState = _sliced_to_array$2(window.React.useState((_ref = original === null || original === void 0 ? void 0 : original.name) !== null && _ref !== void 0 ? _ref : ''), 2), name = _useState[0], setName = _useState[1];
    var _useState1 = _sliced_to_array$2(window.React.useState((_ref1 = original === null || original === void 0 ? void 0 : original.description) !== null && _ref1 !== void 0 ? _ref1 : ''), 2), description = _useState1[0], setDescription = _useState1[1];
    var _useState2 = _sliced_to_array$2(window.React.useState((_ref2 = original === null || original === void 0 ? void 0 : original.message) !== null && _ref2 !== void 0 ? _ref2 : ''), 2), message = _useState2[0], setMessage = _useState2[1];
    var _useState3 = _sliced_to_array$2(window.React.useState((_ref3 = original === null || original === void 0 ? void 0 : original.media) !== null && _ref3 !== void 0 ? _ref3 : []), 2), media = _useState3[0], setMedia = _useState3[1];
    var _useState4 = _sliced_to_array$2(window.React.useState(false), 2), picking = _useState4[0], setPicking = _useState4[1];
    var _useState5 = _sliced_to_array$2(window.React.useState(false), 2), saving = _useState5[0], setSaving = _useState5[1];
    var detectedArguments = parseTagArguments(message);
    function addMedia() {
        return _async_to_generator$1(function() {
            var picked, error;
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (picking) return [
                            2
                        ];
                        setPicking(true);
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            3,
                            4,
                            5
                        ]);
                        return [
                            4,
                            pickMedia()
                        ];
                    case 2:
                        picked = _state.sent();
                        if (media.length + picked.length > MAX_ATTACHMENTS) {
                            throw new Error("A command can have at most ".concat(MAX_ATTACHMENTS, " attachments."));
                        }
                        setMedia(function(current) {
                            return _to_consumable_array(current).concat(_to_consumable_array(picked));
                        });
                        return [
                            3,
                            5
                        ];
                    case 3:
                        error = _state.sent();
                        notifyError(error, 'The command could not be saved.');
                        return [
                            3,
                            5
                        ];
                    case 4:
                        setPicking(false);
                        return [
                            7
                        ];
                    case 5:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function save() {
        return _async_to_generator$1(function() {
            var _validateTag, fields, problem, error;
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (saving) return [
                            2
                        ];
                        fields = {
                            name: name.trim().toLowerCase(),
                            description: description.trim(),
                            message: message
                        };
                        problem = (_validateTag = validateTag(_object_spread_props$1(_object_spread$1({}, fields), {
                            media: media.filter(isSaved)
                        }), tags, original === null || original === void 0 ? void 0 : original.name, media.length)) !== null && _validateTag !== void 0 ? _validateTag : isBuiltInCommand(fields.name) ? 'This command name is already used by Discord.' : null;
                        if (problem) {
                            notify(problem);
                            return [
                                2
                            ];
                        }
                        setSaving(true);
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            3,
                            4,
                            5
                        ]);
                        return [
                            4,
                            saveTag(fields, media, original)
                        ];
                    case 2:
                        _state.sent();
                        onClose();
                        notify("Saved /".concat(fields.name, "."));
                        return [
                            3,
                            5
                        ];
                    case 3:
                        error = _state.sent();
                        notifyError(error, 'The command could not be saved.');
                        return [
                            3,
                            5
                        ];
                    case 4:
                        setSaving(false);
                        return [
                            7
                        ];
                    case 5:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    return /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Stack, {
        spacing: 16
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroupTitle, {
        title: original ? 'Edit command' : 'Create command'
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TextInput, {
        title: "Command name",
        placeholder: "greet",
        autoCapitalize: "none",
        autoCorrect: false,
        value: name,
        onChange: setName
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TextInput, {
        title: "Description (optional)",
        placeholder: "Shown in the slash-command list",
        autoCapitalize: "none",
        autoCorrect: false,
        maxLength: MAX_DESCRIPTION_LENGTH,
        value: description,
        onChange: setDescription
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TextInput, {
        title: "Response",
        placeholder: "Hello {{user}}! I am feeling {{mood = great}}.",
        helpText: "Use {{argument}} for required text or {{argument = default}} for optional text. Type \\n for a line break. Every command also has an optional ephemeral switch.",
        autoCapitalize: "none",
        autoCorrect: false,
        multiline: true,
        value: message,
        onChange: setMessage
    }), detectedArguments.length ? /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Text, {
        variant: "text-sm/normal",
        color: "text-muted"
    }, "Arguments: ", detectedArguments.map(function(argument) {
        return argument.name;
    }).join(', ')) : null, media.length ? /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, null, media.map(function(item, index) {
        return /*#__PURE__*/ React.createElement(MediaRow, {
            key: isSaved(item) ? item.storedName : "".concat(item.uri, "-").concat(index),
            media: item,
            onRemove: function onRemove() {
                return setMedia(function(current) {
                    return current.filter(function(_, position) {
                        return position !== index;
                    });
                });
            }
        });
    })) : null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Button, {
        variant: "secondary",
        text: picking ? 'Opening Photos…' : 'Attach media',
        onPress: function onPress() {
            return void addMedia();
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Button, {
        text: saving ? 'Saving…' : original ? 'Save command' : 'Create command',
        onPress: function onPress() {
            return void save();
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Button, {
        variant: "tertiary",
        text: "Cancel",
        onPress: onClose
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
// The multiline response field can cover Save and Cancel, so a tap anywhere else closes the keyboard.
function dismissKeyboardOutsideInput(param) {
    var target = param.target;
    var focused = window.ReactNative.TextInput.State.currentlyFocusedInput();
    if (!focused || target === focused) return;
    if (Number(target) === window.ReactNative.TextInput.State.currentlyFocusedField()) return;
    window.ReactNative.Keyboard.dismiss();
}
function SettingsPanel() {
    settings.useSettingsStore();
    var tags = getTags();
    var _useState = _sliced_to_array$1(window.React.useState(null), 2), editing = _useState[0], setEditing = _useState[1];
    return /*#__PURE__*/ React.createElement(Page, null, /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            gap: 24
        },
        onTouchStart: dismissKeyboardOutsideInput
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Text, {
        variant: "text-md/normal",
        color: "text-muted"
    }, "Create slash commands that send saved text, images, and videos."), editing ? /*#__PURE__*/ React.createElement(CommandForm, {
        original: editing === 'new' ? null : editing,
        tags: tags,
        onClose: function onClose() {
            return setEditing(null);
        }
    }) : /*#__PURE__*/ React.createElement(CommandList, {
        tags: tags,
        onCreate: function onCreate() {
            return setEditing('new');
        },
        onEdit: setEditing
    })));
}function createOption(name, type, description, required) {
    return {
        name: name,
        displayName: name,
        type: type,
        description: description,
        displayDescription: description,
        required: required
    };
}
// A stable negative id per name, outside the range of real snowflakes.
function getCommandId(name) {
    var hash = 0;
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = name[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var character = _step.value;
            hash = Math.imul(hash, 31) + character.charCodeAt(0) >>> 0;
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
    return String(-9e9 - hash);
}
/**
 * @description Builds the built-in slash command for a saved command.
 * @param tag The saved command.
 * @param send Sends the command; it receives the tag's name so it reads the latest saved version.
 * @returns A command in the shape of Discord's built-in commands.
 */ function createCommand(tag, send) {
    var description = getTagDescription(tag);
    var options = parseTagArguments(tag.message).map(function(argument) {
        return createOption(argument.name, ApplicationCommandOptionType.String, argument.name, argument.defaultValue === null);
    });
    options.push(createOption('ephemeral', ApplicationCommandOptionType.Boolean, 'Only show the response to you', false));
    return {
        id: getCommandId(tag.name),
        untranslatedName: tag.name,
        displayName: tag.name,
        type: ApplicationCommandType.Chat,
        inputType: ApplicationCommandInputType.BuiltInText,
        applicationId: '-1',
        untranslatedDescription: description,
        displayDescription: description,
        options: options,
        execute: function execute(args, context) {
            return send(tag.name, args, context);
        }
    };
}
/**
 * @description Adds a command for each saved tag to a chat-input query of Discord's built-in commands.
 * @param types The command types the query asked for.
 * @param commands The query's result, extended in place.
 * @param tags The saved commands.
 * @param send Sends a command when it runs.
 */ function appendSavedCommands(types, commands, tags, send) {
    if (!types.includes(ApplicationCommandType.Chat)) return;
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        var _loop = function() {
            var tag = _step.value;
            // The result may already hold this command from an earlier call, or a built-in with its name.
            if (commands.some(function(command) {
                return command.displayName === tag.name;
            })) {
                return "continue";
            }
            commands.push(createCommand(tag, send));
        };
        for(var _iterator = tags[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true)_loop();
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
function uploadMedia(media, channelId) {
    return _async_to_generator(function() {
        var uploads;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    if (!media.length) return [
                        2,
                        []
                    ];
                    if (!CloudUploader.CloudUpload) {
                        throw new Error('Discord file uploads are unavailable.');
                    }
                    uploads = media.map(function(item, index) {
                        var _item_duration;
                        var uri = mediaUri(item);
                        var file = {
                            id: "custom-commands-".concat(Date.now(), "-").concat(index),
                            origin: 1,
                            uri: uri,
                            originalUri: uri,
                            mimeType: item.mimeType,
                            width: item.width,
                            height: item.height,
                            filename: item.fileName,
                            playableDuration: (_item_duration = item.duration) !== null && _item_duration !== void 0 ? _item_duration : null,
                            platform: 0,
                            createdUsingInAppCamera: false,
                            progress: 0
                        };
                        return new CloudUploader.CloudUpload(file, channelId, index, true);
                    });
                    return [
                        4,
                        Promise.all(uploads.map(function(upload) {
                            return upload.upload();
                        }))
                    ];
                case 1:
                    _state.sent();
                    if (uploads.some(function(upload) {
                        return upload.status !== 'COMPLETED';
                    })) {
                        throw new Error('An attachment failed to upload.');
                    }
                    return [
                        2,
                        uploads
                    ];
            }
        });
    })();
}
/**
 * @description Sends a saved command's response, as a message with its attachments or as an ephemeral bot message.
 * @param name The command's name; the latest saved version is sent.
 * @param options The options Discord passed to the command.
 * @param context The channel the command ran in.
 * @returns A promise that settles once the message is sent. On failure it shows a toast and rejects.
 */ function sendTag(name, options, context) {
    return _async_to_generator(function() {
        var _context_channel, tag, channelId, ephemeral, content, _ref, _PendingReplyStore_getPendingReply, _Messages_getSendMessageOptionsForReply, pendingReply, replyOptions, attachmentsToUpload, result, error;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    tag = getTags().find(function(entry) {
                        return entry.name === name;
                    });
                    channelId = (_context_channel = context.channel) === null || _context_channel === void 0 ? void 0 : _context_channel.id;
                    if (!tag || !channelId) return [
                        2
                    ];
                    ephemeral = getOptionValue(options, 'ephemeral') === true;
                    content = renderTagMessage(tag.message, options);
                    if (ephemeral && tag.media.length) {
                        notify('Commands with attachments cannot be sent ephemerally.');
                        return [
                            2
                        ];
                    }
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        4,
                        ,
                        5
                    ]);
                    if (ephemeral) {
                        Messages.sendBotMessage(channelId, {
                            content: content
                        });
                        return [
                            2
                        ];
                    }
                    // Optional: without the reply store, commands send as plain messages.
                    pendingReply = (_PendingReplyStore_getPendingReply = PendingReplyStore.getPendingReply) === null || _PendingReplyStore_getPendingReply === void 0 ? void 0 : _PendingReplyStore_getPendingReply.call(PendingReplyStore, channelId);
                    replyOptions = (_ref = (_Messages_getSendMessageOptionsForReply = Messages.getSendMessageOptionsForReply) === null || _Messages_getSendMessageOptionsForReply === void 0 ? void 0 : _Messages_getSendMessageOptionsForReply.call(Messages, pendingReply)) !== null && _ref !== void 0 ? _ref : {};
                    return [
                        4,
                        uploadMedia(tag.media, channelId)
                    ];
                case 2:
                    attachmentsToUpload = _state.sent();
                    return [
                        4,
                        Messages._sendMessage(channelId, {
                            content: content,
                            tts: false,
                            invalidEmojis: [],
                            validNonShortcutEmojis: []
                        }, _object_spread_props(_object_spread({}, replyOptions), {
                            attachmentsToUpload: attachmentsToUpload
                        }))
                    ];
                case 3:
                    result = _state.sent();
                    if ((result === null || result === void 0 ? void 0 : result.ok) === false) {
                        throw new Error("Discord rejected the message (".concat(result.status, ")."));
                    }
                    if (pendingReply) {
                        Dispatcher.dispatch({
                            type: 'DELETE_PENDING_REPLY',
                            channelId: channelId
                        });
                    }
                    return [
                        3,
                        5
                    ];
                case 4:
                    error = _state.sent();
                    notifyError(error, 'The command could not be sent.');
                    throw error;
                case 5:
                    return [
                        2
                    ];
            }
        });
    })();
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
/**
 * @description Lists the saved commands among Discord's built-in slash commands.
 * @returns A function that removes the patch.
 */ function patchCommands() {
    return Patcher.after(Commands, 'getBuiltInCommands', function(param) {
        var _param_args = _sliced_to_array(param.args, 1), types = _param_args[0], result = param.result;
        if (!Array.isArray(types) || !Array.isArray(result)) return;
        appendSavedCommands(types, result, getTags(), sendTag);
    });
}var dispose = function dispose() {};
function start() {
    if (!ensureModules('Custom Commands', {
        Commands: Commands,
        Messages: Messages
    })) return;
    dispose = applyFeatures('Custom Commands', [
        patchCommands
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