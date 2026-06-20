import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { Cloud, FileText, Upload } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, DocumentBadge, Screen, SectionTitle, TopBar } from "@/components/ui";
import { colors, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";
import { normalizePickerAsset } from "@/lib/documents/assets";
import { getErrorMessage } from "@/lib/utils/errors";

export default function ImportScreen() {
  const { importAsset, apiKey } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickDocument() {
    setError(null);
    if (!apiKey) {
      router.push("/settings");
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "text/plain",
        "text/markdown",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      copyToCacheDirectory: true,
      multiple: false,
      base64: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    setBusy(true);
    try {
      const document = await importAsset(normalizePickerAsset(result.assets[0]));
      router.replace(`/document/${document.id}`);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <TopBar title="Import Document" menu />

      <Pressable
        accessibilityRole="button"
        onPress={pickDocument}
        disabled={busy}
        style={({ pressed }) => [styles.dropZone, pressed && { opacity: 0.75 }]}
      >
        <View style={styles.uploadIcon}>
          {busy ? <Cloud size={26} color={colors.text} /> : <Upload size={26} color={colors.text} />}
        </View>
        <Text style={styles.dropTitle}>{busy ? "Processing your document" : "Tap to choose a file"}</Text>
        <Text style={styles.dropBody}>
          TXT, Markdown, PDF, DOC, and DOCX are sent to your configured AI API for
          extraction, summary, and Q&A context.
        </Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <SectionTitle>Supported Formats</SectionTitle>
      <View style={styles.formatGrid}>
        {["pdf", "md", "docx", "txt"].map((ext) => (
          <View key={ext} style={styles.formatItem}>
            <DocumentBadge ext={ext} />
            <Text style={styles.formatLabel}>{ext === "docx" ? "Word" : ext.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      <SectionTitle>Import Pipeline</SectionTitle>
      <Card>
        <PipelineRow
          title="1. Upload"
          body="The app uploads the picked file directly to your configured AI API."
        />
        <PipelineRow title="2. Extract" body="Kimi file-extract returns readable text and detected visual descriptions." />
        <PipelineRow title="3. Summarize" body="The app stores chunks, summary, visual notes, and chat history locally." last />
      </Card>

      <View style={styles.footer}>
        <Button onPress={pickDocument} loading={busy}>
          Choose File
        </Button>
      </View>
    </Screen>
  );
}

function PipelineRow({ title, body, last }: { title: string; body: string; last?: boolean }) {
  return (
    <View style={[styles.pipelineRow, last && styles.lastPipelineRow]}>
      <View style={styles.pipelineIcon}>
        <FileText size={18} color={colors.textMuted} />
      </View>
      <View style={styles.pipelineBody}>
        <Text style={styles.pipelineTitle}>{title}</Text>
        <Text style={styles.pipelineText}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dropZone: {
    minHeight: 172,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D1CCC4",
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  uploadIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  dropTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  dropBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.md,
    lineHeight: 20,
  },
  formatGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  formatItem: {
    width: "23%",
    minHeight: 82,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  formatLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "700",
  },
  pipelineRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  lastPipelineRow: {
    borderBottomWidth: 0,
  },
  pipelineIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  pipelineBody: {
    flex: 1,
  },
  pipelineTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  pipelineText: {
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: 2,
  },
  footer: {
    marginTop: spacing.xl,
  },
});
