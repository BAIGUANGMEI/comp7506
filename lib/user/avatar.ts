import type { ImportAsset } from "@/lib/types";

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export async function imageAssetToDataUri(asset: ImportAsset) {
  if (typeof asset.size === "number" && asset.size > MAX_AVATAR_BYTES) {
    throw new Error("Choose an image smaller than 5 MB.");
  }

  const mimeType = asset.mimeType || "image/jpeg";

  if (asset.file) {
    return readFileAsDataUri(asset.file);
  }

  if (isWebRuntime()) {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    return readFileAsDataUri(blob);
  }

  const FileSystem = await import("expo-file-system/legacy");
  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${mimeType};base64,${base64}`;
}

function readFileAsDataUri(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(blob);
  });
}

function isWebRuntime() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}
