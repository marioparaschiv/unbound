#include <cassert>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <string>

#include "LoaderLogFile.h"

static std::string read(const std::string &path)
{
    std::ifstream     stream(path, std::ios::binary);
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

static void formatsLinesWithUTCMillisecondsLevelAndCategory()
{
    std::string line =
        loader::logFileLine(loader::LogLevel::Warning, "plugins", "slow start", 1793134800123LL);
    assert(line == "2026-10-27T21:00:00.123Z W [plugins] slow start\n");
}

static void buffersLinesUntilOpened()
{
    std::string             directory = scratchDirectory("astral-log-buffer");
    loader::RotatingLogFile file(1024, 3, 2);
    file.append("first\n");
    file.append("second\n");
    file.append("third\n");
    file.open(directory);
    file.append("fourth\n");
    assert(read(file.path(0)) == "second\nthird\nfourth\n");
}

static void rotatesAndKeepsOnlyTheNewestFiles()
{
    std::string             directory = scratchDirectory("astral-log-rotate");
    loader::RotatingLogFile file(10, 3, 8);
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

static void appendsToAnExistingFileAcrossLaunches()
{
    std::string directory = scratchDirectory("astral-log-reopen");
    {
        loader::RotatingLogFile file(1024, 3, 8);
        file.open(directory);
        file.append("launch one\n");
    }
    loader::RotatingLogFile file(1024, 3, 8);
    file.open(directory);
    file.append("launch two\n");
    assert(read(file.path(0)) == "launch one\nlaunch two\n");
}

static void placesLogsBesideTheOtherAstralFiles()
{
    assert(loader::logFileDirectory("/var/mobile/Documents/astral") ==
           "/var/mobile/Documents/astral/Logs");
}

int main()
{
    formatsLinesWithUTCMillisecondsLevelAndCategory();
    buffersLinesUntilOpened();
    rotatesAndKeepsOnlyTheNewestFiles();
    appendsToAnExistingFileAcrossLaunches();
    placesLogsBesideTheOtherAstralFiles();
    return 0;
}
