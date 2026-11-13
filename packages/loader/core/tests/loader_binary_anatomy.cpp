#include <cassert>
#include <cstring>
#include <string>

#include "LoaderBinaryAnatomy.h"

#include "vectors/CMSVectors.h"

namespace binary = loader::binary;

namespace {
void put32(std::string &image, uint32_t value)
{
    char bytes[4];
    std::memcpy(bytes, &value, sizeof(bytes));
    image.append(bytes, sizeof(bytes));
}

std::string dylibCommand(const std::string &path)
{
    std::string command;
    uint32_t    size = static_cast<uint32_t>((24 + path.size() + 1 + 7) & ~size_t{7});
    put32(command, binary::kLoadDylib);
    put32(command, size);
    put32(command, 24);
    put32(command, 0);
    put32(command, 0);
    put32(command, 0);
    command += path;
    command.resize(size, '\0');
    return command;
}

std::string image()
{
    std::string commands;
    put32(commands, binary::kUUIDCommand);
    put32(commands, 24);
    for (int index = 0; index < 16; index++)
    {
        commands += static_cast<char>(0xa0 + index);
    }
    put32(commands, binary::kEncryptionInfo64);
    put32(commands, 24);
    put32(commands, 0);
    put32(commands, 0);
    put32(commands, 0);
    put32(commands, 0);
    put32(commands, binary::kBuildVersion);
    put32(commands, 24);
    put32(commands, 2);
    put32(commands, 0x000f0000);
    put32(commands, 0x001a0100);
    put32(commands, 0);
    commands += dylibCommand("/usr/lib/libSystem.B.dylib");
    commands += dylibCommand("@rpath/Discord.framework/Discord");
    commands += dylibCommand("@executable_path/Frameworks/Tweak.dylib");

    std::string header;
    put32(header, 0xfeedfacf);
    put32(header, 0x0100000c);
    put32(header, 0);
    put32(header, 2);
    put32(header, 6);
    put32(header, static_cast<uint32_t>(commands.size()));
    put32(header, 0);
    put32(header, 0);
    return header + commands;
}

void readsLoadCommands()
{
    std::optional<binary::Anatomy> anatomy = binary::parseAnatomy(image());
    assert(anatomy);
    assert(anatomy->uuid == "A0A1A2A3-A4A5-A6A7-A8A9-AAABACADAEAF");
    assert(anatomy->cryptid == 0u);
    assert(anatomy->minimumOS == "15.0");
    assert(anatomy->sdk == "26.1");
    assert(anatomy->dylibs.size() == 3);
    assert(binary::anatomyLine(*anatomy, "/var/containers/Bundle/Application/X/Discord.app") ==
           "decrypted · min 15.0 · SDK 26.1 · 3 dylibs · 1 injected · UUID A0A1A2A3");
}

void rejectsOtherFiles()
{
    assert(!binary::parseAnatomy("not a mach-o image at all, padded to header size"));
}

void findsTheLeafSigner()
{
    assert(binary::cmsCertificates(vectors::kSignedCMS).size() == 2);
    std::optional<binary::Certificate> signer = binary::signer(vectors::kSignedCMS);
    assert(signer);
    assert(signer->commonName == "Apple Development: Someone (ABCDE12345)");
    assert(signer->organizationalUnit == "TEAM123456");
    assert(signer->issuerCommonName == "Test Root CA");
    assert(signer->fingerprint == vectors::kSignerFingerprint);
    assert(binary::signerLine(*signer) ==
           std::string("sha256 ") + vectors::kSignerFingerprint + " · Test Root CA");
}

void shortensAppleIssuers()
{
    assert(binary::shortIssuer("Apple Worldwide Developer Relations Certification Authority") ==
           "Apple WWDR CA");
    assert(binary::shortIssuer("Test Root CA") == "Test Root CA");
}

void survivesTruncatedSignatures()
{
    for (size_t length = 0; length < vectors::kSignedCMS.size(); length += 7)
    {
        binary::signer(vectors::kSignedCMS.substr(0, length));
    }
}
}

int main()
{
    readsLoadCommands();
    rejectsOtherFiles();
    findsTheLeafSigner();
    shortensAppleIssuers();
    survivesTruncatedSignatures();
    return 0;
}
