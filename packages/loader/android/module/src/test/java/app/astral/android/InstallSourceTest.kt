package app.astral.android

import org.junit.Assert.assertEquals
import org.junit.Test

class InstallSourceTest {
    @Test
    fun storesAreNamed() {
        assertEquals("Google Play", InstallSource.label("com.android.vending"))
        assertEquals("Aurora Store", InstallSource.label("com.aurora.store"))
    }

    @Test
    fun noInstallerOrThePackageInstallerMeansSideloaded() {
        assertEquals("Sideloaded", InstallSource.label(null))
        assertEquals("Sideloaded", InstallSource.label("com.google.android.packageinstaller"))
    }

    @Test
    fun anUnknownInstallerIsShownByItsPackage() {
        assertEquals("com.example.store", InstallSource.label("com.example.store"))
    }
}
