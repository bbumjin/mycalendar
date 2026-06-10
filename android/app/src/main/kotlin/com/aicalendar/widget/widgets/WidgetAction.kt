package com.aicalendar.widget.widgets

import android.content.ComponentName
import android.content.Intent
import androidx.compose.runtime.Composable
import androidx.glance.LocalContext
import androidx.glance.action.Action
import androidx.glance.appwidget.action.actionStartActivity
import com.aicalendar.widget.BuildConfig
import com.aicalendar.widget.MainActivity
import com.aicalendar.widget.WebOpenActivity

// Open the web app via WebOpenActivity, a transparent trampoline that launches a
// Chrome Custom Tab (shared Chrome login as before) and refreshes the widgets
// when the user returns — so web edits show on the widget right away.
private fun openWeb(path: String): Action {
    val intent = Intent().apply {
        setClassName(BuildConfig.APPLICATION_ID, WebOpenActivity::class.java.name)
        putExtra(WebOpenActivity.EXTRA_URL, BuildConfig.WEB_BASE_URL + path)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    return actionStartActivity(intent)
}

/** Tapping the widget body opens the web month calendar. */
fun openCalendar(): Action = openWeb("/calendar")

/** The + button opens quick-add. */
fun openQuickAdd(): Action = openWeb("/quick-add")

/** Tapping a day cell opens that day's page on the web. */
fun openDay(date: String): Action = openWeb("/day/$date")

/** Not-configured state opens the in-app token setup screen. */
@Composable
fun openTokenSetup(): Action =
    androidx.glance.action.actionStartActivity(
        ComponentName(LocalContext.current, MainActivity::class.java)
    )
