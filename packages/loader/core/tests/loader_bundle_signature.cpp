#include <cassert>
#include <string>

#include "LoaderBundleSignature.h"
#include "bundle_test_server.h"

static const std::string kPublicKey = "PUAXw+hDiVqStwqnTRt+vJyYLM8uxJaMwM1V8Sr0Zgw=";
static const std::string kSignature =
    "kqAJqfDUyrhyDoILX2QlQKKye1QWUD+Ps3YiI+vbadoIWsHkPhWZbkWPNhPQ8R2MOHsurrQwKu6wDSkWErsMAA==";
static const std::string kMessage = "r";

static void decodesBase64()
{
    assert(loader::decodeBase64("cg==") == std::string("r"));
    assert(loader::decodeBase64("Zm9vYmFy\n") == std::string("foobar"));
    assert(loader::decodeBase64(kPublicKey)->size() == 32);
    assert(loader::decodeBase64(kSignature)->size() == 64);
    assert(!loader::decodeBase64(""));
    assert(!loader::decodeBase64("cg="));
    assert(!loader::decodeBase64("c=g="));
    assert(!loader::decodeBase64("ch=="));
    assert(!loader::decodeBase64("Zm9v!mFy"));
}

static void verifiesSignatures()
{
    assert(loader::verifyBundleSignature(kMessage, kSignature, kPublicKey));
    assert(loader::verifyBundleSignature(kMessage, kSignature + "\n", kPublicKey));
    assert(!loader::verifyBundleSignature("s", kSignature, kPublicKey));
    assert(!loader::verifyBundleSignature(kMessage, kSignature,
                                          "PUAXw+hDiVqStwqnTRt+vJyYLM8uxJaMwM1V8Sr0Zgs="));
    std::string flipped = kSignature;
    flipped[10]         = flipped[10] == 'A' ? 'B' : 'A';
    assert(!loader::verifyBundleSignature(kMessage, flipped, kPublicKey));
    assert(!loader::verifyBundleSignature(kMessage, "cg==", kPublicKey));
    assert(!loader::verifyBundleSignature(kMessage, kSignature, ""));
}

static void recognisesDevelopmentServers()
{
    assert(loader::isDevelopmentBundleURL("http://10.0.2.2:3000/unbound.98.bundle"));
    assert(loader::isDevelopmentBundleURL("http://127.0.0.1:3000/unbound.js"));
    assert(loader::isDevelopmentBundleURL("http://localhost:3000/"));
    assert(loader::isDevelopmentBundleURL("HTTP://192.168.1.20:3000/unbound.bundle"));
    assert(loader::isDevelopmentBundleURL("http://172.20.0.4/unbound.bundle"));
    assert(loader::isDevelopmentBundleURL("http://mac.local:3000/unbound.bundle"));
    assert(loader::isDevelopmentBundleURL("http://[::1]:3000/unbound.bundle"));
    assert(loader::isDevelopmentBundleURL("http://user@10.0.2.2:3000/unbound.bundle"));
    assert(!loader::isDevelopmentBundleURL("https://127.0.0.1:3000/unbound.bundle"));
    assert(!loader::isDevelopmentBundleURL("https://builds.unbound.rip/unbound.98.bundle"));
    assert(!loader::isDevelopmentBundleURL("http://builds.unbound.rip/unbound.98.bundle"));
    assert(!loader::isDevelopmentBundleURL("http://172.32.0.1/unbound.bundle"));
    assert(!loader::isDevelopmentBundleURL("http://10.0.2.2.example.com/unbound.bundle"));
    assert(!loader::isDevelopmentBundleURL("http://localhost.example.com/unbound.bundle"));
    assert(!loader::isDevelopmentBundleURL("http://evil.com@/unbound.bundle"));
    assert(!loader::isDevelopmentBundleURL("file:///tmp/unbound.bundle"));
}

static void hashesWithSha512()
{
    assert(loader::sha512Hex("abc") ==
           "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a"
           "2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f");
    assert(loader::sha512Hex("").size() == 128);
}

static void bindsPullRequestSignaturesToTheirNumber()
{
    using bundle_test::foreignKey;
    using bundle_test::productionKey;
    using bundle_test::pullRequestKey;
    using loader::TrustedSigner;

    const std::string message = "bundle bytes";
    assert(loader::pullRequestSigningContext(5) == "unbound-pr-bundle/v1/5/");

    const loader::BundleTrust production = bundle_test::productionTrust();
    const loader::BundleTrust pr5        = bundle_test::pullRequestTrust(5);
    const loader::BundleTrust pr6        = bundle_test::pullRequestTrust(6);
    const loader::BundleTrust unnumbered{productionKey().publicKey, pullRequestKey().publicKey, 0};

    const std::string forPR5 = pullRequestKey().sign(message, 5);
    assert(loader::verifyTrustedSignature(message, forPR5, pr5) == TrustedSigner::PullRequest);
    assert(loader::verifyTrustedSignature(message, forPR5, pr6) == TrustedSigner::None);
    assert(loader::verifyTrustedSignature(message, forPR5, production) == TrustedSigner::None);
    assert(loader::verifyTrustedSignature(message, forPR5, unnumbered) == TrustedSigner::None);

    const std::string plainPR = pullRequestKey().sign(message);
    assert(loader::verifyTrustedSignature(message, plainPR, pr5) == TrustedSigner::None);

    const std::string productionSigned = productionKey().sign(message);
    assert(loader::verifyTrustedSignature(message, productionSigned, pr5) ==
           TrustedSigner::Production);
    assert(loader::verifyTrustedSignature(message, productionSigned, production) ==
           TrustedSigner::Production);
    assert(loader::verifyTrustedSignature(message, productionKey().sign(message, 5), pr5) ==
           TrustedSigner::None);
    assert(loader::verifyTrustedSignature(message, foreignKey().sign(message, 5), pr5) ==
           TrustedSigner::None);
    assert(loader::verifyTrustedSignature("other", forPR5, pr5) == TrustedSigner::None);

    assert(production.isEnabled() && !production.trustsPullRequestKey());
    assert(pr5.trustsPullRequestKey() && !unnumbered.trustsPullRequestKey());
    assert(!loader::BundleTrust{}.isEnabled());
}

static void compilesTheProductionTrust()
{
    const loader::BundleTrust compiled = loader::compiledBundleTrust();
    assert(compiled.productionKey == loader::compiledBundleSigningKey());
    assert(compiled.pullRequestNumber > 0 || compiled.pullRequestKey.empty());
}

int main()
{
    decodesBase64();
    verifiesSignatures();
    recognisesDevelopmentServers();
    hashesWithSha512();
    bindsPullRequestSignaturesToTheirNumber();
    compilesTheProductionTrust();
    return 0;
}
