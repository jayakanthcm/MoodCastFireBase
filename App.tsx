import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Onboarding } from './components/Onboarding';
import { Verification } from './components/Verification';
import { ProfileSetup } from './components/ProfileSetup';
import { MainView } from './components/MainView';
import { UserProfile, MoodType, AppState } from './types';
import { auth } from './services/firebase';
import { FirestoreService } from './services/firestoreService';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { AdminPanel } from './components/AdminPanel';

const App: React.FC = () => {
  const initialState: AppState = {
    isOnboarded: false,
    isVerified: false,
    profile: null,
    currentStep: 'AGREEMENT',
    unverifiedEmail: null,
  };

  const [state, setState] = useState<AppState>(initialState);
  const [showAdmin, setShowAdmin] = useState(window.location.hash === '#admin-aura');

  useEffect(() => {
    const handleHashChange = () => {
      setShowAdmin(window.location.hash === '#admin-aura');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
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
                statusMessage: "", // These are ephemeral, not in persistent profile yet based on plan
                icon: persistentProfile.icon,
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
            // We can use a temporary profile state to prep for setup
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
          // Fallback or error state?
        }
      } else {
        // User logged out
        setState(prev => {
          // If we are waiting for verification (sign up flow), keep the state
          if (prev.unverifiedEmail && prev.currentStep === 'VERIFICATION') {
            return prev;
          }
          return textInitialState;
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Workaround because initialState is not available inside the closure if I used the variable directly without recreating
  const textInitialState: AppState = {
    isOnboarded: false,
    isVerified: false,
    profile: null,
    currentStep: 'AGREEMENT',
    unverifiedEmail: null,
  };

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
    signOut(auth).catch((err) => console.error(err));
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
        createdAt: null // Service handles timestamps or we merge
      });

      setState(prev => ({ ...prev, profile, currentStep: 'MAIN' }));
    } catch (error) {
      console.error("Error saving profile:", error);
      // Handle error (maybe show a toast or alert)
    }
  };

  const handleUpdateMood = (mood: MoodType) => {
    if (state.profile) {
      setState(prev => ({
        ...prev,
        profile: { ...prev.profile!, mood }
      }));
    }
  };

  const handleUpdateNickname = (nickname: string) => {
    if (state.profile) {
      setState(prev => ({
        ...prev,
        profile: {
          ...prev.profile!,
          identity: { ...prev.profile!.identity, nickname }
        }
      }));
    }
  };

  const handleUpdateStatusMessage = (statusMessage: string) => {
    if (state.profile) {
      setState(prev => ({
        ...prev,
        profile: {
          ...prev.profile!,
          identity: { ...prev.profile!.identity, statusMessage }
        }
      }));
    }
  };

  const handleUpdateIcon = (icon: string) => {
    if (state.profile) {
      setState(prev => ({
        ...prev,
        profile: {
          ...prev.profile!,
          identity: { ...prev.profile!.identity, icon }
        }
      }));
    }
  };

  const handleEditProfileTrigger = () => {
    setState(prev => ({ ...prev, currentStep: 'PROFILE_SETUP' }));
  };

  const handleCancelEdit = () => {
    setState(prev => ({ ...prev, currentStep: 'MAIN' }));
  };

  const handleWipeSession = () => {
    signOut(auth).catch((error) => {
      console.error("Error signing out:", error);
    });
    // State update checks in useEffect will handle the rest
  };

  return (
    <Layout>
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
    </Layout>
  );
};

export default App;
