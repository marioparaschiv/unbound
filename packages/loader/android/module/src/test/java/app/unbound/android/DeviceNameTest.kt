package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DeviceNameTest {
    @Test
    fun aSamsungShowsItsMarketingNameAndModel() {
        assertEquals(
            "Samsung Galaxy S23 Ultra (SM-S918B)",
            DeviceName.label("samsung", "SM-S918B", null, "Galaxy S23 Ultra"),
        )
    }

    @Test
    fun aPixelAlreadyNamedByItsModelIsNotRepeated() {
        assertEquals("Google Pixel 8 Pro", DeviceName.label("Google", "Pixel 8 Pro", null, "Pixel 8 Pro"))
    }

    @Test
    fun aMarketNamePropertyWinsOverTheDeviceName() {
        assertEquals(
            "Xiaomi 14 Ultra (24030PN60G)",
            DeviceName.label("Xiaomi", "24030PN60G", "Xiaomi 14 Ultra", "Adrian's phone"),
        )
    }

    @Test
    fun aPersonalDeviceNameIsLeftOut() {
        assertTrue(DeviceName.isPersonal("Adrian's Galaxy"))
        assertEquals("Samsung SM-S918B", DeviceName.label("samsung", "SM-S918B", null, "Adrian's Galaxy"))
    }

    @Test
    fun anEmulatorSaysItIsOne() {
        assertEquals("Android Emulator (sdk_gphone64_arm64)", DeviceName.emulatorLabel("sdk_gphone64_arm64"))
    }

    @Test
    fun anEmulatorKeepsItsModel() {
        assertEquals(
            "Google sdk_gphone64_arm64",
            DeviceName.label("Google", "sdk_gphone64_arm64", null, "sdk_gphone64_arm64"),
        )
    }
}
