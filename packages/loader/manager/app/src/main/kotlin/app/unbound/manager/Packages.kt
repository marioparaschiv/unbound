package app.unbound.manager

import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import app.unbound.manager.core.InstalledPackageState
import java.security.MessageDigest

/** What PackageManager shows for [packageName] right now. */
fun PackageManager.installedState(packageName: String): InstalledPackageState {
    val info = try {
        getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
    } catch (_: PackageManager.NameNotFoundException) {
        return InstalledPackageState.Missing
    }

    return InstalledPackageState.Present(
        versionCode = info.longVersionCode,
        versionName = info.versionName.orEmpty(),
        lastUpdateTime = info.lastUpdateTime,
        signers = info.signerDigests(),
        installer = installerOf(packageName),
    )
}

/** Lowercase hex SHA-256 of each certificate that signs the APK contents, without rotated-away past signers. */
@Suppress("DEPRECATION")
fun PackageInfo.signerDigests(): Set<String> {
    val certificates = signingInfo?.apkContentsSigners ?: signatures ?: return emptySet()
    val digest = MessageDigest.getInstance("SHA-256")

    return certificates.map { cert -> digest.digest(cert.toByteArray()).joinToString("") { "%02x".format(it) } }.toSet()
}

@Suppress("DEPRECATION")
private fun PackageManager.installerOf(packageName: String): String? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
    getInstallSourceInfo(packageName).installingPackageName
} else {
    getInstallerPackageName(packageName)
}
