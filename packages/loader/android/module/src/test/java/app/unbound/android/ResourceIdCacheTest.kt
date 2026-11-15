package app.unbound.android

import java.io.File
import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Test

class ResourceIdCacheTest {
    private fun cacheFile(): File = Files.createTempDirectory("resource-ids").toFile().resolve("ids.tsv")

    @Test
    fun answersFromTheFileOnTheNextLaunchOfTheSameBuild() {
        val file = cacheFile()
        val first = ResourceIdCache(file, "350008")
        assertEquals(7, first.id("color", "primary_100") { 7 })
        assertEquals(0, first.id("color", "missing") { 0 })
        first.save()

        var lookups = 0
        val next = ResourceIdCache(file, "350008")
        assertEquals(7, next.id("color", "primary_100") { lookups++; 9 })
        assertEquals(0, next.id("color", "missing") { lookups++; 9 })
        assertEquals(0, lookups)
    }

    @Test
    fun ignoresACacheFromAnotherBuild() {
        val file = cacheFile()
        ResourceIdCache(file, "350008").apply {
            id("color", "primary_100") { 7 }
            save()
        }

        assertEquals(9, ResourceIdCache(file, "351000").id("color", "primary_100") { 9 })
    }
}
