# Document AI

Document AI is a cross-platform Expo application for importing, organising,
reading, summarising, and discussing personal documents. It supports TXT,
Markdown, PDF, DOC, and DOCX files and uses a configurable Kimi-compatible API
for document extraction, summaries, and document-grounded conversations.

The project uses Expo SDK 54, Expo Router, TypeScript, SQLite, and SecureStore.
It runs on Web, iOS, and Android.

## Quick Start for Reviewers

The Web version is the quickest way to review the project because it does not
require Xcode, Android Studio, a simulator, or a custom native build.

### 1. Prerequisites

- Git
- Node.js 22 LTS (tested with Node `22.17.1`)
- npm

Using `nvm` is recommended:

```bash
nvm install 22
nvm use 22
```

### 2. Clone and install

```bash
git clone https://github.com/BAIGUANGMEI/comp7506.git
cd comp7506
npm ci
```

### 3. Start the Web app

```bash
npm run web
```

Expo will print the local address in the terminal. Open
`http://localhost:8081` if the browser does not open automatically.

No environment file is required. The app can be opened and local documents can
be imported without an API key.

## Configure AI Analysis

AI configuration is entered inside the app rather than committed to the
repository:

1. Open **Settings** from the side menu or the settings icon.
2. Enter the Kimi-compatible API configuration:
   - **Base URL:** `https://api.moonshot.ai/v1`
   - **Model:** `kimi-k2.6`
   - **API Key:** a valid Moonshot/Kimi API key
3. Select **Save Settings**.
4. Select **Test Connection** to verify the configuration.

When importing a document, enable **Analyze with AI** to run extraction and
summary generation. Leave it disabled to import the file locally without
calling an external API.

API keys are not included in this repository. Native builds store the key with
Expo SecureStore. The Web version stores it in browser local storage and should
only be used for local testing.

## iOS and Android

This project includes native libraries such as `react-native-pdf`. These
libraries are not bundled with Expo Go, so the complete native app must be run
as a local development build. Scanning the Metro QR code with Expo Go is not
the supported native test path.

### iOS

Requirements:

- macOS
- Xcode with an installed iOS Simulator
- Xcode Command Line Tools

Build, install, and start the app:

```bash
npm ci
npm run ios
```

To run on a connected iPhone instead:

```bash
npx expo run:ios --device
```

Running on a physical iPhone may require selecting an Apple development team
for code signing in Xcode. Apple Sign In is optional and is not required to
test document import, reading, or AI features.

### Android

Requirements:

- Android Studio
- Android SDK and an Android emulator
- A compatible JDK

Build, install, and start the app:

```bash
npm ci
npm run android
```

For a connected Android device with USB debugging enabled:

```bash
npx expo run:android --device
```

After the native app has been built once, start Metro for that build again
with:

```bash
npx expo start --dev-client
```

Rebuild the native app after adding native dependencies or changing native app
configuration:

```bash
npx expo prebuild --clean
npm run ios
# or: npm run android
```

## Main Review Flow

1. Open **Settings** and optionally configure the Kimi API.
2. Open **Import Document** and select a supported file.
3. Choose a folder and decide whether to enable AI analysis.
4. Open the document detail screen to view its overview and chunks.
5. Select **Read** to open the format-aware reader.
6. Select **Ask AI** to create one or more document-grounded conversations.
7. Review folders, global conversations, search, export, and Trash recovery.

## Supported Features

- TXT, Markdown, PDF, DOC, and DOCX import
- Optional Kimi-compatible extraction and AI analysis
- Collapsible document overview, key points, and suggested questions
- Format-aware document readers
- Chunk-grounded AI conversations with Markdown responses and source references
- Multiple chat sessions, custom agent instructions, and chat export
- Folder creation, assignment, and deletion
- Search across documents and conversations
- Recoverable Trash with restore and permanent deletion
- Local profile, avatar, Apple Sign In on supported iOS builds, and API settings
- SQLite persistence for metadata, extracted text, folders, and chat history

## Verification

Run the automated checks before evaluation:

```bash
npm run typecheck
npm test
```

Create a static Web export if required:

```bash
npx expo export --platform web
```

The exported site is written to `dist/`.

## Troubleshooting

### `Cannot find module` after installation

Use the committed lock file to reinstall the exact dependency versions:

```bash
npm ci
npx expo start --clear
```

### Expo Go reports an incompatible project or missing native module

Use `npm run ios` or `npm run android` to create a native development build.
Expo Go cannot load the native PDF dependency used by this project.

### No iOS Simulator or Android emulator is available

Create and start a simulator in Xcode or an emulator in Android Studio before
running the corresponding npm command. The Web version remains available with
`npm run web`.

### A physical device cannot connect to Metro

Keep the computer and device on the same network. If LAN discovery is blocked,
try:

```bash
npx expo start --tunnel
```

### AI connection test fails

Check the Base URL, model name, API key, network access, and provider account
quota. A `401` response normally indicates an invalid API key, while a `404`
often indicates an incorrect Base URL or model endpoint.

### Web requests are blocked by CORS

The Web app calls the configured API directly. If the provider or local network
blocks browser cross-origin requests, use the iOS or Android development build
for AI testing.

## Reference

- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Run an Expo app locally](https://docs.expo.dev/guides/local-app-overview/)
- [Moonshot/Kimi API documentation](https://platform.moonshot.ai/docs/)
