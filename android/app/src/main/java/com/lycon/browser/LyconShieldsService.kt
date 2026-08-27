package com.lycon.browser

import android.util.Log
import org.mozilla.geckoview.ContentBlocking
import org.mozilla.geckoview.GeckoRuntime

/**
 * Lycon Shields on Android — uses GeckoView's built-in tracking protection.
 *
 * GeckoView ships with the same tracking protection used by Firefox Focus
 * and Firefox for Android. It blocks:
 *   - Ads (via Disconnect's adblock list)
 *   - Analytics trackers (via Disconnect analytics list)
 *   - Social trackers (via Disconnect social list)
 *   - Fingerprinting scripts
 *   - Cryptomining scripts
 *
 * We enable all categories and expose a counter via the ContentBlockingController.
 */
class LyconShieldsService {

    var isEnabled: Boolean = true
        set(value) {
            field = value
            applyToRuntime()
        }

    var totalBlocked: Int = 0
        private set

    var isLoaded: Boolean = false
        private set

    private var runtime: GeckoRuntime? = null

    /**
     * Configure the GeckoRuntime with strict tracking protection.
     * Call this BEFORE creating any GeckoSession.
     */
    fun configureRuntime(runtime: GeckoRuntime) {
        this.runtime = runtime
        applyToRuntime()
        isLoaded = true
        Log.i(TAG, "Shields configured on GeckoRuntime")
    }

    private fun applyToRuntime() {
        val rt = runtime ?: return
        val settings = rt.settings.contentBlocking
        if (isEnabled) {
            // Enable all tracking protection categories
            settings.setAntiTracking(
                ContentBlocking.AntiTracking.AD or
                ContentBlocking.AntiTracking.ANALYTIC or
                ContentBlocking.AntiTracking.SOCIAL or
                ContentBlocking.AntiTracking.CONTENT or
                ContentBlocking.AntiTracking.CRYPTOMINING or
                ContentBlocking.AntiTracking.FINGERPRINTING
            )
            // Also enable SafeBrowsing for malware/phishing
            settings.setSafeBrowsing(
                ContentBlocking.SafeBrowsing.MALWARE or
                ContentBlocking.SafeBrowsing.UNWANTED or
                ContentBlocking.SafeBrowsing.HARMFUL
            )
            settings.setStrictSocialTrackingProtection(true)
            settings.setEnhancedTrackingProtectionLevel(ContentBlocking.EtpLevel.STRICT)
            Log.i(TAG, "Shields enabled (strict)")
        } else {
            settings.setAntiTracking(ContentBlocking.AntiTracking.NONE)
            settings.setSafeBrowsing(ContentBlocking.SafeBrowsing.NONE)
            Log.i(TAG, "Shields disabled")
        }
    }

    /**
     * Increment the per-tab blocked count (called when GeckoView's
     * ContentBlockingDelegate.onContentBlocked fires).
     */
    fun onBlocked() {
        totalBlocked++
    }

    companion object {
        private const val TAG = "LyconShields"
    }
}
