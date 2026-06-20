import type { ImportAsset } from "@/lib/types";

const ORIGINAL_TEXT_EXTENSIONS = new Set(["md", "txt"]);

export function shouldPreserveOriginalText(ext: string) {
  return ORIGINAL_TEXT_EXTENSIONS.has(ext);
}

export async function readOriginalText(asset: ImportAsset, ext: string) {
  if (!shouldPreserveOriginalText(ext)) {
    return null;
  }

  if (asset.file && typeof asset.file.text === "function") {
    return asset.file.text();
  }

  if (isWebRuntime()) {
    const response = await fetch(asset.uri);
    return response.text();
  }

  const FileSystem = await import("expo-file-system/legacy");
  return FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

function isWebRuntime() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export async function tryReadOriginalText(asset: ImportAsset, ext: string) {
  try {
    return await readOriginalText(asset, ext);
  } catch {
    return null;
  }
}
