package com.blackhole21.game;

import android.util.Log;

import com.google.firebase.messaging.FirebaseMessagingService;

public class BlackHoleFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "BlackHole21";

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "[push] FCM token refreshed: " + token);
        PushTokenRegistrar.send(this, token);
    }
}
