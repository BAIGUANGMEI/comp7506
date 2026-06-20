import { useEffect } from "react";

export type NativePdfPreviewProps = {
  uri: string;
  onUnavailable: (reason: string) => void;
};

export function NativePdfPreview({ onUnavailable }: NativePdfPreviewProps) {
  useEffect(() => {
    onUnavailable("Native PDF preview is not available in this runtime.");
  }, [onUnavailable]);

  return null;
}
