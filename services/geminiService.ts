import { UserProfile, ChatMessage } from "../types";

const VIBE_TAGLINES = [
  "Sipping coffee & judging fonts",
  "Coding in the matrix",
  "Just vibrating",
  "Lost in the music",
  "Plotting world domination",
  "In search of the perfect taco",
  "Debugging life",
  "Offline in real life",
  "Chasing sunsets",
  "Fuelled by caffeine and chaos",
  "Pretending to be an adult",
  "Vibing at a high frequency",
  "Manifesting good energy",
  "Collecting moments, not things",
  "Loading personality...",
  "Currently buffering",
  "Professional overthinker",
  "Too glam to give a damn",
  "Born to express, not to impress",
  "Making history, one mistake at a time",
  "Not all those who wander are lost",
  "Creating my own sunshine",
  "Life is short, make it sweet",
  "Dream big, pray bigger",
  "Hustle and heart set me apart",
  "Reality calling, I'm not home",
  "Out of office, mentally",
  "Living my best life",
  "Stay wild, moon child",
  "Energy doesn't lie"
];

const CHAT_RESPONSES: Record<string, string[]> = {
  'Cozy': [
    "Hey! The vibe here is super chill.",
    "Just relaxing, you?",
    "Love this quiet energy.",
    "Perfect spot for a break."
  ],
  'Party': [
    "Yooo! It's getting loud in here!",
    "Where the party at?!",
    "Just vibing with the music!",
    "Let's goooo!"
  ],
  'Focus': [
    "Hey, deep in the zone right now.",
    "Working on something cool.",
    "Headphones on, world off.",
    "Can't talk much, deadline approaching!"
  ],
  'Adventure': [
    "Exploring the area!",
    "Found any cool spots?",
    "On the move, catch me if you can.",
    "Ready for anything today."
  ],
  'Chill': [
    "Just hanging out.",
    "Taking it easy.",
    "Sup?",
    "Good vibes only."
  ]
};

const DEFAULT_RESPONSES = [
  "Hey there!",
  "Cool profile!",
  "Just passing through.",
  "Nice to meet you."
];

export const generateVibeTagline = async (profile: UserProfile): Promise<string> => {
  // Simulate "thinking" delay for realism
  await new Promise(resolve => setTimeout(resolve, 600));

  // Simple random selection from static list
  // In a future update, we could filter this list based on the user's mood/profile if desired
  const randomTag = VIBE_TAGLINES[Math.floor(Math.random() * VIBE_TAGLINES.length)];
  return randomTag;
};

export const simulateChatResponse = async (
  recipientProfile: any,
  userProfile: UserProfile,
  history: ChatMessage[]
): Promise<string> => {
  // Simulate typing delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  const mood = recipientProfile.mood;
  const availableResponses = CHAT_RESPONSES[mood] || DEFAULT_RESPONSES;
  const randomResponse = availableResponses[Math.floor(Math.random() * availableResponses.length)];

  return randomResponse;
};
