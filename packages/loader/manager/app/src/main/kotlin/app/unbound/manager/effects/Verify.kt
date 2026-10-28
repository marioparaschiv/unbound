package app.unbound.manager.effects

import android.content.pm.PackageManager
import android.os.Build
import app.unbound.manager.core.Event
import app.unbound.manager.core.Failure
import app.unbound.manager.core.InstalledPackageState
import app.unbound.manager.core.Release
import app.unbound.manager.core.SplitChoice
import app.unbound.manager.core.Target
import app.unbound.manager.core.selectSplits
import app.unbound.manager.signerDigests
import java.io.File
import java.io.IOException
import java.util.zip.ZipFile

fun splitsDir(dir: File, release: Release): File = File(dir, "${release.asset.sha256}.splits")

/** PackageInstaller rejects splits signed differently from the base, so the base signer covers the set. */
fun verify(
    packageManager: PackageManager,
    target: Target,
    release: Release,
    dir: File,
    trusted: Set<String>,
    installed: InstalledPackageState,
    log: (String) -> Unit,
): Event {
    val archive = archiveFile(dir, release.asset)
    val out = splitsDir(dir, release)

    if (!archive.exists()) return Event.Fail(Failure.Unexpected("The download is gone; retry to fetch it again"))

    out.deleteRecursively()
    out.mkdirs()

    val splits = try {
        unpack(target, archive, out)
    } catch (error: IOException) {
        val message = error.message.orEmpty()
        return Event.Fail(if ("ENOSPC" in message) Failure.InsufficientStorage else Failure.BadArchive(message))
    }

    if (splits is SplitChoice.Reject) return Event.Fail(splits.failure)

    val entries = (splits as SplitChoice.Install).entries
    log("Selected splits for ${Build.SUPPORTED_ABIS.joinToString()}: ${entries.joinToString()}")

    val base = File(out, entries.first())
    val info = packageManager.getPackageArchiveInfo(base.path, PackageManager.GET_SIGNING_CERTIFICATES)
        ?: return Event.Fail(Failure.BadArchive("${base.name} is not an APK Android can read"))

    if (info.packageName != target.packageName) return Event.Fail(Failure.WrongPackage(target.packageName, info.packageName))

    val signers = info.signerDigests()
    val signer = signers.firstOrNull(trusted::contains)
        ?: return Event.Fail(Failure.UntrustedSigner(signers.firstOrNull() ?: "unsigned"))
    val versionCode = info.longVersionCode

    if (installed is InstalledPackageState.Present && installed.versionCode > versionCode) {
        return Event.Fail(Failure.Downgrade(installed.versionCode, versionCode))
    }

    log("Verified ${info.packageName} versionCode $versionCode signed by $signer")
    val previous = (installed as? InstalledPackageState.Present)?.versionCode
    return Event.Verified(versionCode, entries, signer, System.currentTimeMillis(), previous)
}

private fun unpack(target: Target, archive: File, out: File): SplitChoice {
    if (!target.split) {
        archive.copyTo(File(out, "base.apk"))
        return SplitChoice.Install(listOf("base.apk"))
    }

    ZipFile(archive).use { zip ->
        val choice = selectSplits(zip.entries().asSequence().map { it.name }.toList(), Build.SUPPORTED_ABIS.toList())

        if (choice !is SplitChoice.Install) return choice

        for (name in choice.entries) {
            zip.getInputStream(zip.getEntry(name)).use { input -> File(out, name).outputStream().use(input::copyTo) }
        }
        return choice
    }
}
