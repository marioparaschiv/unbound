#include <cassert>
#include <string>
#include <vector>

#include "LoaderNativeLogLines.h"

using loader::LogLevel;
using loader::LogSource;

static std::vector<std::string> split(const std::vector<std::string> &chunks, std::size_t maximum,
                                      bool flush = false)
{
    loader::NativeLogLineSplitter splitter(maximum);
    std::vector<std::string>      lines;
    auto                          emit = [&](std::string line) {
        lines.push_back(std::move(line));
    };
    for (const std::string &chunk : chunks)
    {
        splitter.feed(chunk, emit);
    }
    if (flush)
    {
        splitter.flush(emit);
    }
    return lines;
}

static void splitsLines()
{
    assert((split({"one\ntw", "o\r\nthree"}, 64) == std::vector<std::string>{"one", "two"}));
    assert((split({"one\ntw", "o\r\nthree"}, 64, true) ==
            std::vector<std::string>{"one", "two", "three"}));
    assert((split({"abcdefgh\n"}, 3) == std::vector<std::string>{"abc", "def", "gh"}));
    // "é" is two bytes; a cut at byte 3 would split it, so the cut moves back one byte.
    assert((split({"ab\xC3\xA9xy\n"}, 3) == std::vector<std::string>{"ab", "\xC3\xA9x", "y"}));

    loader::NativeLogLineSplitter splitter(64);
    splitter.feed("partial", [](std::string) {});
    assert(splitter.hasPending());
}

static void replacesInvalidUtf8()
{
    assert(loader::validUtf8("ok \xE2\x9C\x93") == "ok \xE2\x9C\x93");
    assert(loader::validUtf8("a\xFF"
                             "b") == "a\xEF\xBF\xBD"
                                     "b");
    assert(loader::validUtf8("\xC3") == "\xEF\xBF\xBD");
    assert(loader::validUtf8("\xED\xA0\x80") == "\xEF\xBF\xBD\xEF\xBF\xBD\xEF\xBF\xBD");
}

static void sortsNSLogAndPrintf()
{
    auto line = loader::classifyNativeLogLine(
        "2024-05-01 10:11:12.345678+0200 Discord[1234:56789] Something happened  ");
    assert(line && line->source == LogSource::Native && line->level == LogLevel::Info);
    assert(line->message == "Something happened" && line->scope.empty());

    line = loader::classifyNativeLogLine("2024-05-01 10:11:12.345 Discord[1234:a1b2] [Foo] bar");
    assert(line && line->source == LogSource::Native && line->message == "[Foo] bar");

    line = loader::classifyNativeLogLine("plain printf output");
    assert(line && line->source == LogSource::Native && line->message == "plain printf output");

    assert(!loader::classifyNativeLogLine(""));
    assert(!loader::classifyNativeLogLine("   \r"));
    assert(!loader::classifyNativeLogLine("2024-05-01 10:11:12.345 Discord[1:2] "));
}

static void sortsReactNative()
{
    auto line = loader::classifyNativeLogLine(
        "2024-05-01 10:11:12.345 [warn][tid:main][RCTModuleData.mm:42] Module requires setup");
    assert(line && line->source == LogSource::ReactNative && line->level == LogLevel::Warning);
    assert(line->scope == "RCTModuleData.mm:42" && line->message == "Module requires setup");

    line = loader::classifyNativeLogLine("2024-05-01 10:11:12.345 [fatal][tid:main] [x] y");
    assert(line && line->level == LogLevel::Error && line->scope.empty() &&
           line->message == "[x] y");

    line = loader::classifyNativeLogLine("2024-05-01 10:11:12.345 [tid:main] untagged");
    assert(line && line->source == LogSource::ReactNative && line->level == LogLevel::Info);

    line = loader::classifyNativeLogLine(
        "2024-05-01 10:11:12.345 Discord[1:2] [com.facebook.react.log:native] Fabric ready");
    assert(line && line->source == LogSource::ReactNative && line->message == "Fabric ready");

    line = loader::classifyNativeLogLine("[native] Bridge loaded");
    assert(line && line->source == LogSource::ReactNative && line->message == "Bridge loaded");

    line = loader::classifyNativeLogLine("[RCTRootView] attached");
    assert(line && line->source == LogSource::ReactNative &&
           line->message == "[RCTRootView] attached");
}

static void skipsLinesCapturedElsewhere()
{
    assert(!loader::classifyNativeLogLine(
        "2024-05-01 10:11:12.345 [info][tid:com.facebook.react.JavaScript] 'hello'"));
    assert(!loader::classifyNativeLogLine(
        "2024-05-01 10:11:12.345 Discord[1:2] [com.facebook.react.log:javascript] hello"));
    assert(!loader::classifyNativeLogLine("[javascript] hello"));
    assert(!loader::classifyNativeLogLine(
        "2024-05-01 10:11:12.345 Discord[1:2] [app.unbound:updater] Checking"));
    assert(!loader::classifyNativeLogLine("2024-05-01 10:11:12.345 Discord[1:2] [plugins] Loaded"));

    auto line = loader::classifyNativeLogLine(
        "2024-05-01 10:11:12.345 [error][tid:com.facebook.react.JavaScript][RCTFoo.mm:3] Failed");
    assert(line && line->source == LogSource::ReactNative && line->level == LogLevel::Error);
}

int main()
{
    splitsLines();
    replacesInvalidUtf8();
    sortsNSLogAndPrintf();
    sortsReactNative();
    skipsLinesCapturedElsewhere();
    return 0;
}
