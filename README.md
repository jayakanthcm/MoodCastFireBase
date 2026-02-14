# MoodCast (Firebase Edition)

A real-time, location-based social "aura" broadcasting app. Share your vibe, scan for nearby moods, and chat with matching energies.

## Features
- **Live Aura Broadcasting**: Share your mood, status, and location with nearby users.
- **Radar**: Scan for other users within a configurable range (500m - 10km).
- **Real-time Chat**: Secure, ephemeral messaging with nearby users.
- **Vibe Generator**: Auto-generate creative status messages (Offline/Static).
- **Privacy First**: "Stealth Mode" to go invisible.

## Tech Stack
- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Backend**: Firebase (Firestore, Authentication, Hosting)

## Run Locally

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Firebase Setup:**
    - Create a Firebase project.
    - Enable Authentication (Email/Password, Anonymous).
    - Enable Firestore Database.
    - Copy your Firebase config keys into a `.env.local` file (see `.env.example` if available, or use the format below):
      ```
      VITE_FIREBASE_API_KEY=your_api_key
      VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
      VITE_FIREBASE_PROJECT_ID=your_project_id
      VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
      VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
      VITE_FIREBASE_APP_ID=your_app_id
      ```

3.  **Run the app:**
    ```bash
    npm run dev
    ```

## Deployment
This project is configured for Firebase Hosting.

```bash
npm run build
firebase deploy
```
