#include <cassert>
#include <filesystem>
#include <fstream>
#include <nlohmann/json.hpp>
#include <optional>
#include <sstream>
#include <string>

#include "LoaderGzip.h"
#include "LoaderLogFile.h"

static std::string read(const std::string &path)
{
    std::ifstream stream(path, std::ios::binary);
    std::stringstream buffer;
    buffer << stream.rdbuf();
    return buffer.str();
}

static std::string scratchDirectory(const char *name)
{
    std::filesystem::path directory = std::filesystem::temp_directory_path() / name;
    std::filesystem::remove_all(directory);
    return directory.string();
}

static void writesEntriesAsJSONLines()
{
    loader::LogEntry entry{1793134800123LL,
                           loader::LogSource::ReactNative,
                           loader::LogLevel::Warning,
                           {"Plugins", "Start"},
                           "slow \"start\""};
    assert(loader::logEntryLine(entry)
           == "{\"t\":1793134800123,\"src\":\"react-native\",\"lvl\":\"warn\","
              "\"scope\":[\"Plugins\",\"Start\"],\"msg\":\"slow \\\"start\\\"\"}\n");
    std::optional<loader::LogEntry> parsed =
        loader::logEntryFromJSON(nlohmann::json::parse(loader::logEntryLine(entry)));
    assert(parsed && parsed->time == entry.time && parsed->source == entry.source
           && parsed->level == entry.level && parsed->scope == entry.scope
           && parsed->message == entry.message);
    assert(!loader::logEntryFromJSON(nlohmann::json::parse("{\"msg\":\"no time\"}")));
}

static void replacesInvalidUTF8InsteadOfThrowing()
{
    loader::LogEntry entry{0,
                           loader::LogSource::Native,
                           loader::LogLevel::Info,
                           {},
                           "a\xff"
                           "z"};
    assert(loader::logEntryLine(entry).find("a\xEF\xBF\xBDz") != std::string::npos);
}

static void formatsEntriesAsPlainText()
{
    loader::LogEntry entry{1793134800123LL,
                           loader::LogSource::Unbound,
                           loader::LogLevel::Warning,
                           {"Loader", "plugins"},
                           "slow start"};
    assert(loader::formatLogEntry(entry)
           == "2026-10-27T21:00:00.123Z W unbound [Loader/plugins] slow start");
    entry.scope.clear();
    entry.source = loader::LogSource::JS;
    assert(loader::formatLogEntry(entry) == "2026-10-27T21:00:00.123Z W js slow start");
}

static void namesEachFileAfterItsStem()
{
    std::string directory = scratchDirectory("unbound-log-names");
    loader::RotatingLogFile file("native", 10, 3, 8);
    file.open(directory);
    file.append("aaaaaaaa\n");
    file.append("bbbbbbbb\n");
    assert(file.path(0) == directory + "/native.log");
    assert(read(directory + "/native.1.log") == "aaaaaaaa\n");
}

static void buffersLinesUntilOpened()
{
    std::string directory = scratchDirectory("unbound-log-buffer");
    loader::RotatingLogFile file("unbound", 1024, 3, 2);
    file.append("first\n");
    file.append("second\n");
    file.append("third\n");
    file.open(directory);
    file.append("fourth\n");
    assert(read(file.path(0)) == "second\nthird\nfourth\n");
}

static void rotatesAndKeepsOnlyTheNewestFiles()
{
    std::string directory = scratchDirectory("unbound-log-rotate");
    loader::RotatingLogFile file("unbound", 10, 3, 8);
    file.open(directory);
    for (const char *line : {"aaaaaaaa\n", "bbbbbbbb\n", "cccccccc\n", "dddddddd\n"})
    {
        file.append(line);
    }

    assert(read(file.path(0)) == "dddddddd\n");
    assert(read(file.path(1)) == "cccccccc\n");
    assert(read(file.path(2)) == "bbbbbbbb\n");
    assert(!std::filesystem::exists(file.path(3)));
}

static void compressesFilesPastThePlainOnes()
{
    std::string directory = scratchDirectory("unbound-log-compress");
    loader::RotatingLogFile file("unbound", 10, 2, 8, 2);
    file.open(directory);
    for (const char *line : {"aaaaaaaa\n", "bbbbbbbb\n", "cccccccc\n", "dddddddd\n", "eeeeeeee\n"})
    {
        file.append(line);
    }

    assert(read(file.path(0)) == "eeeeeeee\n");
    assert(read(file.path(1)) == "dddddddd\n");
    assert(file.compressedPath(0) == directory + "/unbound.2.log.gz");
    assert(loader::gunzipFile(file.compressedPath(0)) == "cccccccc\n");
    assert(loader::gunzipFile(file.compressedPath(1)) == "bbbbbbbb\n");
    assert(!std::filesystem::exists(directory + "/unbound.4.log.gz"));
}

static void appendsToAnExistingFileAcrossLaunches()
{
    std::string directory = scratchDirectory("unbound-log-reopen");
    {
        loader::RotatingLogFile file("unbound", 1024, 3, 8);
        file.open(directory);
        file.append("launch one\n");
    }

    loader::RotatingLogFile file("unbound", 1024, 3, 8);
    file.open(directory);
    file.append("launch two\n");
    assert(read(file.path(0)) == "launch one\nlaunch two\n");
}

static void placesLogsBesideTheOtherUnboundFiles()
{
    assert(loader::logFileDirectory("/var/mobile/Documents/Unbound")
           == "/var/mobile/Documents/Unbound/Logs");
}

int main()
{
    writesEntriesAsJSONLines();
    replacesInvalidUTF8InsteadOfThrowing();
    formatsEntriesAsPlainText();
    namesEachFileAfterItsStem();
    buffersLinesUntilOpened();
    rotatesAndKeepsOnlyTheNewestFiles();
    compressesFilesPastThePlainOnes();
    appendsToAnExistingFileAcrossLaunches();
    placesLogsBesideTheOtherUnboundFiles();
    return 0;
}
