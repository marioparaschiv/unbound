package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Test

class ModuleVersionsTest {
    @Test
    fun findsTheArchivesOfOtherAppsLoadedIntoDiscord() {
        val maps = """
            7000-7100 r--p 00000000 fd:01 1 /data/app/~~abc==/com.example.hide-xyz==/base.apk
            7100-7200 r--p 00000000 fd:01 2 /data/app/~~def==/com.discord-uvw==/base.apk
            7200-7300 r--p 00000000 fd:01 3 /data/app/org.lsposed.module-1/base.apk
            7300-7400 r--p 00000000 fd:01 4 /system/framework/framework.jar
            7400-7500 r--p 00000000 fd:01 5 /data/adb/modules/zygisk_shamiko/zygisk/arm64-v8a.so
        """.trimIndent()

        assertEquals(
            mapOf(
                "com.example.hide" to "/data/app/~~abc==/com.example.hide-xyz==/base.apk",
                "org.lsposed.module" to "/data/app/org.lsposed.module-1/base.apk",
            ),
            ModuleVersions.archives(maps, "com.discord"),
        )
    }
}
