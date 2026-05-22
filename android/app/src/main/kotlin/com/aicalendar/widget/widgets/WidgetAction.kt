package com.aicalendar.widget.widgets

import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.glance.LocalContext
import androidx.glance.action.Action
import com.aicalendar.widget.BuildConfig
import com.aicalendar.widget.MainActivity

private fun browser(path: String): Action {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.WEB_BASE_URL + path))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return androidx.glance.appwidget.action.actionStartActivity(intent)
}

/** Tapping the widget body opens the web month calendar. */
fun openCalendar(): Action = browser("/calendar")

/** The + button opens quick-add. */
fun openQuickAdd(): Action = browser("/quick-add")

/** Used by the not-configured state to open the in-app token setup screen. */
@Composable
fun openTokenSetup(): Action =
    androidx.glance.action.actionStartActivity(
        ComponentName(LocalContext.current, MainActivity::class.java)
    )
