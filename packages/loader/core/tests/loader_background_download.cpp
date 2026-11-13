#include <cassert>
#include <filesystem>
#include <map>
#include <optional>
#include <string>

#include "LoaderBackgroundDownload.h"
#include "LoaderFiles.h"

namespace {
const std::string kURL = "https://builds.unbound.rip/unbound.98.bundle";

std::string scratch(const std::string &name)
{
    std::filesystem::path root = std::filesystem::temp_directory_path() / "unbound-background";
    std::filesystem::create_directories(root);
    std::string path = (root / name).string();
    loader::removeFile(path);
    loader::removeFile(path + loader::kBackgroundDownloadSuffix);
    loader::removeFile(path + loader::kBackgroundDownloadURLSuffix);
    return path;
}

void finishedDownloadsAreAdoptedOnce()
{
    std::string destination = scratch("adopt.candidate");
    std::string downloaded  = destination + ".tmp";
    assert(loader::writeTextFileAtomically(downloaded, "bundle"));
    assert(loader::finishBackgroundDownload(kURL, destination, downloaded));
    assert(!loader::fileExists(downloaded));

    std::optional<loader::DownloadResult> adopted =
        loader::adoptBackgroundDownload(kURL, destination);
    assert(adopted && adopted->status == 200);
    assert(loader::readTextFile(destination) == "bundle");
    assert(!loader::adoptBackgroundDownload(kURL, destination));
}

void downloadsOfAnotherURLAreDiscarded()
{
    std::string destination = scratch("stale.candidate");
    std::string downloaded  = destination + ".tmp";
    assert(loader::writeTextFileAtomically(downloaded, "old"));
    assert(loader::finishBackgroundDownload(kURL + "?old", destination, downloaded));

    assert(!loader::adoptBackgroundDownload(kURL, destination));
    assert(!loader::fileExists(destination + loader::kBackgroundDownloadSuffix));
    assert(!loader::fileExists(destination + loader::kBackgroundDownloadURLSuffix));
}

void failedDownloadsContinueInTheBackground()
{
    std::string            destination = scratch("handoff.candidate");
    int                    foreground  = 0;
    int                    collected   = 0;
    std::string            handedOff;
    loader::FileDownloader download = loader::withBackgroundHandoff(
        [&](const std::string &, const std::string &, const std::map<std::string, std::string> &,
            const loader::DownloadPolicy &) -> std::optional<loader::DownloadResult> {
            foreground++;
            return std::nullopt;
        },
        loader::BackgroundDownloader{[&](const std::string &) {
                                         collected++;
                                     },
                                     [&](const std::string &url, const std::string &,
                                         const std::map<std::string, std::string> &) {
                                         handedOff = url;
                                     }});

    assert(!download(kURL, destination, {}, loader::DownloadPolicy{}));
    assert(foreground == 1 && collected == 1 && handedOff == kURL);

    std::string downloaded = destination + ".tmp";
    assert(loader::writeTextFileAtomically(downloaded, "late"));
    assert(loader::finishBackgroundDownload(kURL, destination, downloaded));
    handedOff.clear();
    std::optional<loader::DownloadResult> result =
        download(kURL, destination, {}, loader::DownloadPolicy{});
    assert(result && result->status == 200);
    assert(foreground == 1 && collected == 2 && handedOff.empty());
    assert(loader::readTextFile(destination) == "late");
}
}

int main()
{
    finishedDownloadsAreAdoptedOnce();
    downloadsOfAnotherURLAreDiscarded();
    failedDownloadsContinueInTheBackground();
    return 0;
}
