package app.astral.android

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
    fun aMissingVersionIsLeftOut() {
        assertEquals("Vector", Platform.frameworkLabel("Vector", "", false))
    }
}
