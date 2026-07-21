type AppleFullName = {
  givenName?: string | null;
  familyName?: string | null;
  middleName?: string | null;
  nickname?: string | null;
};

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
