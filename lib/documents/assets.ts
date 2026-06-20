import { MAX_IMPORT_BYTES, SUPPORTED_EXTENSIONS } from "@/config/defaults";
import type { ImportAsset } from "@/lib/types";

export function getExtension(filename: string) {
  const clean = filename.split("?")[0] ?? filename;
  const ext = clean.includes(".") ? clean.split(".").pop() : "";
  return (ext ?? "").toLowerCase();
}

export function titleFromFilename(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}

export function validateImportAsset(asset: ImportAsset) {
  const ext = getExtension(asset.name);
  if (!SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number])) {
    throw new Error("Unsupported file type. Choose TXT, Markdown, PDF, DOC, or DOCX.");
  }

  if (typeof asset.size === "number" && asset.size > MAX_IMPORT_BYTES) {
    throw new Error("File is larger than 100 MB.");
  }

  return { ext };
}

export function normalizePickerAsset(asset: {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
  file?: File;
}): ImportAsset {
  return {
    uri: asset.uri,
    name: asset.name,
    size: asset.size,
    mimeType: asset.mimeType,
    file: asset.file,
  };
}
