import * as DocumentPicker from "expo-document-picker";
import { router, useLocalSearchParams } from "expo-router";
import { Check, Cloud, FileText, Folder, Upload } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Button, Card, DocumentBadge, Screen, SectionTitle, TopBar } from "@/components/ui";
import { colors, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";
import { normalizePickerAsset } from "@/lib/documents/assets";
import type { FolderRecord } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils/errors";

export default function ImportScreen() {
  const { folderId } = useLocalSearchParams<{ folderId?: string }>();
  const { importAsset, apiKey, folders } = useApp();
  const [analyzeWithAi, setAnalyzeWithAi] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(folderId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFolderId) {
      return;
    }
    if (!folders.some((folder) => folder.id === selectedFolderId)) {
      setSelectedFolderId(null);
    }
  }, [folders, selectedFolderId]);

  async function pickDocument() {
    setError(null);
    let shouldAnalyze = analyzeWithAi;
    if (shouldAnalyze && !apiKey.trim()) {
      const choice = await askNoApiChoice();
      if (choice === "settings") {
        router.push({ pathname: "/settings", params: { entry: "stack" } });
        return;
      }
      if (choice === "cancel") {
        return;
      }
      shouldAnalyze = false;
      setAnalyzeWithAi(false);
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
      const document = await importAsset(normalizePickerAsset(result.assets[0]), {
        analyzeWithAi: shouldAnalyze,
        folderId: selectedFolderId,
      });
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

      <SectionTitle>AI Analysis</SectionTitle>
      <Card>
        <AnalysisToggle
          value={analyzeWithAi}
          onValueChange={setAnalyzeWithAi}
          apiConfigured={Boolean(apiKey.trim())}
        />
      </Card>

      <SectionTitle>Folder</SectionTitle>
      <Card>
        <FolderOption
          name="No Folder"
          body="Keep this document in the main library."
          selected={!selectedFolderId}
          onPress={() => setSelectedFolderId(null)}
        />
        {folders.map((folder) => (
          <FolderOption
            key={folder.id}
            folder={folder}
            selected={selectedFolderId === folder.id}
            onPress={() => setSelectedFolderId(folder.id)}
          />
        ))}
      </Card>

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
          {analyzeWithAi
            ? "TXT, Markdown, PDF, DOC, and DOCX are sent to your configured AI API for extraction, summary, and Q&A context."
            : "The file is saved locally without AI extraction or summary. Markdown and TXT preserve original text for reading."}
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
          title={analyzeWithAi ? "1. Upload" : "1. Save locally"}
          body={
            analyzeWithAi
              ? "The app uploads the picked file directly to your configured AI API."
              : "The app stores document metadata and any readable local text on this device."
          }
        />
        <PipelineRow
          title={analyzeWithAi ? "2. Extract" : "2. Read"}
          body={
            analyzeWithAi
              ? "Kimi file-extract returns readable text and detected visual descriptions."
              : "Markdown and TXT can be read directly from the original text."
          }
        />
        <PipelineRow
          title={analyzeWithAi ? "3. Summarize" : "3. Analyze later"}
          body={
            analyzeWithAi
              ? "The app stores chunks, summary, visual notes, and chat history locally."
              : "Re-import with AI analysis enabled when you want summaries and document Q&A."
          }
          last
        />
      </Card>

      <View style={styles.footer}>
        <Button onPress={pickDocument} loading={busy}>
          Choose File
        </Button>
      </View>
    </Screen>
  );
}

function FolderOption({
  folder,
  name,
  body,
  selected,
  onPress,
}: {
  folder?: FolderRecord;
  name?: string;
  body?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const label = folder?.name ?? name ?? "Folder";
  const sub = folder
    ? `${folder.documentCount} ${folder.documentCount === 1 ? "document" : "documents"}`
    : body;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.folderOption, pressed && styles.pressed]}
    >
      <View style={styles.folderOptionIcon}>
        <Folder size={19} color={colors.folder} />
      </View>
      <View style={styles.folderOptionCopy}>
        <Text style={styles.folderOptionTitle}>{label}</Text>
        {sub ? <Text style={styles.folderOptionBody}>{sub}</Text> : null}
      </View>
      {selected ? <Check size={20} color={colors.text} /> : null}
    </Pressable>
  );
}

type NoApiChoice = "local" | "settings" | "cancel";

function askNoApiChoice() {
  if (Platform.OS === "web") {
    return Promise.resolve<NoApiChoice>(
      window.confirm("No API key is configured. Import this document locally without AI analysis?")
        ? "local"
        : "cancel",
    );
  }

  return new Promise<NoApiChoice>((resolve) => {
    Alert.alert(
      "AI API not configured",
      "You can still import the document locally, but summaries, visual analysis, and document Q&A need an API key.",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve("cancel") },
        { text: "Settings", onPress: () => resolve("settings") },
        { text: "Import Locally", onPress: () => resolve("local") },
      ],
    );
  });
}

function AnalysisToggle({
  value,
  onValueChange,
  apiConfigured,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  apiConfigured: boolean;
}) {
  return (
    <View style={styles.analysisRow}>
      <View style={styles.analysisCopy}>
        <Text style={styles.analysisTitle}>Analyze with AI</Text>
        <Text style={styles.analysisBody}>
          {apiConfigured
            ? "Generate extraction, summary, visual notes, and chat context during import."
            : "No API key is configured. You can still import locally without AI analysis."}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.surfaceMuted, true: colors.primarySoft }}
        thumbColor={value ? colors.primary : "#FFFFFF"}
      />
    </View>
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
  analysisRow: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  analysisCopy: {
    flex: 1,
    minWidth: 0,
  },
  analysisTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  analysisBody: {
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  folderOption: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  folderOptionIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  folderOptionCopy: {
    flex: 1,
    minWidth: 0,
  },
  folderOptionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  folderOptionBody: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.64,
  },
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
    fontSize: 21,
    fontWeight: "500",
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
