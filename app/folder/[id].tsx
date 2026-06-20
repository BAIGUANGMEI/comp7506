import { router, useLocalSearchParams } from "expo-router";
import { Folder, Pencil, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, StyleSheet, Text, TextInput, View } from "react-native";
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
import { colors, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";
import type { DocumentRecord, FolderRecord } from "@/lib/types";
import { formatShortDate } from "@/lib/utils/dates";
import { getErrorMessage } from "@/lib/utils/errors";

export default function FolderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { folders, getFolderById, getDocumentsForFolder, renameFolder, deleteFolder } = useApp();
  const [folder, setFolder] = useState<FolderRecord | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      return;
    }
    const nextFolder = await getFolderById(id);
    setFolder(nextFolder);
    setDocuments(nextFolder ? await getDocumentsForFolder(id) : []);
  }, [getDocumentsForFolder, getFolderById, id]);

  useEffect(() => {
    load();
  }, [folders, load]);

  useEffect(() => {
    if (folder && !renaming) {
      setDraftName(folder.name);
    }
  }, [folder, renaming]);

  async function submitRename() {
    if (!folder) {
      return;
    }
    const trimmed = draftName.trim();
    if (!trimmed) {
      setRenameError("Enter a folder name.");
      return;
    }
    if (trimmed === folder.name) {
      setRenaming(false);
      setRenameError(null);
      return;
    }
    setRenameError(null);
    try {
      await renameFolder(folder.id, trimmed);
      setRenaming(false);
      await load();
    } catch (error) {
      setRenameError(getErrorMessage(error));
    }
  }

  async function remove() {
    if (!folder) {
      return;
    }

    const run = async () => {
      await deleteFolder(folder.id);
      router.replace("/");
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Delete "${folder.name}"? Documents will stay in your library.`)) {
        await run();
      }
      return;
    }

    Alert.alert(
      "Delete folder?",
      "Documents in this folder will stay in your library.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: run },
      ],
    );
  }

  if (!folder) {
    return (
      <Screen>
        <TopBar title="Folder" back />
        <EmptyState
          title="Folder not found"
          body="This folder may have been deleted."
          action={<Button onPress={() => router.replace("/")}>Back to Library</Button>}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar
        title="Folder"
        back
        right={
          <View style={styles.headerActions}>
            <IconButton label="Rename folder" onPress={() => setRenaming(true)}>
              <Pencil size={19} color={colors.text} />
            </IconButton>
            <IconButton label="Delete folder" onPress={remove}>
              <Trash2 size={20} color={colors.danger} />
            </IconButton>
          </View>
        }
      />

      <View style={styles.hero}>
        <View style={styles.folderIcon}>
          <Folder size={26} color={colors.folder} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>{folder.name}</Text>
          <Text style={styles.meta}>
            {folder.documentCount} {folder.documentCount === 1 ? "document" : "documents"} · Updated{" "}
            {formatShortDate(folder.updatedAt)}
          </Text>
        </View>
      </View>

      {renaming ? (
        <Card style={styles.renameCard}>
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            placeholder="Folder name"
            placeholderTextColor={colors.textSubtle}
            autoFocus
            style={styles.renameInput}
          />
          {renameError ? <Text style={styles.renameError}>{renameError}</Text> : null}
          <View style={styles.renameActions}>
            <Button
              variant="ghost"
              onPress={() => {
                setDraftName(folder.name);
                setRenameError(null);
                setRenaming(false);
              }}
            >
              Cancel
            </Button>
            <Button onPress={submitRename}>Save</Button>
          </View>
        </Card>
      ) : null}

      <SectionTitle>Documents</SectionTitle>
      <Card>
        {documents.length > 0 ? (
          documents.map((document) => (
            <DocumentRow
              key={document.id}
              document={document}
              onPress={() => router.push(`/document/${document.id}`)}
            />
          ))
        ) : (
          <EmptyState
            title="No documents in this folder"
            body="Open a document detail page and move it into this folder."
            action={
              <Button
                onPress={() =>
                  router.push({ pathname: "/import", params: { folderId: folder.id } })
                }
              >
                Import Document
              </Button>
            }
          />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  hero: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  folderIcon: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.folderSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "500",
  },
  meta: {
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  renameCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  renameInput: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  renameError: {
    color: colors.danger,
    lineHeight: 20,
  },
  renameActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
});
