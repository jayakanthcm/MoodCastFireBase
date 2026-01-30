
export type Gender = 'Male' | 'Female' | 'Non-binary' | 'Other';
export type Preference = Gender | 'Everyone';
export type RelationshipStatus = 'Single' | 'Married' | 'Divorced' | 'Widowed' | 'Complicated';
export type MoodType = 'Cozy' | 'Solo dolo' | 'Rizzing' | 'Freaky' | 'Sendy';
export type AgeRange = '18-25' | '25-35' | '35-45' | '45-55' | '55-65' | 'Above 65';
export type AgePreference = AgeRange | 'All';
export type StatusPreference = RelationshipStatus | 'All';

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

export interface ChatThread {
  userId: string;
  messages: ChatMessage[];
  lastActivity: number;
}

export interface UserProfile {
  id: string;
  identity: {
    nickname: string;
    gender: Gender;
    ageRange: AgeRange;
    status: RelationshipStatus;
    statusMessage: string;
    icon: string;
    stats: {
      interested: number;
      inRadar: number;
    };
  };
  seeking: {
    gender: Preference;
    ageRange: AgePreference;
    status: StatusPreference;
  };
  mood: MoodType;
  location: {
    lat: number;
    lng: number;
  };
}

export interface AppState {
  isOnboarded: boolean;
  isVerified: boolean;
  profile: UserProfile | null;
  currentStep: 'AGREEMENT' | 'VERIFICATION' | 'PROFILE_SETUP' | 'MAIN';
  unverifiedEmail?: string | null;
}

export interface LiveAura {
  uid: string;
  nickname: string;
  icon: string;
  geohash: string;
  lat: number;
  lng: number;
  mood: MoodType;
  statusMessage: string;
  vibeColor: string;
  pulseBPM: number;
  youtubeUrl?: string;
  ageRange: AgeRange;
  gender: Gender;
  status: RelationshipStatus;
  seeking: {
    gender: Preference;
    ageRange: AgePreference;
    status: StatusPreference;
  };
  stats: {
    interested: number; // Replcaes pins
    inRadar: number;
    pulsedBy?: string[]; // Array of UIDs who have pulsed this user
  };
  lastSeen: any; // Firestore Timestamp
}

export type AuraSession = LiveAura; // Alias for backward compatibility during refactor
