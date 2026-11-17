package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Test

class InstallSourceTest {
    @Test
    fun storesAreNamed() {
        assertEquals("Google Play", InstallSource.label("com.android.vending"))
        assertEquals("Aurora Store", InstallSource.label("com.aurora.store"))
        assertEquals("Obtainium", InstallSource.label("dev.imranr.obtainium"))
    }

    @Test
    fun noInstallerOrThePackageInstallerMeansSideloaded() {
        assertEquals("Sideloaded", InstallSource.label(null))
        assertEquals("Sideloaded", InstallSource.label("com.google.android.packageinstaller"))
        assertEquals("Sideloaded", InstallSource.label("com.google.android.packageinstaller", "android"))
    }

    @Test
    fun theAppThatStartedASystemInstallIsNamed() {
        assertEquals(
            "Sideloaded via Obtainium",
            InstallSource.label("com.google.android.packageinstaller", "dev.imranr.obtainium"),
        )
        assertEquals("Sideloaded via com.example.files", InstallSource.label(null, "com.example.files"))
    }

    @Test
    fun anInstallerThatInstalledItselfWins() {
        assertEquals("Droid-ify", InstallSource.label("com.looker.droidify", "com.looker.droidify"))
    }

    @Test
    fun anUnknownInstallerIsShownByItsPackage() {
        assertEquals("com.example.store", InstallSource.label("com.example.store"))
    }
}
