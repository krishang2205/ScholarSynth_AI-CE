# API Key Configuration Guide

## Quick Setup (Required)

To enable AI features in the Chrome extension, you need to add your Gemini API key:

### Step 1: Get Your API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API key"**
4. Copy the generated key (starts with "AIza...")

### Step 2: Configure the Extension
1. Open the file: `src/config/api-config.ts`
2. Replace `'YOUR_GEMINI_API_KEY_HERE'` with your actual API key
3. Save the file

**Example:**
```typescript
export const API_CONFIG = {
  GEMINI_API_KEY: '', // Your real key here
  // ... rest of config
};
```

### Step 3: Rebuild Extension
```bash
npm run build
```

### Step 4: Reload Extension in Chrome
1. Go to `chrome://extensions/`
2. Find your extension
3. Click the reload button 🔄

## ✅ Done!
Your extension now has a built-in API key and users won't need to configure anything!

## Optional: User Custom API Keys
Users can still provide their own API keys in the Settings if they prefer to use their own quota.

## Free Tier Limits
- Gemini API has generous free limits
- Monitor usage at [Google AI Studio](https://aistudio.google.com/)
- Consider setting up billing if you expect heavy usage
