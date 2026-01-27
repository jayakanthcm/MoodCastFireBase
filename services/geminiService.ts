import { UserProfile, ChatMessage } from "../types";
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = API_KEY && API_KEY !== 'PLACEHOLDER_API_KEY' ? new GoogleGenerativeAI(API_KEY) : null;

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
  "Professional overthinker"
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
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Write a short, poetic 1-line social status for a ${profile.identity.ageRange} ${profile.identity.gender} whose mood is ${profile.mood}. Max 6 words.`;
      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text().trim();
    } catch (error) {
      console.warn("Gemini API failed, falling back to mock:", error);
    }
  }

  // Simulate network delay for realism if mock
  await new Promise(resolve => setTimeout(resolve, 800));
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
