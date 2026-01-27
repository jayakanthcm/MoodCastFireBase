
import React, { useState, useRef, useEffect } from 'react';
import { resizeImage } from '../services/imageUtils';
import { UserProfile, Gender, RelationshipStatus, Preference, AgeRange, AgePreference, StatusPreference } from '../types';
import { GENDERS, REL_STATUS, AGE_BRACKETS } from '../constants';

interface Props {
  onSave: (profile: UserProfile) => void;
  initialData?: UserProfile | null;
  onCancel?: () => void;
}

const ICON_PRESETS = ['👤', '🐱', '🦊', '🐯', '🤖', '👾', '👻', '🌈', '💎', '🔥'];

export const ProfileSetup: React.FC<Props> = ({ onSave, initialData, onCancel }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    identity: {
      nickname: '',
      gender: 'Male',
      ageRange: '18-25',
      status: 'Single',
      statusMessage: '',
      icon: '👤',
      stats: {
        interested: 0,
        inRadar: 0
      }
    },
    seeking: {
      gender: 'Everyone',
      ageRange: 'All',
      status: 'All'
    },
    mood: 'Cozy'
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.identity && formData.seeking) {
      onSave({
        ...formData,
        id: initialData?.id || Math.random().toString(36).substr(2, 9),
        location: initialData?.location || { lat: 0, lng: 0 }
      } as UserProfile);
    }
  };

  const updateIdentity = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      identity: { ...prev.identity!, [key]: value }
    }));
  };

  const updateSeeking = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      seeking: { ...prev.seeking!, [key]: value }
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const resized = await resizeImage(file);
        updateIdentity('icon', resized);
      } catch (err) {
        console.error("Image resize failed", err);
      }
    }
  };

  const removeCustomIcon = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateIdentity('icon', ICON_PRESETS[0]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const SelectionGroup = ({ label, items, activeItem, onSelect, activeClass }: any) => (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-3 px-1">{label}</label>
      <div className="flex flex-wrap gap-2">
        {items.map((item: string) => (
          <button
            key={item}
            type="button"
            onClick={() => onSelect(item)}
            className={`px-4 py-3 rounded-xl text-xs font-bold border transition-all duration-200 ${activeItem === item
              ? activeClass
              : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
              }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );

  const isCustomIcon = (icon: string) => icon?.startsWith('data:image');

  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto hide-scrollbar bg-slate-950">
      <div className="flex justify-between items-start mb-10">
        <div>
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">
            {initialData ? 'Refine Aura' : 'Setup Aura'}
          </h2>
          <p className="text-slate-500 text-sm font-medium">Define your presence on the radar.</p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            aria-label="Cancel Setup"
            className="w-10 h-10 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-12 pb-24">
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-[10px] font-black italic shadow-lg shadow-indigo-600/20">ID</div>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-400">My Identity</h3>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2 px-1">Nickname</label>
              <input
                type="text"
                placeholder="Enter a secret nickname..."
                value={formData.identity?.nickname}
                onChange={(e) => updateIdentity('nickname', e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 outline-none focus:border-indigo-500 font-bold text-white placeholder:text-slate-700 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-4 px-1">Profile Icon</label>
              <div className="flex flex-wrap gap-3 items-center">
                {ICON_PRESETS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => updateIdentity('icon', icon)}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl border transition-all ${formData.identity?.icon === icon
                      ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-500/20 scale-110'
                      : 'bg-slate-900 border-slate-800'
                      }`}
                  >
                    {icon}
                  </button>
                ))}
                <div className="relative group/icon">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all overflow-hidden ${isCustomIcon(formData.identity?.icon || '')
                      ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-500/20 scale-110'
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                      }`}
                  >
                    {isCustomIcon(formData.identity?.icon || '') ? (
                      <img src={formData.identity?.icon} className="w-full h-full object-cover" alt="Custom" />
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                  </button>
                  {isCustomIcon(formData.identity?.icon || '') && (
                    <button
                      type="button"
                      onClick={removeCustomIcon}
                      aria-label="Remove Custom Icon"
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors z-20 scale-110"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" aria-label="Upload Custom Icon" />
              </div>
            </div>

            <SelectionGroup
              label="I am a" items={GENDERS} activeItem={formData.identity?.gender}
              onSelect={(v: Gender) => updateIdentity('gender', v)}
              activeClass="bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
            />

            <SelectionGroup
              label="My Age Range" items={AGE_BRACKETS} activeItem={formData.identity?.ageRange}
              onSelect={(v: AgeRange) => updateIdentity('ageRange', v)}
              activeClass="bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
            />

            <SelectionGroup
              label="My Status" items={REL_STATUS} activeItem={formData.identity?.status}
              onSelect={(v: RelationshipStatus) => updateIdentity('status', v)}
              activeClass="bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
            />
          </div>
        </section>

        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-[10px] font-black italic shadow-lg shadow-emerald-600/20">SO</div>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-400">Seeking</h3>
          </div>

          <div className="space-y-6">
            <SelectionGroup
              label="Preference" items={[...GENDERS, 'Everyone']} activeItem={formData.seeking?.gender}
              onSelect={(v: Preference) => updateSeeking('gender', v)}
              activeClass="bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20"
            />

            <SelectionGroup
              label="Target Age Range" items={[...AGE_BRACKETS, 'All']} activeItem={formData.seeking?.ageRange}
              onSelect={(v: AgePreference) => updateSeeking('ageRange', v)}
              activeClass="bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20"
            />

            <SelectionGroup
              label="Target Status" items={[...REL_STATUS, 'All']} activeItem={formData.seeking?.status}
              onSelect={(v: StatusPreference) => updateSeeking('status', v)}
              activeClass="bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20"
            />
          </div>
        </section>

        <button
          type="submit"
          className="w-full py-5 bg-white text-slate-950 rounded-[2rem] font-black text-lg shadow-2xl hover:bg-slate-200 transition-all active:scale-[0.98] mt-8"
        >
          {initialData ? 'UPDATE AURA' : 'GENERATE AURA'}
        </button>
      </form>
    </div>
  );
};
