#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace loader::binary {
constexpr uint32_t kSignatureSlot      = 0x10000;
constexpr uint32_t kBlobWrapperMagic   = 0xfade0b01;
constexpr uint32_t kEncryptionInfo64   = 0x2c;
constexpr uint32_t kUUIDCommand        = 0x1b;
constexpr uint32_t kBuildVersion       = 0x32;
constexpr uint32_t kVersionMinIPhoneOS = 0x25;
constexpr uint32_t kLoadDylib          = 0x0c;
constexpr uint32_t kLoadWeakDylib      = 0x80000018;
constexpr uint32_t kReexportDylib      = 0x8000001f;
constexpr uint32_t kCodeSignature      = 0x1d;

struct Anatomy {
    std::string              uuid;
    std::optional<uint32_t>  cryptid;
    std::string              minimumOS;
    std::string              sdk;
    uint32_t                 loadCommands = 0;
    std::vector<std::string> dylibs;
    std::string              signature;
};

struct Certificate {
    std::string commonName;
    std::string organizationalUnit;
    std::string organization;
    std::string issuerCommonName;
    std::string fingerprint;
};

std::optional<Anatomy>     readAnatomy(const std::string &executablePath);
std::optional<Anatomy>     parseAnatomy(const std::string &image);
std::vector<std::string>   cmsCertificates(const std::string &cms);
std::optional<Certificate> describeCertificate(const std::string &der);
std::optional<Certificate> signer(const std::string &cms);

std::string anatomyLine(const Anatomy &anatomy, const std::string &bundlePath);
std::string signerLine(const Certificate &certificate);
std::string shortIssuer(std::string issuer);
std::string versionString(uint32_t packed);
}
