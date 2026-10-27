#pragma once

#include <cstddef>
#include <optional>
#include <string>
#include <string_view>

namespace loader::crypto {
constexpr size_t kSHA256Bytes           = 32;
constexpr size_t kAESBlockBytes         = 16;
constexpr size_t kAES256KeyBytes        = 32;
constexpr size_t kEd25519PublicKeyBytes = 32;
constexpr size_t kEd25519SignatureBytes = 64;

std::string                sha256(std::string_view data);
std::string                hmacSHA256(std::string_view key, std::string_view message);
std::optional<std::string> aes256CBCEncrypt(std::string_view key, std::string_view iv,
                                            std::string_view plaintext);
std::optional<std::string> aes256CBCDecrypt(std::string_view key, std::string_view iv,
                                            std::string_view ciphertext);
bool                       constantTimeEqual(std::string_view left, std::string_view right);
std::optional<std::string> randomBytes(size_t count);
bool                       verifyEd25519(std::string_view message, std::string_view signature,
                                         std::string_view publicKey);
std::string                hex(std::string_view bytes);
}
