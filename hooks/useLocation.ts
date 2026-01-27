import { useState, useEffect } from 'react';

export const useLocation = () => {
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [error, setError] = useState<GeolocationPositionError | null>(null);

    useEffect(() => {
        if (!navigator.geolocation) {
            setError({ code: 0, message: "Geolocation not supported", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setError(null);
            },
            (err) => {
                console.error("Location access denied", err);
                setError(err);
            },
            {
                enableHighAccuracy: true
            }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    return { currentLocation, error };
};
