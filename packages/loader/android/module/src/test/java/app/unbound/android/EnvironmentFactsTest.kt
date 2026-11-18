package app.unbound.android

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EnvironmentFactsTest {
    @Test
    fun theSystemDataFoldersAreStandard() {
        assertTrue(EnvironmentFacts.isStandardDataDir("/data/user/0/com.discord"))
        assertTrue(EnvironmentFacts.isStandardDataDir("/data/user/10/com.discord"))
        assertTrue(EnvironmentFacts.isStandardDataDir("/data/data/com.discord"))
        assertTrue(EnvironmentFacts.isStandardDataDir("/mnt/expand/3f2a/user/0/com.discord"))
    }

    @Test
    fun aVirtualAppFolderIsNotStandard() {
        assertFalse(EnvironmentFacts.isStandardDataDir("/storage/emulated/0/VMOS/data/com.discord"))
    }
}
