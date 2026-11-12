package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Test

class FrameworkLabelTest {
    @Test
    fun aModuleFrameworkShowsItsNameAndVersion() {
        assertEquals("Vector 1.11.0", Platform.frameworkLabel("Vector", "1.11.0", false))
    }

    @Test
    fun aPatchedAppNamesLSPatch() {
        assertEquals("LSPatch 0.6", Platform.frameworkLabel("LSPosed", "0.6", true))
    }

    @Test
    fun theRootManagerIsNamedByItsDataDirectory() {
        assertEquals("KernelSU", Platform.rootManager { it == "/data/adb/ksu" })
        assertEquals("Magisk", Platform.rootManager { it == "/data/adb/magisk" || it == "/data/adb/ap" })
        assertEquals("Magisk", Platform.rootManager { it == "/debug_ramdisk/magisk" })
        assertEquals("", Platform.rootManager { false })
    }

    @Test
    fun aMissingVersionIsLeftOut() {
        assertEquals("Vector", Platform.frameworkLabel("Vector", "", false))
    }
}
