package com.aicalendar.widget

import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.browser.customtabs.CustomTabsIntent
import com.aicalendar.widget.worker.RefreshScheduler

/**
 * Transparent trampoline for the widget's "open on the web" taps.
 *
 * It opens the URL in a Chrome Custom Tab (same shared Chrome login as before),
 * then — when the user finishes on the web and the tab closes — refreshes the
 * widgets. Since every add/edit/delete happens on the web, refreshing on return
 * makes those changes show up on the widget immediately instead of waiting for
 * the 15-minute periodic refresh.
 */
class WebOpenActivity : ComponentActivity() {
    private var launchedTab = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        launchedTab = savedInstanceState?.getBoolean(KEY_LAUNCHED) ?: false
        if (intent?.getStringExtra(EXTRA_URL) == null) finish()
    }

    override fun onResume() {
        super.onResume()
        val url = intent?.getStringExtra(EXTRA_URL) ?: run { finish(); return }
        if (!launchedTab) {
            launchedTab = true
            val tab = CustomTabsIntent.Builder().setShowTitle(true).build()
            runCatching { tab.launchUrl(this, Uri.parse(url)) }.onFailure { finish() }
        } else {
            // Back from the web — the user may have changed events; refresh now.
            RefreshScheduler.refreshNow(applicationContext)
            finish()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean(KEY_LAUNCHED, launchedTab)
    }

    companion object {
        const val EXTRA_URL = "url"
        private const val KEY_LAUNCHED = "launched_tab"
    }
}
