# Document AI Expo App

Document AI is an Expo SDK 54 app for importing TXT, Markdown, PDF, DOC, and DOCX files, extracting their text with a Kimi-compatible API, summarizing them, and chatting with AI using document chunks as context.

## Requirements

- Node managed by `nvm` with Node 22.13 or newer.
- Optional: `conda` remains available for Python tooling, but this app is Node/Expo-based.

## Setup

```bash
npm install
npm run web
```

For native targets:

```bash
npm run ios
npm run android
```

## Web Debugging

The Web target calls the configured provider Base URL directly. Use the same API
settings on Web, iOS, and Android.

## Settings

Default provider settings:

- Base URL: `https://api.moonshot.cn/v1`
- Model: `kimi-k2.6`
- Delete remote files after extraction: enabled

On iOS and Android, the API key is stored with Expo SecureStore. On Web, it is stored in browser local storage for debugging convenience.

## Verification

```bash
npm run typecheck
npm test
```
