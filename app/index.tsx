import { router } from "expo-router";
import { Folder, Plus, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
  const { documents, folders, apiKey, createFolder, deleteFolder } = useApp();
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

  function closeFolderModal() {
    setCreatingFolder(false);
    setFolderName("");
    setFolderError(null);
  }

  async function removeFolder(folder: FolderRecord) {
    const run = async () => {
      try {
        await deleteFolder(folder.id);
      } catch (error) {
        setFolderError(getErrorMessage(error));
      }
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

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderTitle}>Folders</Text>
        <IconButton
          label="New folder"
          onPress={() => setCreatingFolder(true)}
          style={styles.addFolderButton}
        >
          <Plus size={18} color={colors.text} />
        </IconButton>
      </View>
      <Card>
        {folders.map((folder, index) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            last={index === folders.length - 1}
            onDelete={() => removeFolder(folder)}
          />
        ))}
      </Card>

      <Modal
        visible={creatingFolder}
        transparent
        animationType="fade"
        onRequestClose={closeFolderModal}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close new folder dialog"
          style={styles.modalScrim}
          onPress={closeFolderModal}
        >
          <Pressable
            accessibilityRole="none"
            onPress={(event) => event.stopPropagation()}
            style={styles.modalCard}
          >
            <Text style={styles.modalTitle}>New Folder</Text>
            <Text style={styles.modalBody}>Create a folder to organize related documents.</Text>
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
              <Button variant="ghost" onPress={closeFolderModal}>
                Cancel
              </Button>
              <Button onPress={submitFolder}>Create</Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
  onDelete,
}: {
  folder: FolderRecord;
  last?: boolean;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.folderRow, last && styles.lastRow]}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/folder/${folder.id}`)}
        style={({ pressed }) => [styles.folderMain, pressed && styles.pressed]}
      >
        <View style={styles.folderIcon}>
          <Folder size={20} color={colors.folder} />
        </View>
        <View style={styles.folderCopy}>
          <Text style={styles.folderTitle} numberOfLines={1}>{folder.name}</Text>
          <Text style={styles.folderSub}>
            {folder.documentCount} {folder.documentCount === 1 ? "document" : "documents"}
          </Text>
        </View>
      </Pressable>
      <IconButton label={`Delete ${folder.name}`} onPress={onDelete} style={styles.deleteFolderButton}>
        <Trash2 size={18} color={colors.danger} />
      </IconButton>
    </View>
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
  sectionHeader: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    marginBottom: 6,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  addFolderButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  folderRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  folderMain: {
    flex: 1,
    minHeight: 68,
    minWidth: 0,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
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
  folderCopy: {
    flex: 1,
    minWidth: 0,
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
  deleteFolderButton: {
    marginRight: spacing.md,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: "#1D1D1B66",
    alignItems: "center",
    justifyContent: "center",
    padding: layout.screenMargin,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "500",
  },
  modalBody: {
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: -spacing.xs,
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
