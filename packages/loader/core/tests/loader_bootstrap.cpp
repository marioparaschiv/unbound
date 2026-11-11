#include <cassert>
#include <optional>
#include <string>

#include "LoaderBootstrap.h"
#include "LoaderLog.h"

namespace {
int reads = 0;

std::optional<std::string> countingSource(const std::string &name)
{
    reads++;
    if (name == "missing")
    {
        return std::nullopt;
    }
    if (name == "empty")
    {
        return std::string();
    }
    return "source of " + name;
}

// iOS's %ctor starts the loader on another thread while the image's static initializers still
// run, so the source can be set before LoaderBootstrap.cpp's own globals are initialized. This
// test's initializer runs before the library's, which reproduces that order.
struct EarlySource {
    EarlySource()
    {
        loader::bootstrap::setScriptSource(countingSource);
    }
};
EarlySource earlySource;
}

int main()
{
    // A source set before the library's static initializers survives them.
    assert(loader::bootstrap::script("native-ui-scope-cache") == "source of native-ui-scope-cache");

    // A found script is read once.
    reads = 0;
    assert(loader::bootstrap::script("native-ui-scope-cache") == "source of native-ui-scope-cache");
    assert(reads == 0);

    // A missing or empty script is read again on the next lookup, so a transient miss heals, and
    // is logged once per name.
    int errors = 0;
    loader::setLogSink([&errors](loader::LogLevel level, const std::string &, const std::string &) {
        errors += level == loader::LogLevel::Error;
    });
    assert(!loader::bootstrap::script("missing"));
    assert(!loader::bootstrap::script("missing"));
    assert(reads == 2);
    assert(!loader::bootstrap::script("empty"));
    assert(reads == 3);
    assert(errors == 2);
    loader::setLogSink(nullptr);

    // A new source replaces every cached script.
    loader::bootstrap::setScriptSource([](const std::string &name) -> std::optional<std::string> {
        return "next " + name;
    });
    assert(loader::bootstrap::script("native-ui-scope-cache") == "next native-ui-scope-cache");

    loader::bootstrap::setScriptSource(nullptr);
    assert(!loader::bootstrap::script("native-ui-scope-cache"));
    return 0;
}
