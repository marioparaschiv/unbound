#include "NativePlatformFiles.h"

#include "LoaderFiles.h"
#include "NativePluginRuntime.h"

namespace loader {
namespace jsi = facebook::jsi;

// The path argument as a file inside `documents`, or nothing when it is missing or escapes it.
static std::optional<std::string> resolvePath(jsi::Runtime &runtime, const std::string &documents,
                                              const jsi::Value *args, size_t count)
{
    if (count == 0 || !args[0].isString())
    {
        return std::nullopt;
    }
    const std::string relative = args[0].getString(runtime).utf8(runtime);
    if (!isContainedRelativePath(relative))
    {
        return std::nullopt;
    }
    return resolveInsideDirectory(documents, relative);
}

jsi::Object filesBridge(jsi::Runtime &runtime, const std::string &documents)
{
    jsi::Object files(runtime);
    files.setProperty(
        runtime, "remove",
        native::makeFunction(runtime, "remove", 1,
                             [documents](jsi::Runtime     &rt, const jsi::Value &,
                                         const jsi::Value *args, size_t count) -> jsi::Value {
                                 if (count == 0 || !args[0].isString())
                                 {
                                     return jsi::Value(false);
                                 }
                                 return jsi::Value(
                                     removeTree(documents, args[0].getString(rt).utf8(rt)));
                             }));
    files.setProperty(
        runtime, "read",
        native::makeFunction(runtime, "read", 1,
                             [documents](jsi::Runtime     &rt, const jsi::Value &,
                                         const jsi::Value *args, size_t count) -> jsi::Value {
                                 std::optional<std::string> path =
                                     resolvePath(rt, documents, args, count);
                                 std::optional<std::string> text =
                                     path ? readTextFile(*path) : std::nullopt;
                                 return text ? jsi::Value(jsi::String::createFromUtf8(rt, *text))
                                             : jsi::Value::undefined();
                             }));
    files.setProperty(
        runtime, "write",
        native::makeFunction(
            runtime, "write", 2,
            [documents](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
                        size_t count) -> jsi::Value {
                std::optional<std::string> path = resolvePath(rt, documents, args, count);
                if (!path || count < 2 || !args[1].isString())
                {
                    return jsi::Value(false);
                }
                return jsi::Value(writeTextFileAtomically(*path, args[1].getString(rt).utf8(rt)));
            }));
    return files;
}
}
