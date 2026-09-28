// Public app settings. The Google client ID is not a secret: it only identifies this app to Google.
// Create it in Google Cloud Console (see docs/google-drive-setup.md).
export const GOOGLE_CLIENT_ID = '';

// Built-in Google Gemini key (free tier), so the AI editor works with no setup.
// It is added when the site is built, from the repository secret GEMINI_KEY
// (GitHub → Settings → Secrets and variables → Actions), so it never sits in the code.
// A key entered in Settings or through a setup link takes priority over this one.
export const BUILT_IN_GEMINI_KEY: string = import.meta.env.VITE_GEMINI_KEY ?? '';
