#include <cassert>
#include <filesystem>
#include <string>

#include "LoaderStallMarker.h"

namespace {
const std::string kRecord = R"({"id":"chat-bubbles","name":"Chat Bubbles"})";

std::string freshDirectory()
{
    std::filesystem::path root =
        std::filesystem::temp_directory_path() / "unbound-stall-marker-test";
    std::filesystem::remove_all(root);
    std::filesystem::create_directories(root);
    return root.string();
}

void namesTheAddonThatStalledShortlyBeforeTheExit()
{
    std::string directory = freshDirectory();
    assert(loader::recordMainThreadStall(directory, kRecord, 1000));
    assert(loader::takeStallAddonBefore(directory, 6000) == kRecord);
    assert(loader::takeStallAddonBefore(directory, 6000).empty());
}

void ignoresStallsLongBeforeOrAfterTheExit()
{
    std::string directory = freshDirectory();
    assert(loader::recordMainThreadStall(directory, kRecord, 1000));
    assert(loader::takeStallAddonBefore(directory, 1000 + 3 * 60 * 1000).empty());
    assert(loader::recordMainThreadStall(directory, kRecord, 9000));
    assert(loader::takeStallAddonBefore(directory, 6000).empty());
}

void clearsTheMarkerOnRecoveryOrWithoutAnAddon()
{
    std::string directory = freshDirectory();
    assert(loader::recordMainThreadStall(directory, kRecord, 1000));
    loader::clearMainThreadStall(directory);
    assert(loader::takeStallAddonBefore(directory, 2000).empty());
    assert(loader::recordMainThreadStall(directory, kRecord, 1000));
    assert(!loader::recordMainThreadStall(directory, "", 1500));
    assert(loader::takeStallAddonBefore(directory, 2000).empty());
}
}

int main()
{
    namesTheAddonThatStalledShortlyBeforeTheExit();
    ignoresStallsLongBeforeOrAfterTheExit();
    clearsTheMarkerOnRecoveryOrWithoutAnAddon();
    return 0;
}
