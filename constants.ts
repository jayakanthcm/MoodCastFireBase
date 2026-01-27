
import { Gender, RelationshipStatus, MoodType, AgeRange } from './types';

export const GENDERS: Gender[] = ['Male', 'Female', 'Non-binary', 'Other'];
export const REL_STATUS: RelationshipStatus[] = ['Single', 'Married', 'Divorced', 'Widowed', 'Complicated'];
export const MOODS: MoodType[] = [
  'Cozy', 
  'Solo dolo', 
  'Rizzing', 
  'Freaky', 
  'Sendy'
];

export const AGE_BRACKETS: AgeRange[] = [
  '18-25',
  '25-35',
  '35-45',
  '45-55',
  '55-65',
  'Above 65'
];

export const MOCK_NEARBY_USERS = [
  { 
    id: '1', 
    nickname: 'VelvetSky', 
    gender: 'Female', 
    ageRange: '18-25', 
    status: 'Single', 
    mood: 'Cozy', 
    dist: 15, 
    statusMessage: 'Looking for someone to talk about stars with.', 
    seeking: { gender: 'Male', ageRange: '18-25', status: 'Single' },
    stats: { interested: 5, inRadar: 2 } 
  },
  { 
    id: '2', 
    nickname: 'NeoBiker', 
    gender: 'Male', 
    ageRange: '25-35', 
    status: 'Single', 
    mood: 'Freaky', 
    dist: 120, 
    statusMessage: 'Just here for a wild ride.', 
    seeking: { gender: 'Female', ageRange: '25-35', status: 'Single' },
    stats: { interested: 12, inRadar: 8 } 
  },
  { 
    id: '3', 
    nickname: 'PixelPixie', 
    gender: 'Female', 
    ageRange: '18-25', 
    status: 'Single', 
    mood: 'Rizzing', 
    dist: 80, 
    statusMessage: 'Tell me your secrets and I will tell you mine.', 
    seeking: { gender: 'Everyone', ageRange: '18-25', status: 'Single' },
    stats: { interested: 3, inRadar: 1 } 
  },
  { 
    id: '4', 
    nickname: 'SolarWind', 
    gender: 'Other', 
    ageRange: '25-35', 
    status: 'Complicated', 
    mood: 'Solo dolo', 
    dist: 210, 
    statusMessage: 'Exploring the city, one coffee at a time.', 
    seeking: { gender: 'Everyone', ageRange: '25-35', status: 'Single' },
    stats: { interested: 1, inRadar: 4 } 
  },
  { 
    id: '5', 
    nickname: 'QuietStorm', 
    gender: 'Female', 
    ageRange: '35-45', 
    status: 'Married', 
    mood: 'Cozy', 
    dist: 350, 
    statusMessage: 'Peace of mind over everything.', 
    seeking: { gender: 'Female', ageRange: '35-45', status: 'Married' },
    stats: { interested: 0, inRadar: 0 } 
  },
  { 
    id: '6', 
    nickname: 'Ace', 
    gender: 'Male', 
    ageRange: '18-25', 
    status: 'Single', 
    mood: 'Freaky', 
    dist: 15, 
    statusMessage: 'Let us see where the night takes us.', 
    seeking: { gender: 'Everyone', ageRange: '18-25', status: 'Single' },
    stats: { interested: 24, inRadar: 12 } 
  },
  { 
    id: '7', 
    nickname: 'Luna', 
    gender: 'Female', 
    ageRange: '18-25', 
    status: 'Single', 
    mood: 'Sendy', 
    dist: 90, 
    statusMessage: 'Seeking a partner in crime for brunch.', 
    seeking: { gender: 'Everyone', ageRange: '18-25', status: 'Single' },
    stats: { interested: 7, inRadar: 3 } 
  },
];
