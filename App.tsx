import * as React from 'react';
import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Onboarding } from './components/Onboarding';
import { Verification } from './components/Verification';
import { ProfileSetup } from './components/ProfileSetup';
import { MainView } from './components/MainView';
import { UserProfile, MoodType, AppState } from './types';
import { auth } from './services/firebase';
import { FirestoreService } from './services/firestoreService';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { AdminPanel } from './components/AdminPanel';
import { ErrorBoundary } from './components/ErrorBoundary';

const textInitialState: AppState = {
  isOnboarded: false,
  isVerified: false,
  profile: null,
  currentStep: 'AGREEMENT',
  unverifiedEmail: null,
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(textInitialState);
  const [showAdmin, setShowAdmin] = useState(window.location.hash === '#admin-aura');

  useEffect(() => {
    const handleHashChange = () => {
      setShowAdmin(window.location.hash === '#admin-aura');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        if (!user.emailVerified) {
          // User is logged in but not verified
          setState(prev => ({
            ...prev,
            currentStep: 'VERIFICATION',
            unverifiedEmail: user.email,
            profile: null // Ensure no profile access
          }));
          return;
        }

        // Check if persistent profile exists
        try {
          const persistentProfile = await FirestoreService.getUserProfile(user.uid);

          if (persistentProfile) {
            // User has a profile, load it and go to MAIN
            const fullProfile: UserProfile = {
              id: persistentProfile.uid,
              identity: {
                nickname: persistentProfile.nickname,
                gender: persistentProfile.gender as any,
                ageRange: persistentProfile.ageRange as any,
                status: persistentProfile.status as any,
                statusMessage: persistentProfile.statusMessage || "",
                icon: persistentProfile.icon,
                stats: { interested: 0, inRadar: 0 }
              },
              seeking: {
                gender: (persistentProfile.seeking?.gender as any) || 'Everyone',
                ageRange: (persistentProfile.seeking?.ageRange as any) || 'All',
                status: (persistentProfile.seeking?.status as any) || 'All'
              },
              mood: 'Cozy',
              location: { lat: 0, lng: 0 }
            };

            setState(prev => {
              if (prev.profile?.id === user.uid) return prev;
              return {
                ...prev,
                isOnboarded: true,
                isVerified: true,
                profile: fullProfile,
                currentStep: 'MAIN',
                unverifiedEmail: null
              };
            });
          } else {
            // User needs to create a profile (First Time)
            const tempProfile: UserProfile = {
              id: user.uid,
              identity: {
                nickname: user.displayName || user.email?.split('@')[0] || "User",
                gender: 'Male',
                ageRange: '18-25',
                status: 'Single',
                statusMessage: "Ready to vibe",
                icon: '👤',
                stats: { interested: 0, inRadar: 0 }
              },
              seeking: {
                gender: 'Everyone',
                ageRange: 'All',
                status: 'All'
              },
              mood: 'Cozy',
              location: { lat: 0, lng: 0 }
            };

            setState(prev => ({
              ...prev,
              isOnboarded: true,
              isVerified: true,
              profile: tempProfile,
              currentStep: 'PROFILE_SETUP', // Force setup
              unverifiedEmail: null
            }));
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      } else {
        // User logged out
        setState(prev => {
          if (prev.unverifiedEmail && prev.currentStep === 'VERIFICATION') {
            return prev;
          }
          return textInitialState;
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const nextStep = () => {
    setState(prev => {
      if (prev.currentStep === 'AGREEMENT') return { ...prev, currentStep: 'VERIFICATION' };
      if (prev.currentStep === 'VERIFICATION') return { ...prev, currentStep: 'PROFILE_SETUP' };
      if (prev.currentStep === 'PROFILE_SETUP') return { ...prev, currentStep: 'MAIN' };
      return prev;
    });
  };

  const handleSignupSuccess = (email: string) => {
    setState(prev => ({
      ...prev,
      currentStep: 'VERIFICATION',
      unverifiedEmail: email
    }));
  };

  const handleBackToLogin = () => {
    signOut(auth).catch((err: any) => console.error(err));
    setState(textInitialState);
  };

  const handleProfileSave = async (profile: UserProfile) => {
    try {
      // Save to Firestore
      await FirestoreService.saveUserProfile({
        uid: profile.id,
        email: state.unverifiedEmail || auth.currentUser?.email || "",
        nickname: profile.identity.nickname,
        icon: profile.identity.icon,
        ageRange: profile.identity.ageRange,
        gender: profile.identity.gender,
        status: profile.identity.status,
        statusMessage: profile.identity.statusMessage,
        createdAt: null
      });

      setState(prev => ({ ...prev, profile, currentStep: 'MAIN' }));
    } catch (error) {
      console.error("Error saving profile:", error);
    }
  };

  const syncProfileUpdate = async (updatedProfile: UserProfile, changes: Partial<UserProfile['identity']>) => {
    try {
      // Persist to Profile Collection (omit createdAt to preserve original timestamp via merge)
      await FirestoreService.saveUserProfile({
        uid: updatedProfile.id,
        email: auth.currentUser?.email || "",
        nickname: updatedProfile.identity.nickname,
        icon: updatedProfile.identity.icon,
        ageRange: updatedProfile.identity.ageRange,
        gender: updatedProfile.identity.gender,
        status: updatedProfile.identity.status,
        statusMessage: updatedProfile.identity.statusMessage,
        seeking: updatedProfile.seeking,
        createdAt: null // merge:true preserves existing value; only set on first create
      });

      // Only update Active Session if it exists (user is broadcasting)
      try {
        await FirestoreService.updateSession(updatedProfile.id, changes);
      } catch {
        // Session doesn't exist (not broadcasting) — ignore
      }
    } catch (err) {
      console.error("Failed to sync profile update:", err);
    }
  };

  const handleUpdateMood = (mood: MoodType) => {
    if (state.profile) {
      const updated = { ...state.profile, mood };
      setState(prev => ({ ...prev, profile: updated }));
      // Mood is usually broadcast-only, but we can save it if we want persistent mood.
      // For now, MainView handles mood broadcast updates locally interactively. 
      // But let's ensure consistency if needed. MainView calls updateBroadcastData already.
    }
  };

  const handleUpdateNickname = (nickname: string) => {
    if (state.profile) {
      const updated = {
        ...state.profile,
        identity: { ...state.profile.identity, nickname }
      };
      setState(prev => ({ ...prev, profile: updated }));
      syncProfileUpdate(updated, { nickname });
    }
  };

  const handleUpdateStatusMessage = (statusMessage: string) => {
    if (state.profile) {
      const updated = {
        ...state.profile,
        identity: { ...state.profile.identity, statusMessage }
      };
      setState(prev => ({ ...prev, profile: updated }));
      syncProfileUpdate(updated, { statusMessage });
    }
  };

  const handleUpdateIcon = (icon: string) => {
    if (state.profile) {
      const updated = {
        ...state.profile,
        identity: { ...state.profile.identity, icon }
      };
      setState(prev => ({ ...prev, profile: updated }));
      syncProfileUpdate(updated, { icon });
    }
  };

  const handleEditProfileTrigger = () => {
    setState(prev => ({ ...prev, currentStep: 'PROFILE_SETUP' }));
  };

  const handleCancelEdit = () => {
    setState(prev => ({ ...prev, currentStep: 'MAIN' }));
  };

  const handleWipeSession = async () => {
    // Session is already deleted by handleWipeSessionWrap in MainView before this is called.
    // Just sign out to trigger auth state reset.
    signOut(auth).catch((error: any) => {
      console.error("Error signing out:", error);
    });
  };

  return (
    <Layout>
      <ErrorBoundary>
        {state.currentStep === 'AGREEMENT' && (
          <Onboarding
            onComplete={nextStep}
            onSignupSuccess={handleSignupSuccess}
          />
        )}

        {state.currentStep === 'VERIFICATION' && (
          <Verification
            email={state.unverifiedEmail}
            onGoToLogin={handleBackToLogin}
          />
        )}

        {state.currentStep === 'PROFILE_SETUP' && (
          <ProfileSetup
            onSave={handleProfileSave}
            initialData={state.profile}
            onCancel={state.profile ? handleCancelEdit : undefined}
          />
        )}

        {state.currentStep === 'MAIN' && state.profile && (
          <MainView
            profile={state.profile}
            onUpdateMood={handleUpdateMood}
            onUpdateNickname={handleUpdateNickname}
            onUpdateStatusMessage={handleUpdateStatusMessage}
            onUpdateIcon={handleUpdateIcon}
            onEditProfile={handleEditProfileTrigger}
            onWipeSession={handleWipeSession}
          />
        )}
      </ErrorBoundary>
    </Layout>
  );
};

export default App;
