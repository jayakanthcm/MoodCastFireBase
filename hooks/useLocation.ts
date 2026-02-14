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

        let lastLat: number | null = null;
        let lastLng: number | null = null;
        const MIN_DISTANCE_CHANGE = 5; // meters - only update if moved at least this far

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const newLat = pos.coords.latitude;
                const newLng = pos.coords.longitude;

                // Manual distance filter: distanceFilter is not a standard browser API,
                // so we implement our own threshold to avoid excessive updates.
                if (lastLat !== null && lastLng !== null) {
                    const dlat = (newLat - lastLat) * 111320; // rough meters per degree lat
                    const dlng = (newLng - lastLng) * 111320 * Math.cos(lastLat * Math.PI / 180);
                    const moved = Math.sqrt(dlat * dlat + dlng * dlng);
                    if (moved < MIN_DISTANCE_CHANGE) return; // Skip update if barely moved
                }

                lastLat = newLat;
                lastLng = newLng;
                const newLoc = { lat: newLat, lng: newLng };
                setCurrentLocation(newLoc);
                setError(null);

                // Reactive Update: Sync to Firestore if broadcasting
                if (isBroadcasting && userId) {
                    FirestoreService.updateSession(userId, {
                        lat: newLoc.lat,
                        lng: newLoc.lng,
                    });
                }
            },
            (err) => {
                console.error("Location access denied", err);
                setError(err);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 5000,
                timeout: 10000
            }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [userId, isBroadcasting]);

    return { currentLocation, error };
};
