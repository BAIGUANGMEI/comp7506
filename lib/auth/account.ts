import type { AuthAccount } from "@/lib/types";

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
};

type AppleFullName = {
  givenName?: string | null;
  familyName?: string | null;
  middleName?: string | null;
  nickname?: string | null;
};

export async function fetchGoogleAccount(accessToken: string): Promise<AuthAccount> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Could not load Google account profile.");
  }

  const profile = (await response.json()) as GoogleUserInfo;
  if (!profile.sub) {
    throw new Error("Google profile did not include a stable user id.");
  }

  return {
    provider: "google",
    subject: profile.sub,
    email: profile.email ?? null,
    displayName: profile.name ?? profile.email ?? null,
    avatarUrl: profile.picture ?? null,
    signedInAt: new Date().toISOString(),
  };
}

export function buildAppleDisplayName(fullName?: AppleFullName | null) {
  if (!fullName) {
    return null;
  }
  const parts = [
    fullName.givenName,
    fullName.middleName,
    fullName.familyName,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : fullName.nickname ?? null;
}

export function authProviderLabel(provider: AuthAccount["provider"]) {
  return provider === "apple" ? "Apple" : "Google";
}
