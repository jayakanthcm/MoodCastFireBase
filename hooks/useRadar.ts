import { useState, useEffect } from 'react';
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

    useEffect(() => {
        if (!currentLocation) return;

        const unsubscribe = FirestoreService.subscribeToRadar(
            [currentLocation.lat, currentLocation.lng],
            scanRange,
            (sessions) => {
                // [DEBUG] Log raw session count
                // console.log("Raw sessions from Firestore:", sessions.length);

                // Filter by Recency (Last 10 minutes)
                const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

                const mapped = sessions
                    .map(s => {
                        // Handle Timestamp or number (legacy)
                        const lastSeenTime = s.lastSeen?.toMillis ? s.lastSeen.toMillis() : (s.lastSeen || 0);
                        if (lastSeenTime < tenMinutesAgo) return null; // Filter stale

                        const dist = getDistanceFromLatLonInM(currentLocation.lat, currentLocation.lng, s.lat, s.lng);
                        return { ...s, id: s.uid, dist };
                    })
                    .filter((s): s is (LiveAura & { id: string, dist: number }) => s !== null && s.id !== profileId)
                    .filter(s => s.dist <= scanRange); // Apply Distance Filter

                setNearbyUsers(mapped);

                // Self-Reporting 'On Radar' Count (Vibe Coding Feature)
                // We calculate how many people are near US, and publish it so others can see on our stamp.
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
    }, [profileId, currentLocation, scanRange, isBroadcasting]);

    return nearbyUsers;
};
