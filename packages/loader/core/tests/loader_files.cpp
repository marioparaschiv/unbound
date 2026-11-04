#include <cassert>
#include <fcntl.h>
#include <filesystem>
#include <string>
#include <sys/stat.h>
#include <thread>
#include <unistd.h>

#include "LoaderFiles.h"

static std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-files-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

static void touch(const std::filesystem::path &path)
{
    std::filesystem::create_directories(path.parent_path());
    assert(loader::writeTextFileAtomically(path.string(), "x"));
}

static void readsWholeFiles(const std::filesystem::path &parent)
{
    assert(!loader::readTextFile((parent / "missing.txt").string()));

    const auto empty = parent / "empty.txt";
    assert(loader::writeTextFileAtomically(empty.string(), ""));
    assert(loader::readTextFile(empty.string()) == "");

    std::string binary(3 * 1024 * 1024 + 7, '\0');
    for (size_t index = 0; index < binary.size(); index++)
    {
        binary[index] = static_cast<char>(index * 31);
    }
    const auto large = parent / "large.bin";
    assert(loader::writeTextFileAtomically(large.string(), binary));
    assert(loader::readTextFile(large.string()) == binary);

    // A FIFO reports no size, so this covers the read-to-EOF path past the initial buffer.
    const auto fifo = parent / "pipe";
    assert(mkfifo(fifo.c_str(), 0600) == 0);
    const std::string streamed(200 * 1024, 'p');
    std::thread       writer([&] {
        int descriptor = open(fifo.c_str(), O_WRONLY);
        assert(descriptor >= 0);
        assert(write(descriptor, streamed.data(), streamed.size()) ==
               static_cast<ssize_t>(streamed.size()));
        close(descriptor);
    });
    assert(loader::readTextFile(fifo.string()) == streamed);
    writer.join();
}

int main()
{
    const auto parent = makeTemporaryDirectory();
    const auto root   = parent / "Unbound";

    readsWholeFiles(parent);

    touch(root / "Themes" / "a" / "manifest.json");
    touch(root / "Themes" / "a" / "nested" / "bundle.json");
    touch(root / "Themes" / "b" / "manifest.json");
    touch(parent / "outside.txt");

    assert(loader::removeTree(root.string(), "Themes/a"));
    assert(!std::filesystem::exists(root / "Themes" / "a"));
    assert(std::filesystem::exists(root / "Themes" / "b" / "manifest.json"));

    assert(loader::removeTree(root.string(), "Themes/b/manifest.json"));
    assert(!std::filesystem::exists(root / "Themes" / "b" / "manifest.json"));

    assert(!loader::removeTree(root.string(), "Themes/missing"));
    assert(!loader::removeTree(root.string(), ""));
    assert(!loader::removeTree(root.string(), "."));
    assert(!loader::removeTree(root.string(), "../outside.txt"));
    assert(!loader::removeTree(root.string(), "Themes/../../outside.txt"));
    assert(!loader::removeTree(root.string(), (parent / "outside.txt").string()));
    assert(std::filesystem::exists(parent / "outside.txt"));
    assert(std::filesystem::exists(root / "Themes"));

    std::filesystem::remove_all(parent);
    return 0;
}
