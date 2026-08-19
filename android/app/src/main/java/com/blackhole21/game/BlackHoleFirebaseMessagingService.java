package com.blackhole21.game;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class BlackHoleFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "BlackHole21";
    private static final String CHANNEL_ID = "black_hole_21_notifications";

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "[push] FCM token refreshed: " + token);
        PushTokenRegistrar.send(this, token);
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        String title = remoteMessage.getNotification() != null
                ? remoteMessage.getNotification().getTitle()
                : null;
        String body = remoteMessage.getNotification() != null
                ? remoteMessage.getNotification().getBody()
                : null;

        if (title == null || title.trim().isEmpty()) title = "Black Hole 21";
        if (body == null || body.trim().isEmpty()) body = "You have a new message.";

        Log.d(TAG, "[push] notification received: " + title);
        showNotification(title, body);
    }

    private void showNotification(String title, String body) {
        createNotificationChannel();

        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pendingIntent = null;
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            pendingIntent = PendingIntent.getActivity(
                    this,
                    0,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true);

        if (pendingIntent != null) builder.setContentIntent(pendingIntent);

        NotificationManagerCompat.from(this).notify(
                (int) (System.currentTimeMillis() & 0x7fffffff),
                builder.build()
        );
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Black Hole 21 notifications",
                NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Black Hole 21 admin broadcasts");
        manager.createNotificationChannel(channel);
    }
}
