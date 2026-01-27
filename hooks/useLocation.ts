import { useState, useEffect } from 'react';
import { FirestoreService } from '../services/firestoreService';

export const useLocation = (userId: string, isBroadcasting: boolean) => {
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [error, setError] = useState<GeolocationPositionError | null>(null);

    useEffect(() => {
        if (!navigator.geolocation) {
            setError({ code: 0, message: "Geolocation not supported", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setCurrentLocation(newLoc);
                setError(null);

                // Reactive Update: Sync to Firestore if broadcasting
                if (isBroadcasting && userId) {
                    FirestoreService.updateSession(userId, {
                        lat: newLoc.lat,
                        lng: newLoc.lng,
                        // lastSeen is automatically handled by updateSession, but we can be explicit if needed
                        // Service.updateSession adds serverTimestamp() to lastSeen
                    });
                }
            },
            (err) => {
                console.error("Location access denied", err);
                setError(err);
            },
            {
                enableHighAccuracy: true,
                distanceFilter: 5 // Teaching Point: Update every 5 meters
            }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [userId, isBroadcasting]);

    return { currentLocation, error };
};
