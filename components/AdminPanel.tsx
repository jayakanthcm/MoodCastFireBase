import * as React from 'react';
import { useEffect, useState } from 'react';
import { FirestoreService } from '../services/firestoreService';
import { AuraSession } from '../types';

export const AdminPanel: React.FC = () => {
    const [sessions, setSessions] = useState<AuraSession[]>([]);
    const [conversations, setConversations] = useState<any[]>([]);

    useEffect(() => {
        // Reuse existing subscribeToRadar (which gets all sessions)
        const unsubSessions = FirestoreService.subscribeToRadar([0, 0], 100000000, (s) => setSessions(s));

        // Subscribe to all conversations
        const unsubConvs = FirestoreService.subscribeToAllConversations((c) => setConversations(c));

        return () => {
            unsubSessions();
            unsubConvs();
        };
    }, []);

    const handleWipe = async () => {
        // eslint-disable-next-line restricted-globals
        if (confirm("WARNING: This will delete ALL Active Sessions and ALL Threads. Are you sure?")) {
            await FirestoreService.adminWipeAll();
            alert("Database Wiped.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8 font-mono">
            <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                <h1 className="text-2xl font-black uppercase text-indigo-500">Aura Admin Portal</h1>
                <button onClick={handleWipe} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-bold uppercase text-xs tracking-widest">
                    FORCE RESET DB
                </button>
            </div>

            <div className="grid grid-cols-2 gap-8">
                {/* Active Sessions */}
                <div className="space-y-4">
                    <h2 className="text-sm font-bold uppercase text-slate-500 tracking-widest border-b border-white/5 pb-2">Active Aura Sessions ({sessions.length})</h2>
                    <div className="space-y-2">
                        {sessions.map(s => (
                            <div key={s.uid} className="bg-slate-900 p-4 rounded border border-white/5 text-xs">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xl">{s.icon}</span>
                                    <span className="font-bold text-emerald-400">{s.nickname}</span>
                                    <span className="text-slate-500">({s.uid.substring(0, 6)}...)</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-slate-400">
                                    <div>Mood: <span className="text-white">{s.mood}</span></div>
                                    <div>Status: "{s.statusMessage}"</div>
                                    <div>Gen/Age: {s.gender}/{s.ageRange}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Conversations */}
                <div className="space-y-4">
                    <h2 className="text-sm font-bold uppercase text-slate-500 tracking-widest border-b border-white/5 pb-2">Active Threads ({conversations.length})</h2>
                    <div className="space-y-2">
                        {conversations.map(c => (
                            <div key={c.id} className="bg-slate-900 p-4 rounded border border-white/5 text-xs">
                                <div className="mb-2 font-bold text-indigo-400 break-all">{c.id}</div>
                                <div className="text-slate-500 mb-2">Participants: {c.participants?.join(', ')}</div>
                                <div className="italic text-slate-300">Last: "{c.lastMessage}"</div>
                                <div className="text-[10px] text-slate-600 mt-1">{new Date(c.lastUpdated).toLocaleString()}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
