import * as DocumentPicker from "expo-document-picker";
import { router, useLocalSearchParams } from "expo-router";
import { Check, ChevronDown, ChevronUp, Cloud, Folder, Upload } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Card, Screen, SectionTitle, TopBar } from "@/components/ui";
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
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
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
        <FolderDropdown
          folders={folders}
          selectedFolderId={selectedFolderId}
          open={folderDropdownOpen}
          onToggle={() => setFolderDropdownOpen((current) => !current)}
          onSelect={(nextFolderId) => {
            setSelectedFolderId(nextFolderId);
            setFolderDropdownOpen(false);
          }}
        />
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
    </Screen>
  );
}

function FolderDropdown({
  folders,
  selectedFolderId,
  open,
  onToggle,
  onSelect,
}: {
  folders: FolderRecord[];
  selectedFolderId: string | null;
  open: boolean;
  onToggle: () => void;
  onSelect: (folderId: string | null) => void;
}) {
  const selectedFolder = selectedFolderId
    ? folders.find((folder) => folder.id === selectedFolderId)
    : null;
  const selectedLabel = selectedFolder?.name ?? "No Folder";
  const selectedMeta = selectedFolder
    ? `${selectedFolder.documentCount} ${selectedFolder.documentCount === 1 ? "document" : "documents"}`
    : "Keep this document in the main library.";

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={({ pressed }) => [styles.folderSelect, pressed && styles.pressed]}
      >
        <View style={styles.folderOptionIcon}>
          <Folder size={19} color={colors.folder} />
        </View>
        <View style={styles.folderOptionCopy}>
          <Text style={styles.folderOptionTitle}>{selectedLabel}</Text>
          <Text style={styles.folderOptionBody}>{selectedMeta}</Text>
        </View>
        {open ? (
          <ChevronUp size={20} color={colors.textMuted} />
        ) : (
          <ChevronDown size={20} color={colors.textMuted} />
        )}
      </Pressable>

      {open ? (
        <View style={styles.folderMenu}>
          <FolderMenuItem
            label="No Folder"
            body="Keep this document in the main library."
            selected={!selectedFolderId}
            onPress={() => onSelect(null)}
          />
          {folders.map((folder) => (
            <FolderMenuItem
              key={folder.id}
              label={folder.name}
              body={`${folder.documentCount} ${folder.documentCount === 1 ? "document" : "documents"}`}
              selected={selectedFolderId === folder.id}
              onPress={() => onSelect(folder.id)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FolderMenuItem({
  label,
  body,
  selected,
  onPress,
}: {
  label: string;
  body: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.folderMenuItem, pressed && styles.pressed]}
    >
      <View style={styles.folderMenuCopy}>
        <Text style={styles.folderMenuTitle}>{label}</Text>
        <Text style={styles.folderMenuBody}>{body}</Text>
      </View>
      {selected ? <Check size={19} color={colors.text} /> : null}
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
  folderSelect: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
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
  folderMenu: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  folderMenuItem: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  folderMenuCopy: {
    flex: 1,
    minWidth: 0,
  },
  folderMenuTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  folderMenuBody: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.64,
  },
  dropZone: {
    minHeight: 172,
    marginTop: spacing.lg,
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
});
