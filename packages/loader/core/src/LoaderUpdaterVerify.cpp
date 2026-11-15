#include "LoaderDigestCache.h"
#include "LoaderFiles.h"
#include "LoaderLog.h"
#include "LoaderRequiredLoader.h"
#include "LoaderUpdater.h"
#include "LoaderVersion.h"
#include "NativePluginVersion.h"

// Trusting a download plan: the manifest's signature and limits, then the bundle's bytes.
namespace loader {

void BundleUpdater::verifyPlan(DownloadPlan &plan) const
{
    if (!plan.exemption.empty() || plan.unchanged || !plan.expectedSha512.empty())
    {
        return;
    }

    std::string                manifestURL = plan.source + kBundleManifestName;
    std::optional<std::string> signature =
        plan.signature.valid() ? plan.signature.get() : std::nullopt;
    std::optional<BundleManifest> manifest = parseBundleManifest(plan.manifestText);
    TrustedSigner signer = signature ? verifyTrustedSignature(plan.manifestText, *signature, trust_)
                                     : TrustedSigner::None;

    if (signer == TrustedSigner::None || !manifest)
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Refused the update: " + manifestURL + " has no valid signature.");
        throw BundleUpdateError(BundleUpdateFailure::Verification,
                                "Bundle manifest failed signature verification");
    }

    if (!manifest->isSignable())
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Refused the update: the signed manifest lacks its build time, revision, channel or "
            "hashes.");
        throw BundleUpdateError(BundleUpdateFailure::Verification,
                                "Signed bundle manifest is incomplete");
    }

    if (std::optional<std::string> rollback = rollbackProblem(*manifest, plan.source, baseline()))
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Refused the update: the signed manifest would roll back the active bundle, as " +
                *rollback + ".");
        throw BundleUpdateError(BundleUpdateFailure::Verification,
                                "Bundle manifest would roll back the active bundle");
    }

    if (std::optional<std::string> outdated = loaderVersionProblem(*manifest, loaderVersion()))
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Refused the update: " + *outdated + ". Update the loader to use this bundle.");
        recordRequiredLoader(documents_, manifest->minLoaderVersion);
        throw BundleUpdateError(BundleUpdateFailure::LoaderTooOld, "Bundle needs a newer loader");
    }
    recordRequiredLoader(documents_, "");

    if (std::optional<std::string> bridge =
            nativeBridgeProblem(*manifest, kNativePluginApiVersion, kNativePluginAbiVersion))
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Refused the update: " + *bridge + ". Update the loader to use this bundle.");
        throw BundleUpdateError(BundleUpdateFailure::LoaderTooOld,
                                "Bundle needs a different native bridge");
    }

    auto hash = manifest->sha512.find(plan.file);
    if (hash == manifest->sha512.end())
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Refused the update: the signed manifest has no hash for " + plan.file + ".");
        throw BundleUpdateError(BundleUpdateFailure::Verification,
                                "Signed bundle manifest does not list the bundle");
    }

    log(LogLevel::Info, LOG_CATEGORY_UPDATER,
        "Bundle manifest verified with " + describeSigner(signer, trust_) + " (revision " +
            manifest->revision + ", channel " + manifest->channel + ", built " +
            manifest->buildTime + ").");
    plan.manifestSignature = *signature;
    plan.expectedSha512    = hash->second;
    auto patches           = manifest->patches.find(hash->first);
    plan.patchBases =
        patches == manifest->patches.end() ? std::vector<std::string>{} : patches->second;
}

std::optional<std::string> BundleUpdater::verifiedRecord(const DownloadPlan &plan,
                                                         const std::string  &candidatePath) const
{
    nlohmann::json record{{"url", plan.url},
                          {"source", plan.source},
                          {"file", plan.file},
                          {"developerMode", developerMode() ? "1" : "0"}};

    if (!plan.exemption.empty())
    {
        record["kind"]      = "exempt";
        record["exemption"] = plan.exemption;
        return record.dump();
    }

    std::optional<std::string> bundle = readTextFile(candidatePath);
    if (!bundle)
    {
        return std::nullopt;
    }

    if (sha512Hex(*bundle) != plan.expectedSha512)
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Rejected the downloaded bundle: its SHA-512 does not match the signed manifest.");
        return std::nullopt;
    }
    log(LogLevel::Info, LOG_CATEGORY_UPDATER,
        "Bundle signature verified: " + plan.file + " matches the signed manifest.");
    if (std::optional<nlohmann::json> identity = fileIdentity(candidatePath))
    {
        record["identity"] = *identity;
    }
    record["kind"]      = "manifest";
    record["manifest"]  = plan.manifestText;
    record["signature"] = plan.manifestSignature;
    return record.dump();
}
}
