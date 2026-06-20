import Constants, { ExecutionEnvironment } from "expo-constants";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { colors, radius, spacing } from "@/config/theme";
import type { NativePdfPreviewProps } from "@/components/NativePdfPreview";

type NativePdfProps = {
  source: { uri: string; cache?: boolean };
  style: object;
  trustAllCerts?: boolean;
  fitPolicy?: 0 | 1 | 2;
  enablePaging?: boolean;
  enableDoubleTapZoom?: boolean;
  renderActivityIndicator?: (progress: number) => React.ReactElement;
  onError?: (error: object) => void;
};

export function NativePdfPreview({ uri, onUnavailable }: NativePdfPreviewProps) {
  const [nativeError, setNativeError] = useState<string | null>(null);
  const NativePdf = useMemo(() => getNativePdfComponent(), []);

  if (NativePdf && !nativeError) {
    return (
      <NativePdfBoundary
        onError={(reason) => {
          setNativeError(reason);
        }}
      >
        <View style={styles.nativePdfWrap}>
          <NativePdf
            source={{ uri, cache: true }}
            style={styles.nativePdf}
            trustAllCerts={false}
            fitPolicy={0}
            enablePaging={false}
            enableDoubleTapZoom
            renderActivityIndicator={() => <PdfLoading />}
            onError={(error: object) => setNativeError(formatPdfError(error))}
          />
        </View>
      </NativePdfBoundary>
    );
  }

  return (
    <View style={styles.nativePdfWrap}>
      <WebView
        source={{ uri }}
        style={styles.webViewPdf}
        originWhitelist={["*"]}
        startInLoadingState
        allowFileAccess
        allowFileAccessFromFileURLs
        allowingReadAccessToURL={readAccessUri(uri)}
        javaScriptEnabled={false}
        renderLoading={() => <PdfLoading />}
        onError={(event) => {
          onUnavailable(
            event.nativeEvent.description ||
              nativeError ||
              "The embedded PDF preview could not load.",
          );
        }}
      />
    </View>
  );
}

function PdfLoading() {
  return (
    <View style={styles.pdfLoading}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.pdfLoadingText}>Loading PDF</Text>
    </View>
  );
}

function getNativePdfComponent() {
  if (isExpoGoRuntime()) {
    return null;
  }

  try {
    const module = require("react-native-pdf") as {
      default?: React.ComponentType<NativePdfProps>;
    };
    return module.default ?? (module as unknown as React.ComponentType<NativePdfProps>);
  } catch {
    return null;
  }
}

function isExpoGoRuntime() {
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === "expo"
  );
}

function readAccessUri(uri: string) {
  const clean = uri.split("?")[0] ?? uri;
  return clean.includes("/") ? clean.slice(0, clean.lastIndexOf("/") + 1) : uri;
}

function formatPdfError(error: object) {
  if (error && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
}

class NativePdfBoundary extends React.Component<
  { children: React.ReactNode; onError: (reason: string) => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(formatPdfError(error));
  }

  render() {
    if (this.state.failed) {
      return null;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  nativePdfWrap: {
    height: 640,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  nativePdf: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#FFFFFF",
  },
  webViewPdf: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  pdfLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  pdfLoadingText: {
    color: colors.textMuted,
    fontWeight: "700",
  },
});
