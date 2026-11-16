#include <cassert>
#include <filesystem>
#include <string>

#include "LoaderFiles.h"
#include "LoaderStrings.h"

namespace {
void fallsBackToEnglishWithoutATranslation()
{
    loader::setStrings("");
    assert(loader::text("UNBOUND_NATIVE_CLOSE", "Close") == "Close");
    assert(loader::text("UNBOUND_NATIVE_COUNT", "Closed {count} times", {{"count", "3"}})
           == "Closed 3 times");
}

void usesTheTranslationAndFillsItsPlaceholders()
{
    loader::setStrings(
        R"({"UNBOUND_NATIVE_CLOSE":"Schließen","UNBOUND_NATIVE_COUNT":"{count}× {count}","UNBOUND_NATIVE_EMPTY":""})");
    assert(loader::text("UNBOUND_NATIVE_CLOSE", "Close") == "Schließen");
    assert(loader::text("UNBOUND_NATIVE_COUNT", "Closed {count} times", {{"count", "3"}})
           == "3× 3");
    assert(loader::text("UNBOUND_NATIVE_EMPTY", "Empty") == "Empty");
}

void ignoresAnUnreadableFile()
{
    loader::setStrings("[1, 2]");
    assert(loader::text("UNBOUND_NATIVE_CLOSE", "Close") == "Close");
}

void loadsTheClientsFileFromTheDocuments()
{
    std::filesystem::path root = std::filesystem::temp_directory_path() / "unbound-strings-test";
    std::filesystem::remove_all(root);
    std::filesystem::create_directories(root / "i18n");
    assert(loader::writeTextFileAtomically((root / loader::kLoaderStringsFile).string(),
                                           R"({"UNBOUND_NATIVE_CLOSE":"Fermer"})"));
    loader::loadStrings(root.string());
    assert(loader::text("UNBOUND_NATIVE_CLOSE", "Close") == "Fermer");
    loader::setStrings("");
}
}

int main()
{
    fallsBackToEnglishWithoutATranslation();
    usesTheTranslationAndFillsItsPlaceholders();
    ignoresAnUnreadableFile();
    loadsTheClientsFileFromTheDocuments();
    return 0;
}
