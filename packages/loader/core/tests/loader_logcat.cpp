#include <cassert>
#include <optional>
#include <string>
#include <vector>

#include "LoaderLogcat.h"

static void parsesAnEpochLine()
{
    std::optional<loader::LogEntry> entry =
        loader::logcatEntry("1793134800.123  4321  4350 W ReactNativeJNI: Bridge: slow call\n");
    assert(entry);
    assert(entry->time == 1793134800123LL);
    assert(entry->source == loader::LogSource::ReactNative);
    assert(entry->level == loader::LogLevel::Warning);
    assert(entry->scope == std::vector<std::string>{"ReactNativeJNI"});
    assert(entry->message == "Bridge: slow call");
}

static void trimsPaddedTagsAndLeadingSpaces()
{
    std::optional<loader::LogEntry> entry =
        loader::logcatEntry("   17931348.005  4321  4321 I libc    : opened /dev/null");
    assert(entry);
    assert(entry->time == 17931348005LL);
    assert(entry->source == loader::LogSource::Native);
    assert(entry->scope == std::vector<std::string>{"libc"});
    assert(entry->message == "opened /dev/null");
}

static void keepsEmptyMessages()
{
    std::optional<loader::LogEntry> trailing = loader::logcatEntry("1.000 1 1 D chatty: ");
    std::optional<loader::LogEntry> bare     = loader::logcatEntry("1.000 1 1 D chatty:");
    assert(trailing && trailing->message.empty() && trailing->scope[0] == "chatty");
    assert(bare && bare->message.empty() && bare->scope[0] == "chatty");
}

static void keepsOnlyMillisecondsOfFinerTimes()
{
    std::optional<loader::LogEntry> entry = loader::logcatEntry("12.345678 1 1 I tag: message");
    assert(entry && entry->time == 12345);
}

static void mapsEveryPriority()
{
    auto level = [](char priority) {
        std::string line = std::string("1.000 1 1 ") + priority + " tag: message";
        return loader::logcatEntry(line);
    };
    assert(level('V')->level == loader::LogLevel::Debug);
    assert(level('D')->level == loader::LogLevel::Debug);
    assert(level('I')->level == loader::LogLevel::Info);
    assert(level('W')->level == loader::LogLevel::Warning);
    assert(level('E')->level == loader::LogLevel::Error);
    assert(level('F')->level == loader::LogLevel::Error);
    assert(level('A')->level == loader::LogLevel::Error);
    assert(!level('S'));
}

static void skipsBannersAndMalformedLines()
{
    assert(!loader::logcatEntry("--------- beginning of main"));
    assert(!loader::logcatEntry(""));
    assert(!loader::logcatEntry("1.000 1 1 I no separator here"));
    assert(!loader::logcatEntry("1.000 1 I tag: missing tid"));
    assert(!loader::logcatEntry("1.000 1 1 I : empty tag"));
}

static void skipsTagsCapturedElsewhere()
{
    assert(!loader::logcatEntry("1.000 1 1 I Unbound : [Loader] ready"));
    assert(!loader::logcatEntry("1.000 1 1 I ReactNativeJS: console line"));
    assert(!loader::logcatEntry("1.000 1 1 I unknown:ReactNativeJS: console line"));
}

static void classifiesReactNativeTags()
{
    for (const char *tag :
         {"ReactNative", "ReactNativeJNI", "unknown:ReactNative", "ReactHost", "unknown:ReactHost",
          "FabricUIManager", "Fabric", "SoLoader", "HermesVM", "hermes", "unknown:BridgelessReact",
          "MountingManager", "unknown:ViewManagerPropertyUpdater", "jni_lib_merge"})
    {
        assert(loader::logcatTagSource(tag) == loader::LogSource::ReactNative);
    }
    for (const char *tag : {"libc", "OpenGLRenderer", "chromium", "AndroidRuntime", "DEBUG"})
    {
        assert(loader::logcatTagSource(tag) == loader::LogSource::Native);
    }
}

static void formatsTimesForTheTailOption()
{
    assert(loader::logcatTime(1793134800005LL) == "1793134800.005");
    assert(loader::logcatTime(999) == "0.999");
}

int main()
{
    parsesAnEpochLine();
    trimsPaddedTagsAndLeadingSpaces();
    keepsEmptyMessages();
    keepsOnlyMillisecondsOfFinerTimes();
    mapsEveryPriority();
    skipsBannersAndMalformedLines();
    skipsTagsCapturedElsewhere();
    classifiesReactNativeTags();
    formatsTimesForTheTailOption();
    return 0;
}
