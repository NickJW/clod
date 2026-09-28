// Public app settings. The Google client ID is not a secret: it only identifies this app to Google.
// Create it in Google Cloud Console (see docs/google-drive-setup.md).
export const GOOGLE_CLIENT_ID = '';

// Built-in Google Gemini key (free tier), so the AI editor works with no setup.
// A key entered in Settings or through a setup link takes priority over this one.
// To replace it: create a new key at aistudio.google.com/apikey and paste it here.
export const BUILT_IN_GEMINI_KEY = '';
