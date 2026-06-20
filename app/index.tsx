import { router } from "expo-router";
import { Folder, FolderPlus, Plus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  Button,
  Card,
  DocumentRow,
  EmptyState,
  IconButton,
  Screen,
  SectionTitle,
  TopBar,
} from "@/components/ui";
import { colors, layout, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";
import type { FolderRecord } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils/errors";

export default function DocumentLibraryScreen() {
  const { documents, folders, apiKey, createFolder } = useApp();
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderError, setFolderError] = useState<string | null>(null);

  async function submitFolder() {
    if (!folderName.trim()) {
      setFolderError("Enter a folder name.");
      return;
    }
    setFolderError(null);
    try {
      await createFolder(folderName);
      setFolderName("");
      setCreatingFolder(false);
    } catch (error) {
      setFolderError(getErrorMessage(error));
    }
  }

  return (
    <Screen>
      <TopBar title="Document Library" menu search settings />

      {!apiKey ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/settings", params: { entry: "stack" } })}
          style={styles.configBanner}
        >
          <Text style={styles.configTitle}>Connect your AI API</Text>
          <Text style={styles.configBody}>
            Add an API key and keep Kimi k2.6 as the default model, or point the app
            at another OpenAI-compatible endpoint.
          </Text>
        </Pressable>
      ) : null}

      <SectionTitle>Recent Documents</SectionTitle>
      <Card>
        {documents.length > 0 ? (
          documents
            .slice(0, 6)
            .map((document) => (
              <DocumentRow
                key={document.id}
                document={document}
                onPress={() => router.push(`/document/${document.id}`)}
              />
            ))
        ) : (
          <EmptyState
            title="No documents yet"
            body="Import a TXT, Markdown, PDF, DOC, or DOCX file to generate a summary and ask questions."
            action={<Button onPress={() => router.push("/import")}>Import Document</Button>}
          />
        )}
      </Card>

      <SectionTitle>Folders</SectionTitle>
      <Card>
        {folders.map((folder, index) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            last={index === folders.length - 1}
          />
        ))}
      </Card>

      {creatingFolder ? (
        <Card style={styles.createFolderCard}>
          <TextInput
            value={folderName}
            onChangeText={setFolderName}
            placeholder="Folder name"
            placeholderTextColor={colors.textSubtle}
            autoFocus
            style={styles.folderInput}
          />
          {folderError ? <Text style={styles.folderError}>{folderError}</Text> : null}
          <View style={styles.createFolderActions}>
            <Button variant="ghost" onPress={() => setCreatingFolder(false)}>
              Cancel
            </Button>
            <Button onPress={submitFolder}>Create</Button>
          </View>
        </Card>
      ) : (
        <Button
          variant="secondary"
          icon={<FolderPlus size={18} color={colors.text} />}
          onPress={() => setCreatingFolder(true)}
        >
          New Folder
        </Button>
      )}

      <View style={styles.fabWrap}>
        <IconButton
          label="Import document"
          onPress={() => router.push("/import")}
          style={styles.fab}
        >
          <Plus size={28} color="#FFFFFF" />
        </IconButton>
      </View>
    </Screen>
  );
}

function FolderRow({
  folder,
  last,
}: {
  folder: FolderRecord;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/folder/${folder.id}`)}
      style={({ pressed }) => [styles.folderRow, last && styles.lastRow, pressed && styles.pressed]}
    >
      <View style={styles.folderIcon}>
        <Folder size={20} color={colors.folder} />
      </View>
      <View>
        <Text style={styles.folderTitle}>{folder.name}</Text>
        <Text style={styles.folderSub}>
          {folder.documentCount} {folder.documentCount === 1 ? "document" : "documents"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  configBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  configTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  configBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  folderRow: {
    minHeight: 68,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  folderIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.folderSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  folderTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  folderSub: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 3,
  },
  createFolderCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  folderInput: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  folderError: {
    color: colors.danger,
    lineHeight: 20,
  },
  createFolderActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.65,
  },
  fabWrap: {
    position: "absolute",
    right: layout.screenMargin,
    bottom: 28,
  },
  fab: {
    width: 58,
    height: 58,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
});
