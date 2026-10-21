# Add project specific ProGuard rules here.
-keep class org.mozilla.geckoview.** { *; }
-keep class com.lycon.browser.** { *; }

# Keep JavascriptInterface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
