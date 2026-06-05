package com.aicalendar.widget.widgets

import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.runtime.Composable
import androidx.glance.LocalContext
import androidx.glance.action.Action
import com.aicalendar.widget.BuildConfig
import com.aicalendar.widget.MainActivity

// Open the web app in a Chrome Custom Tab: shares the user's Chrome login
// session, renders the full web app (calendar / day list / quick-add /
// extraction), and overlays the app instead of piling up browser tabs.
private fun customTab(path: String): Action {
    val cti = CustomTabsIntent.Builder()
        .setShowTitle(true)
        .build()
    cti.intent.data = Uri.parse(BuildConfig.WEB_BASE_URL + path)
    cti.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    // Reuse a single custom-tab task instead of stacking a new one each tap.
    cti.intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return androidx.glance.appwidget.action.actionStartActivity(cti.intent)
}

/** Tapping the widget body opens the web month calendar. */
fun openCalendar(): Action = customTab("/calendar")

/** The + button opens quick-add. */
fun openQuickAdd(): Action = customTab("/quick-add")

/** Tapping a day cell opens that day's page on the web. */
fun openDay(date: String): Action = customTab("/day/$date")

/** Not-configured state opens the in-app token setup screen. */
@Composable
fun openTokenSetup(): Action =
    androidx.glance.action.actionStartActivity(
        ComponentName(LocalContext.current, MainActivity::class.java)
    )
