#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <hermes/hermes.h>
#include <jsi/jsi.h>
#include <memory>
#include <sstream>
#include <string>

#include "LoaderBootstrap.h"
#include "NativePluginRuntime.h"
#include "NativeUIScope.h"

namespace jsi = facebook::jsi;

static void require(bool condition, const std::string &check)
{
    if (!condition)
    {
        std::fprintf(stderr, "native UI scope check failed: %s\n", check.c_str());
        std::exit(1);
    }
}

static std::string thrownMessage(jsi::Runtime &runtime, const std::string &source)
{
    try
    {
        runtime.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(source), "scope.js");
    }
    catch (const jsi::JSError &error)
    {
        return error.getMessage();
    }
    return "";
}

static std::optional<std::string> bootstrapScript(const std::string &name)
{
    std::ifstream file(std::string(UNBOUND_BOOTSTRAP_DIR) + "/" + name + ".js");
    if (!file)
    {
        return std::nullopt;
    }
    std::stringstream contents;
    contents << file.rdbuf();
    return contents.str();
}

int main()
{
    loader::bootstrap::setScriptSource(bootstrapScript);
    auto          hermes  = facebook::hermes::makeHermesRuntime();
    jsi::Runtime &runtime = *hermes;

    auto scope = std::make_shared<loader::native::UIScope>(loader::kNoAddon,
                                                           std::vector<std::string>{"tap"});
    require(scope->allows("tap") && !scope->allows("tapAsync"), "allows only listed paths");

    int           built    = 0;
    int           released = 0;
    jsi::Runtime *seen     = nullptr;
    jsi::Object   object   = loader::native::makeUIScopeObject(
        runtime, scope, {"ui"}, [&](jsi::Runtime &rt, const std::string &name) {
            built++;
            jsi::Object ui(rt);
            ui.setProperty(rt, "name", jsi::String::createFromUtf8(rt, name));
            ui.setProperty(rt, "hook",
                           loader::native::makeFunction(
                               rt, "hook", 0,
                               [&, scope](jsi::Runtime &inner, const jsi::Value &,
                                          const jsi::Value *, size_t) {
                                   return scope->hook(
                                       inner,
                                       [&]() -> std::pair<jsi::Value, std::function<void()>> {
                                           seen = loader::native::currentUIScopeRuntime();
                                           return {jsi::Value(7), [&] {
                                                       released++;
                                                   }};
                                       });
                               }));
            return ui;
        });
    runtime.global().setProperty(runtime, "scope", object);

    jsi::Value hooked = runtime.evaluateJavaScript(
        std::make_shared<jsi::StringBuffer>(
            "scope.ui === scope.ui && scope.ui.name === 'ui' && scope.other === undefined ? "
            "scope.ui.hook() : -1"),
        "scope.js");
    require(hooked.isNumber() && hooked.getNumber() == 7, "a namespace is cached and hooks run");
    require(built == 1, "a namespace is built once per scope");
    require(seen == &runtime, "a hook installs with the scope's runtime current");
    require(loader::native::currentUIScopeRuntime() == nullptr, "the runtime resets after a hook");

    runtime.evaluateJavaScript(
        std::make_shared<jsi::StringBuffer>("scope.dispose(); scope.dispose();"), "scope.js");
    require(released == 1, "dispose releases each hook once");
    require(!scope->active(), "dispose deactivates the scope");
    require(!thrownMessage(runtime, "scope.ui.hook()").empty(),
            "a disposed scope rejects new hooks");
    require(released == 1, "a rejected hook installs nothing");

    std::puts("native UI scope checks passed");
    return 0;
}
