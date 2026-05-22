package com.aicalendar.widget.widgets

import android.content.ComponentName
import androidx.compose.runtime.Composable
import androidx.glance.LocalContext
import androidx.glance.action.Action
import androidx.glance.action.actionStartActivity
import com.aicalendar.widget.MainActivity

/** Tapping a widget opens MainActivity. ComponentName overload is stable across Glance 1.1.x. */
@Composable
internal fun openApp(): Action =
    actionStartActivity(ComponentName(LocalContext.current, MainActivity::class.java))
