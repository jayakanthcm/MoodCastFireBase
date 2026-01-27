import React, { useState, useEffect, useRef } from 'react';
import { resizeImage } from '../services/imageUtils';
import { UserProfile, MoodType, ChatThread, ChatMessage, AuraSession, LiveAura } from '../types';
import { MOODS } from '../constants';
import { generateVibeTagline } from '../services/geminiService';
import { FirestoreService } from '../services/firestoreService';

interface Props {
  profile: UserProfile;
  onUpdateMood: (mood: MoodType) => void;
  onUpdateNickname: (name: string) => void;
  onUpdateStatusMessage: (msg: string) => void;
  onUpdateIcon: (icon: string) => void;
  onEditProfile: () => void;
  onWipeSession: () => void;
}

// Helper: Calculate Distance
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2 - lat1);
  var dLon = deg2rad(lon2 - lon1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
    ;
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c; // Distance in km
  return Math.round(d * 1000);
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180)
}

const Stamp: React.FC<{ text: string; color: string; rotation: string; highlight?: boolean }> = ({ text, color, rotation, highlight }) => (
  <div className={`
    ${rotation} 
    ${color} 
    ${highlight ? 'ring-2 ring-current ring-offset-2 ring-offset-slate-950 bg-current/10' : ''}
    stamp-font font-bold text-[10px] px-3 py-1 
    border-2 border-current rounded-sm
    ink-stamp shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]
    animate-stamp
    whitespace-nowrap
  `}>
    {text.toUpperCase()}
  </div>
);

const PulseIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    <path d="M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0" />
    <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" opacity="0.4" />
  </svg>
);

const RadarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
    <path d="M12 12l5 5" />
    <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M12 12l-3 -8" />
  </svg>
);

export const MainView: React.FC<Props> = ({ profile, onUpdateMood, onUpdateNickname, onUpdateStatusMessage, onUpdateIcon, onEditProfile, onWipeSession }) => {
  const [activeTab, setActiveTab] = useState<'AURA' | 'RADAR' | 'CHATS' | 'CONTROLS'>('RADAR');
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<MoodType | 'ALL'>('ALL');
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [tempNickname, setTempNickname] = useState(profile.identity.nickname);
  const [tempStatus, setTempStatus] = useState(profile.identity.statusMessage);

  // Real-Time Data State
  const [nearbyUsers, setNearbyUsers] = useState<(AuraSession & { id: string, dist: number })[]>([]);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null);

  // Ephemeral Vibe State
  const [vibeColor, setVibeColor] = useState('#6366f1');
  const [pulseBPM, setPulseBPM] = useState(60);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // Refs
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat State
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // Interaction State
  const [likedUserIds, setLikedUserIds] = useState<Set<string>>(new Set());
  const [liveStats, setLiveStats] = useState({ interested: 0, inRadar: 0 });

  // Settings State
  const [visibilityLevel, setVisibilityLevel] = useState<'ALL' | 'PREFS'>('ALL'); // Default to ALL for better discovery
  const [scanRange, setScanRange] = useState<number>(5000); // Default to 5km for testing
  // const [isGhostMode, setIsGhostMode] = useState(false); // REPLACED by !isBroadcasting

  // Initial Location Fetch & Radar Subscription
  useEffect(() => {
    // Cleanup on window close
    const handleBeforeUnload = () => {
      if (isBroadcasting) {
        // Attempt to delete session (navigator.sendBeacon is better but Firestore sync works too if fast)
        FirestoreService.deleteSession(profile.id);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isBroadcasting, profile.id]);

  // Location Tracking & Radar Subscription
  useEffect(() => {
    let watchId: number;

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition((pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocation(newLoc);
        if (isBroadcasting) {
          updateBroadcastData(newLoc);
        }
      }, (err) => {
        console.error("Location access denied", err);
      }, {
        enableHighAccuracy: true
      });
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isBroadcasting]);

  // Real-Time Stats Subscription (Fix for Static Data)
  useEffect(() => {
    if (!isBroadcasting) return;

    const unsubscribe = FirestoreService.subscribeToSession(profile.id, (session) => {
      if (session && session.stats) {
        setLiveStats(session.stats);
      }
    });

    return () => unsubscribe();
  }, [isBroadcasting, profile.id]);

  // 2. Subscribe to Radar (Geohash Query)
  useEffect(() => {
    if (!currentLocation) return;

    const unsubscribe = FirestoreService.subscribeToRadar(
      [currentLocation.lat, currentLocation.lng],
      scanRange,
      (sessions) => {
        // [DEBUG] Log raw session count
        console.log("Raw sessions from Firestore:", sessions.length);

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
          .filter((s): s is (LiveAura & { id: string, dist: number }) => s !== null && s.id !== profile.id)
          .filter(s => s.dist <= scanRange); // Apply Distance Filter

        setNearbyUsers(mapped);
      }
    );

    return () => unsubscribe();
  }, [currentLocation, scanRange]);




  useEffect(() => {
    const fetchInitialStatus = async () => {
      if (!profile.identity.statusMessage) {
        setIsRegenerating(true);
        const tag = await generateVibeTagline(profile);
        onUpdateStatusMessage(tag);
        setTempStatus(tag);
        setIsRegenerating(false);
      }
    };
    fetchInitialStatus();
  }, [profile.identity.statusMessage]);

  // Subscribe to Conversations
  useEffect(() => {
    if (!profile.id) return;
    return FirestoreService.subscribeToConversations(profile.id, (convs) => {
      setConversations(convs);
    });
  }, [profile.id]);

  // Subscribe to Messages
  useEffect(() => {
    if (!activeChatUserId) {
      setActiveMessages([]);
      return;
    }
    const unsub = FirestoreService.subscribeToMessages(activeChatUserId, profile.id, (msgs) => {
      setActiveMessages(msgs as ChatMessage[]);
    });
    return () => unsub();
  }, [activeChatUserId, profile.id]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [activeMessages, activeChatUserId, isTyping]);

  useEffect(() => {
    // Check if I am broadcasting
    // This needs to be synced with UI toggle
    // For now, local state controls broadcasting. 
    // Ideally we check if my UID is in the sessions list, but local truth is faster.
  }, []);

  // Heartbeat Timer: 3 minutes
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isBroadcasting) {
      interval = setInterval(async () => {
        await FirestoreService.updateHeartbeat(profile.id);
      }, 180000); // 3 minutes
    }
    return () => clearInterval(interval);
  }, [isBroadcasting, profile.id]);

  // Auto-Start Broadcasting on Mount (Default to Live)
  useEffect(() => {
    // Check if we already have permission or just try to start
    // We want the default state to be "Available"
    if (!isBroadcasting) {
      toggleBroadcasting(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Real-time Session Stats Subscription
  useEffect(() => {
    if (!isBroadcasting) return;

    // Subscribe to my own session to get real-time stats (interested count, etc)
    const unsub = FirestoreService.subscribeToSession(profile.id, (session) => {
      if (session && session.stats) {
        setLiveStats(session.stats);
      }
    });
    return () => unsub();
  }, [isBroadcasting, profile.id]);

  const toggleBroadcasting = async (shouldBroadcast: boolean) => {
    if (shouldBroadcast) {
      if (!navigator.geolocation) {
        alert("Geolocation is required to broadcast.");
        return;
      }
      navigator.geolocation.getCurrentPosition(async (pos) => {
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });

        const session: AuraSession = {
          uid: profile.id,
          nickname: profile.identity.nickname,
          icon: profile.identity.icon,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          mood: profile.mood,
          statusMessage: profile.identity.statusMessage,
          ageRange: profile.identity.ageRange,
          gender: profile.identity.gender,
          status: profile.identity.status,
          seeking: profile.seeking,
          stats: profile.identity.stats,
          lastSeen: null, // Set by server
          geohash: '', // Set by server utils
          vibeColor: vibeColor,
          pulseBPM: pulseBPM,
          youtubeUrl: youtubeUrl
        };

        await FirestoreService.createSession(session);
        setIsBroadcasting(true);
      });
    } else {
      await FirestoreService.deleteSession(profile.id);
      setIsBroadcasting(false);
    }
  };

  const updateBroadcastData = async (updates: Partial<AuraSession>) => {
    if (isBroadcasting) {
      await FirestoreService.updateSession(profile.id, updates);
    }
  };


  const moodCounts = MOODS.reduce((acc, mood) => {
    acc[mood] = nearbyUsers.filter(u => u.mood === mood && u.dist <= scanRange).length;
    return acc;
  }, {} as Record<string, number>);

  const filteredRadarUsers = nearbyUsers.filter(user => {
    if (user.dist > scanRange) return false;

    // Safety & Preference Logic
    // Strict Seeking Preferences Filter (User Request)
    const matchesGender = profile.seeking.gender === 'Everyone' || user.gender === profile.seeking.gender;
    const matchesStatus = profile.seeking.status === 'All' || user.status === profile.seeking.status;
    // We also keep Age Range as it's in the UI
    const matchesAge = profile.seeking.ageRange === 'All' || user.ageRange === profile.seeking.ageRange;

    if (!matchesGender || !matchesStatus || !matchesAge) return false;

    // Optional: Keep Mutual Match for Safety (Commented out if user thinks it's 'broken' but good for production)
    // const theyLikeMyGender = user.seeking.gender === 'Everyone' || profile.identity.gender === user.seeking.gender;
    // if (!theyLikeMyGender) return false; 

    // Visibility 'PREFS' vs 'ALL' is now redundant if we always filter, 
    // but we can keep the variable for potential future UI toggles. 
    // For now, this core logic ensures "Seeking" settings actually work.

    if (selectedMoodFilter !== 'ALL') {
      return user.mood === selectedMoodFilter;
    }
    return true;
  });

  const openChat = (userId: string) => {
    setActiveChatUserId(userId);
    setActiveTab('CHATS');
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || !activeChatUserId) return;

    try {
      await FirestoreService.sendMessage(activeChatUserId, chatInput, profile.id);
      setChatInput('');
    } catch (e) {
      console.error("Failed to send", e);
    }
  };

  const renderIcon = (icon: string) => {
    if (icon?.startsWith('data:image')) {
      return <img src={icon} className="w-full h-full object-cover rounded-lg relative z-10" alt="Avatar" />;
    }
    return <span className="text-4xl relative z-10">{icon}</span>;
  };

  const saveNickname = () => {
    onUpdateNickname(tempNickname);
    setIsEditingNickname(false);
    updateBroadcastData({ nickname: tempNickname });
  };

  const saveStatus = () => {
    onUpdateStatusMessage(tempStatus);
    setIsEditingStatus(false);
    updateBroadcastData({ statusMessage: tempStatus });
  };

  const handleManualRegenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRegenerating(true);
    const tag = await generateVibeTagline(profile);
    onUpdateStatusMessage(tag);
    setTempStatus(tag);
    setIsRegenerating(false);
    updateBroadcastData({ statusMessage: tag });
  };

  const handleIconFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const resized = await resizeImage(file);
        onUpdateIcon(resized);
        updateBroadcastData({ icon: resized });
      } catch (err) {
        console.error("Image resize failed", err);
      }
    }
  };

  const toggleInterest = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        FirestoreService.updateInterest(id, -1);
      } else {
        next.add(id);
        FirestoreService.updateInterest(id, 1);
      }
      return next;
    });
  };

  const handleWipeSessionWrap = async () => {
    await FirestoreService.deleteSession(profile.id);
    onWipeSession();
  };

  // UI Derived state
  const isGhostMode = !isBroadcasting; // Mapping for UI compatibility

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden bg-slate-950 relative">
      {/* Dynamic Header */}
      <div className="flex items-center justify-between mb-6 px-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isGhostMode ? 'bg-slate-600' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse'}`} />

          <div className="h-4 w-[1px] bg-white/10 mx-1" />

          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            {profile.identity.nickname || "GHOST"} <span className="text-slate-700 mx-2">/</span> <span className="text-indigo-400">{profile.mood}</span>
          </span>
        </div>
        <div className="text-[9px] font-mono text-slate-600 bg-slate-900 px-2 py-0.5 rounded border border-white/5 uppercase">
          Scanning {scanRange}M
        </div>
      </div>

      {activeTab === 'AURA' && (
        <div className="flex-1 overflow-y-auto hide-scrollbar pb-32">
          <div className="mb-6">
            <div className="mb-6 space-y-4">
              {/* Status Toggle Card */}
              <div
                onClick={() => toggleBroadcasting(!isBroadcasting)}
                className={`p-6 rounded-[2rem] border transition-all cursor-pointer relative overflow-hidden group ${isBroadcasting ? 'bg-emerald-900/20 border-emerald-500/30 hover:bg-emerald-900/30' : 'bg-slate-900/50 border-white/5 hover:border-white/10'}`}
              >
                <div className={`absolute top-0 right-0 p-32 rounded-full blur-[60px] transition-all duration-700 ${isBroadcasting ? 'bg-emerald-500/10' : 'bg-slate-500/5'}`} />

                <div className="relative flex items-center justify-between">
                  <div>
                    <h3 className={`text-xl font-black uppercase tracking-tight mb-1 ${isBroadcasting ? 'text-white' : 'text-slate-400'}`}>
                      {isBroadcasting ? 'Broadcasting Live' : 'Stealth Mode'}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {isBroadcasting ? 'Visible to nearby auras' : 'You are hidden from radar'}
                    </p>
                  </div>

                  <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${isBroadcasting ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                    <div className={`w-6 h-6 rounded-full bg-white shadow-lg transform transition-transform duration-300 ${isBroadcasting ? 'translate-x-6' : 'translate-x-0'}`} />
                  </div>
                </div>
              </div>

              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 mb-2 mt-8 px-2">Aura Configuration</h2>

              <div className="glass p-8 rounded-[3rem] border-white/10 relative overflow-hidden group shadow-2xl">
                <div className="absolute -right-4 -top-4 w-48 h-48 bg-indigo-500/10 rounded-full blur-[80px]" />

                <div className="flex justify-between items-start mb-8">
                  <div className="space-y-6 flex-1 pr-4">
                    <div className="mb-4">
                      {isEditingNickname ? (
                        <input
                          autoFocus
                          type="text"
                          aria-label="Edit Nickname"
                          className="bg-slate-900 border border-indigo-500/50 rounded-xl px-3 py-2 text-lg font-bold text-white outline-none w-full"
                          value={tempNickname}
                          onChange={(e) => setTempNickname(e.target.value)}
                          onBlur={saveNickname}
                          onKeyDown={(e) => e.key === 'Enter' && saveNickname()}
                        />
                      ) : (
                        <div className="flex items-center gap-3 group/nick cursor-pointer" onClick={() => setIsEditingNickname(true)}>
                          <h3 className="text-3xl font-black text-white tracking-tight leading-none">{profile.identity.nickname || "Set Nickname..."}</h3>
                          <svg className="w-4 h-4 text-slate-600 opacity-0 group-hover/nick:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Stamp text={`${profile.identity.gender.charAt(0)} | ${profile.identity.ageRange} | ${profile.identity.status}`} color="text-indigo-400" rotation="-rotate-1" />
                      <Stamp text={profile.mood} color="text-emerald-400" rotation="rotate-1" highlight />
                    </div>
                  </div>

                  <div
                    onClick={() => isBroadcasting && fileInputRef.current?.click()}
                    className={`w-20 h-20 rounded-3xl bg-slate-900 border border-white/10 flex items-center justify-center relative shadow-inner overflow-hidden shrink-0 transition-all ${isBroadcasting ? 'cursor-pointer hover:border-indigo-500/50 hover:scale-105 active:scale-95 group/icon-main' : 'opacity-50'}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent" />
                    {!isBroadcasting ? <span className="text-4xl grayscale opacity-50">👻</span> : renderIcon(profile.identity.icon)}
                    {isBroadcasting && (
                      <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover/icon-main:opacity-100 flex items-center justify-center transition-opacity z-20">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </div>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleIconFileChange} className="hidden" accept="image/*" aria-label="Upload Profile Icon" />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="relative group/status cursor-pointer border-l-2 border-indigo-500/30 pl-4 mb-4">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Active Pulse Status</label>
                    {isEditingStatus ? (
                      <textarea
                        autoFocus
                        rows={3}
                        aria-label="Edit Status Message"
                        className="bg-slate-900 border border-indigo-500/50 rounded-xl p-3 text-sm font-medium italic text-indigo-400/90 outline-none w-full resize-none leading-relaxed"
                        value={tempStatus}
                        onChange={(e) => setTempStatus(e.target.value)}
                        onBlur={saveStatus}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && saveStatus()}
                      />
                    ) : (
                      <div className="flex items-start justify-between gap-4" onClick={() => setIsEditingStatus(true)}>
                        <p className={`text-sm font-medium italic leading-relaxed transition-opacity ${isRegenerating ? 'opacity-30' : 'text-indigo-400/90'}`}>
                          "{profile.identity.statusMessage || "Pulse a secret status..."}"
                        </p>
                        <button
                          onClick={handleManualRegenerate}
                          disabled={isRegenerating}
                          aria-label="Regenerate Status"
                          title="Regenerate Status"
                          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors opacity-0 group-hover/status:opacity-100"
                        >
                          <svg className={`w-4 h-4 text-indigo-400/60 ${isRegenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-8 pl-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-500">
                        <PulseIcon className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-pink-500/70 uppercase tracking-tighter leading-none mb-1">Aura Pings</span>
                        <span className="text-lg font-black text-white leading-none">{isBroadcasting ? liveStats.interested : profile.identity.stats.interested}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500">
                        <RadarIcon className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-cyan-500/70 uppercase tracking-tighter leading-none mb-1">On Radar</span>
                        <span className="text-lg font-black text-white leading-none">{isBroadcasting ? liveStats.inRadar : profile.identity.stats.inRadar}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 mt-8 border-t border-white/5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4 px-1 flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${isBroadcasting ? 'bg-indigo-500 animate-pulse' : 'bg-slate-700'}`} />
                    Mood Broadcast
                  </label>
                  <div className="relative">
                    <select
                      value={profile.mood}
                      aria-label="Broadcast Mood"
                      onChange={(e) => {
                        const m = e.target.value as MoodType;
                        onUpdateMood(m);
                        if (isBroadcasting) updateBroadcastData({ mood: m });
                        else toggleBroadcasting(true); // Auto-start broadcast on mood select
                      }}
                      className="w-full bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl text-sm font-black p-4 pr-12 appearance-none outline-none focus:ring-2 focus:ring-indigo-500/40 text-slate-100 cursor-pointer transition-all hover:bg-slate-900/80 shadow-inner"
                    >
                      {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'RADAR' && (
        <>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-6 shrink-0 px-2 -mx-2">
            <button
              onClick={() => setSelectedMoodFilter('ALL')}
              className={`whitespace-nowrap px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedMoodFilter === 'ALL' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900 text-slate-500 border border-white/5'}`}
            >
              All Clusters
            </button>
            {MOODS.map(mood => (
              <button
                key={mood}
                onClick={() => setSelectedMoodFilter(mood)}
                className={`whitespace-nowrap px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${selectedMoodFilter === mood ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-900 text-slate-500 border border-white/5'}`}
              >
                {mood}
                <span className="px-1.5 py-0.5 rounded-md text-[8px] bg-slate-800 text-slate-600 font-mono">{moodCounts[mood] || 0}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto hide-scrollbar pb-32 space-y-4 px-1">
            {filteredRadarUsers.length === 0 ? (
              <div className="py-20 text-center opacity-40 px-8">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">No matching signals within {scanRange}M</p>
                <p className="text-[8px] font-bold text-slate-600 mt-2">Adjust tuning or preferences in "Tune" tab</p>
              </div>
            ) : filteredRadarUsers.map((user) => (
              <div
                key={user.id}
                className={`relative flex flex-col gap-4 p-6 glass rounded-[2.5rem] border hover:border-indigo-500/40 transition-all cursor-pointer group/card ${likedUserIds.has(user.id) ? 'border-pink-500/40 bg-pink-500/5' : 'border-indigo-500/5'}`}
                onClick={(e) => {
                  // Prevent triggering if clicking specific inner buttons
                  if ((e.target as HTMLElement).closest('button')) return;
                  toggleInterest(user.id, e);
                }}
              >
                {/* Visual "Pulse Sent" Indicator Overlay */}
                {likedUserIds.has(user.id) && (
                  <div className="absolute top-4 right-4 pointer-events-none animate-pulse">
                    <div className="bg-pink-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded-full shadow-lg tracking-widest">
                      PULSED
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xl font-black text-white tracking-tight leading-none mb-1 group-hover/card:text-indigo-300 transition-colors">{user.nickname}</h4>
                    <p className="text-[10px] font-black text-indigo-400 mb-2 uppercase tracking-wide">
                      {user.gender.charAt(0)} | {user.ageRange} | {user.status}
                    </p>
                    <p className="text-[11px] font-medium text-slate-400 italic leading-relaxed">"{user.statusMessage}"</p>
                  </div>
                  <span className="text-[10px] font-black text-slate-600 font-mono bg-slate-900/80 px-2 py-1 rounded-lg border border-white/5">{user.dist}M</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Stamp text={user.mood} color="text-emerald-400" rotation="-rotate-1" highlight />
                </div>
                <div className="flex items-center justify-between mt-2 pt-4 border-t border-white/5">
                  <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-1.5 text-pink-500">
                      <PulseIcon className="w-5 h-5" />
                      <span className="text-sm font-black">{user.stats.interested}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-cyan-500">
                      <RadarIcon className="w-5 h-5" />
                      <span className="text-sm font-black">{user.stats.inRadar}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Handle separately
                        toggleInterest(user.id, e);
                      }}
                      aria-label={likedUserIds.has(user.id) ? "Unlike User" : "Like User"}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${likedUserIds.has(user.id) ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30 ring-2 ring-pink-500/50' : 'bg-white/5 text-slate-500 hover:text-pink-400 hover:bg-white/10'}`}
                    >
                      <PulseIcon className="w-6 h-6" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openChat(user.id);
                      }}
                      aria-label="Open Chat"
                      className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all shadow-sm active:scale-90"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'CHATS' && (
        <div className="flex-1 flex flex-col pt-4 overflow-hidden h-full">
          {!activeChatUserId ? (
            <div className="flex-1 overflow-y-auto hide-scrollbar pb-32">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 mb-6 px-2">Secure Threads</h2>
              <div className="space-y-4">
                {conversations.length === 0 ? (
                  <div className="text-center py-20 px-8 opacity-40">
                    <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em]">No signals intercepted</p>
                  </div>
                ) : (
                  conversations
                    .filter(conv => {
                      // Ephemeral Chat Logic: Hide chats inactive for > 12 hours
                      const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
                      return conv.lastUpdated > twelveHoursAgo;
                    })
                    .map(conv => {
                      const otherUid = conv.participants.find((p: string) => p !== profile.id);
                      const user = nearbyUsers.find(u => u.id === otherUid);
                      // If user is not nearby, they might be offline. 
                      const isOutOfRange = !user || user.dist > scanRange;

                      return (
                        <div key={conv.id} onClick={() => setActiveChatUserId(otherUid)} className={`glass p-5 rounded-3xl flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-all ${!user ? 'opacity-50 grayscale' : ''}`}>
                          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-xl shrink-0">
                            {user?.icon ? renderIcon(user.icon) : '👤'}
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <div className="flex justify-between items-center mb-1">
                              <h4 className="font-black text-sm text-white">{user?.nickname || 'Offline Signal'}</h4>
                              <span className={`text-[8px] font-mono uppercase tracking-tighter ${!user ? 'text-slate-500' : 'text-emerald-500'}`}>
                                {!user ? 'OFFLINE' : (isOutOfRange ? 'Beyond Radar' : 'Pulsing')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 truncate font-medium italic">"{conv.lastMessage || 'Encrypted signal...'}"</p>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col pb-32">
              <div className="flex items-center gap-4 mb-6 px-2 shrink-0">
                <button onClick={() => setActiveChatUserId(null)} aria-label="Back to Radar" className="w-10 h-10 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-center text-indigo-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="flex-1">
                  <h3 className="text-lg font-black text-white leading-none mb-1">{nearbyUsers.find(u => u.id === activeChatUserId)?.nickname || 'Unknown Signal'}</h3>
                  <div className="flex gap-1.5">
                    <span className={`text-[8px] font-black uppercase tracking-widest ${!nearbyUsers.find(u => u.id === activeChatUserId) ? 'text-slate-500' : 'text-emerald-400'}`}>
                      {!nearbyUsers.find(u => u.id === activeChatUserId) ? 'OFFLINE' : (nearbyUsers.find(u => u.id === activeChatUserId)?.dist! > scanRange ? 'BEYOND RADAR' : nearbyUsers.find(u => u.id === activeChatUserId)?.mood)}
                    </span>
                  </div>
                </div>
              </div>

              <div ref={chatScrollRef} className="flex-1 overflow-y-auto hide-scrollbar space-y-4 px-2 mb-4 flex flex-col">
                {activeMessages.map(msg => (
                  <div key={msg.id} className={`max-w-[80%] p-4 rounded-3xl text-sm font-medium leading-relaxed ${msg.senderId === profile.id ? 'bg-indigo-600 text-white self-end rounded-tr-none shadow-lg' : 'bg-slate-900 border border-white/5 text-slate-300 self-start rounded-tl-none'}`}>
                    {msg.text}
                  </div>
                ))}
                {isTyping && (
                  <div className="self-start bg-slate-900 border border-white/5 text-slate-500 p-4 rounded-3xl rounded-tl-none flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest animate-pulse">Pulse incoming...</span>
                  </div>
                )}
              </div>

              <div className="relative shrink-0">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Enter private signal..."
                  className="w-full bg-slate-900 border border-white/10 rounded-3xl p-5 pr-16 text-sm font-bold text-white outline-none focus:border-indigo-500 transition-all"
                />
                <button onClick={sendMessage} aria-label="Send Message" className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg active:scale-90 transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )
      }

      {
        activeTab === 'CONTROLS' && (
          <div className="flex-1 flex flex-col pt-4 overflow-y-auto hide-scrollbar pb-32">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 mb-8 px-2">Aura Control Center</h2>
            <div className="space-y-6 px-2">

              {/* Radar Tuning Section */}
              <div className="glass p-7 rounded-[2.5rem] border-white/5 space-y-8">
                <div className="flex items-center gap-3">
                  <RadarIcon className="w-5 h-5 text-indigo-400" />
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Radar Tuning</label>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-3 px-1">Scan Radius (Distance)</label>
                    <div className="relative">
                      <select
                        value={scanRange}
                        aria-label="Select Scan Range"
                        onChange={(e) => setScanRange(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-xs font-bold text-slate-200 appearance-none outline-none focus:border-indigo-500 transition-all shadow-inner"
                      >
                        <option value={25}>25 Meters (Internal / Ultra Local)</option>
                        <option value={50}>50 Meters (Cafe / Bar Scale)</option>
                        <option value={100}>100 Meters (Block Scale)</option>
                        <option value={150}>150 Meters (Immediate Vicinity)</option>
                        <option value={200}>200 Meters (Max Discovery)</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-3 px-1">Vibe Frequency (BPM)</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="40"
                        max="180"
                        step="5"
                        aria-label="Pulse BPM Slider"
                        value={pulseBPM}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setPulseBPM(val);
                          if (isBroadcasting) updateBroadcastData({ pulseBPM: val });
                        }}
                        className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <span className="text-xs font-mono font-bold text-indigo-400 w-12 text-right">{pulseBPM}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-3 px-1">Aura Color</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={vibeColor}
                        aria-label="Vibe Color Picker"
                        onChange={(e) => {
                          const val = e.target.value;
                          setVibeColor(val);
                          if (isBroadcasting) updateBroadcastData({ vibeColor: val });
                        }}
                        className="w-10 h-10 rounded-xl border-none cursor-pointer bg-transparent"
                      />
                      <span className="text-xs font-mono text-slate-500 uppercase">{vibeColor}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-3 px-1">Vibe Soundtrack (YouTube Link)</label>
                    <input
                      type="text"
                      placeholder="Check the pulse with a song..."
                      aria-label="YouTube Soundtrack URL"
                      value={youtubeUrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        setYoutubeUrl(val);
                        if (isBroadcasting) updateBroadcastData({ youtubeUrl: val });
                      }}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-indigo-500 placeholder:text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-3 px-1">Signal Filter (Who to Scan)</label>
                    <div className="relative">
                      <select
                        value={visibilityLevel}
                        aria-label="Select Visibility Filter"
                        onChange={(e) => setVisibilityLevel(e.target.value as 'ALL' | 'PREFS')}
                        className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-xs font-bold text-slate-200 appearance-none outline-none focus:border-indigo-500 transition-all shadow-inner"
                      >
                        <option value="ALL">Show All Nearby Signals (Unfiltered)</option>
                        <option value="PREFS">Match My Preference Logic (Mutual Only)</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                    <p className="text-[8px] text-slate-600 mt-2 px-1 font-bold italic leading-tight uppercase">
                      Note: "Mutual Only" ensures privacy and safety by only showing you to people you want to see, and vice-versa.
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass p-7 rounded-[2.5rem] border-white/5 relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all" />
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">👻</span>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Stealth Pulse</label>
                  </div>
                  <button onClick={() => toggleBroadcasting(!isBroadcasting)} aria-label="Toggle Stealth Mode" className={`w-14 h-7 rounded-full relative transition-all shadow-inner ${isBroadcasting ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${isBroadcasting ? 'left-8' : 'left-1'}`} />
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic pr-12">"Your presence remains invisible until you toggle this switch ON."</p>
              </div>

              <div className="pt-2">
                <button
                  onClick={onEditProfile}
                  className="w-full flex items-center justify-between p-7 glass rounded-[2.5rem] border-indigo-500/10 hover:border-indigo-500/30 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <div className="text-left">
                      <span className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Aura Identity</span>
                      <span className="text-sm font-bold text-white">Refine Profile Aura</span>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              <button
                onClick={onWipeSession}
                className="w-full mt-8 text-[10px] font-black text-red-500/60 uppercase tracking-widest py-6 border border-red-500/10 rounded-[2.5rem] hover:bg-red-500/5 transition-all"
              >
                WIPE AURA SESSION
              </button>
            </div>
          </div>
        )
      }

      {/* Persistent Navigation */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-6 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pointer-events-none z-50">
        <div className="glass h-20 rounded-[2.5rem] flex justify-around items-center px-4 pointer-events-auto border-white/5 shadow-2xl overflow-hidden relative">
          <button onClick={() => setActiveTab('AURA')} className={`flex-1 flex flex-col items-center gap-1.5 transition-all ${activeTab === 'AURA' ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`}>
            <div className={`p-2 rounded-2xl transition-all duration-300 ${activeTab === 'AURA' ? 'bg-indigo-500/15 scale-110' : ''}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <span className="text-[7px] font-black uppercase tracking-widest">Aura</span>
          </button>

          <button onClick={() => setActiveTab('RADAR')} className={`flex-1 flex flex-col items-center gap-1.5 transition-all ${activeTab === 'RADAR' ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`}>
            <div className={`p-2 rounded-2xl transition-all duration-300 ${activeTab === 'RADAR' ? 'bg-indigo-500/15 scale-110' : ''}`}>
              <RadarIcon className="w-6 h-6" />
            </div>
            <span className="text-[7px] font-black uppercase tracking-widest">Radar</span>
          </button>

          <button onClick={() => setActiveTab('CHATS')} className={`flex-1 flex flex-col items-center gap-1.5 transition-all ${activeTab === 'CHATS' ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`}>
            <div className={`p-2 rounded-2xl transition-all duration-300 ${activeTab === 'CHATS' ? 'bg-indigo-500/15 scale-110' : ''}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <span className="text-[7px] font-black uppercase tracking-widest">Threads</span>
          </button>

          <button onClick={() => setActiveTab('CONTROLS')} className={`flex-1 flex flex-col items-center gap-1.5 transition-all ${activeTab === 'CONTROLS' ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`}>
            <div className={`p-2 rounded-2xl transition-all duration-300 ${activeTab === 'CONTROLS' ? 'bg-indigo-500/15 scale-110' : ''}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17" /></svg>
            </div>
            <span className="text-[7px] font-black uppercase tracking-widest">Tune</span>
          </button>
        </div>
      </div>

      {/* DEBUG FOOTER (Temporary) */}
      <div className="fixed bottom-0 left-0 w-full bg-black/90 text-[10px] text-green-400 font-mono p-1 z-50 pointer-events-none flex justify-between px-2 flex-wrap">
        <span>LOC: {currentLocation ? `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : 'WAITING'}</span>
        <span>RANGE: {scanRange}m</span>
        <span>NEARBY: {nearbyUsers.length}</span>
        <span className={isBroadcasting ? "text-green-400" : "text-red-500"}>
          SIGNAL: {isBroadcasting ? "LIVE" : "OFF (STEALTH)"}
        </span>
      </div>
    </div >
  );
};
