import { useState, useEffect, useRef } from 'react';
import { FirestoreService } from '../services/firestoreService';
import { LiveAura } from '../types';
import { getDistanceFromLatLonInM } from '../constants';

export const useRadar = (
    profileId: string,
    currentLocation: { lat: number; lng: number } | null,
    scanRange: number,
    isBroadcasting: boolean
) => {
    const [nearbyUsers, setNearbyUsers] = useState<(LiveAura & { id: string; dist: number })[]>([]);

    // Use a ref to track the latest currentLocation so the onSnapshot callback
    // always has fresh coordinates without needing to re-subscribe.
    const locationRef = useRef(currentLocation);
    locationRef.current = currentLocation;

    // Stabilize dependency: only re-subscribe when lat/lng values actually change,
    // not on every new object reference.
    const lat = currentLocation?.lat ?? null;
    const lng = currentLocation?.lng ?? null;

    useEffect(() => {
        if (lat === null || lng === null) return;

        const unsubscribe = FirestoreService.subscribeToRadar(
            [lat, lng],
            scanRange,
            (sessions) => {
                // Use latest location from ref for distance calculations
                const loc = locationRef.current;
                if (!loc) return;

                // Filter by Recency (Last 10 minutes)
                const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

                const mapped = sessions
                    .map(s => {
                        // Handle Timestamp or number (legacy)
                        const lastSeenTime = s.lastSeen?.toMillis ? s.lastSeen.toMillis() : (s.lastSeen || 0);
                        if (lastSeenTime < tenMinutesAgo) return null; // Filter stale

                        const dist = getDistanceFromLatLonInM(loc.lat, loc.lng, s.lat, s.lng);
                        return { ...s, id: s.uid, dist };
                    })
                    .filter((s): s is (LiveAura & { id: string, dist: number }) => s !== null && s.id !== profileId);

                setNearbyUsers(mapped);

                // Self-Reporting 'On Radar' Count
                if (isBroadcasting) {
                    const mySession = sessions.find(s => s.uid === profileId);
                    const currentCount = mySession?.stats?.inRadar || 0;
                    const newCount = mapped.length;

                    if (currentCount !== newCount) {
                        console.log(`[Radar] Updating my On-Radar count: ${currentCount} -> ${newCount}`);
                        FirestoreService.updateInRadarCount(profileId, newCount);
                    }
                }
            }
        );

        return () => unsubscribe();
    }, [profileId, lat, lng, scanRange, isBroadcasting]);

    return nearbyUsers;
};
