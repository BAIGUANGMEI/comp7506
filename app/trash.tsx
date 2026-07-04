import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { RotateCcw, Trash2 } from "lucide-react-native";
import {
  Card,
  DocumentBadge,
  EmptyState,
  IconButton,
  Screen,
  SectionTitle,
  TopBar,
} from "@/components/ui";
import { colors, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";
import type { DocumentRecord } from "@/lib/types";
import { formatShortDate } from "@/lib/utils/dates";
import { getErrorMessage } from "@/lib/utils/errors";

export default function TrashScreen() {
  const { getTrashedDocuments, restoreDocument, permanentlyDeleteDocument } = useApp();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setDocuments(await getTrashedDocuments());
  }, [getTrashedDocuments]);

  useEffect(() => {
    load();
  }, [load]);

  async function restore(document: DocumentRecord) {
    setBusyId(document.id);
    setError(null);
    try {
      await restoreDocument(document.id);
      await load();
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setBusyId(null);
    }
  }

  async function removeForever(document: DocumentRecord) {
    const run = async () => {
      setBusyId(document.id);
      setError(null);
      try {
        await permanentlyDeleteDocument(document.id);
        await load();
      } catch (nextError) {
        setError(getErrorMessage(nextError));
      } finally {
        setBusyId(null);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Permanently delete "${document.title}"? This cannot be undone.`)) {
        await run();
      }
      return;
    }

    Alert.alert(
      "Delete forever?",
      "This permanently removes the document, extracted chunks, summary, and chat history.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete Forever", style: "destructive", onPress: run },
      ],
    );
  }

  return (
    <Screen>
      <TopBar title="Trash" menu />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <SectionTitle>Deleted Documents</SectionTitle>
      <Card>
        {documents.length > 0 ? (
          documents.map((document, index) => (
            <TrashRow
              key={document.id}
              document={document}
              busy={busyId === document.id}
              last={index === documents.length - 1}
              onRestore={() => restore(document)}
              onDelete={() => removeForever(document)}
            />
          ))
        ) : (
          <EmptyState
            title="Trash is empty"
            body="Documents you delete from the library will appear here before permanent removal."
          />
        )}
      </Card>
    </Screen>
  );
}

function TrashRow({
  document,
  busy,
  last,
  onRestore,
  onDelete,
}: {
  document: DocumentRecord;
  busy: boolean;
  last?: boolean;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.row, last && styles.lastRow]}>
      <DocumentBadge ext={document.ext} />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {document.title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          Deleted {document.deletedAt ? formatShortDate(document.deletedAt) : "recently"} · {document.ext.toUpperCase()}
        </Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onRestore}
            style={({ pressed }) => [styles.action, pressed && styles.pressed, busy && styles.disabled]}
          >
            <RotateCcw size={16} color={colors.text} />
            <Text style={styles.actionText}>Restore</Text>
          </Pressable>
          <IconButton
            label="Delete forever"
            onPress={busy ? undefined : onDelete}
            style={[styles.deleteButton, busy && styles.disabled]}
          >
            <Trash2 size={18} color={colors.danger} />
          </IconButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.danger,
    backgroundColor: "#FFF2F2",
    padding: spacing.md,
    borderRadius: radius.md,
    lineHeight: 20,
  },
  row: {
    minHeight: 96,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  rowMeta: {
    color: colors.textMuted,
    marginTop: 3,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  action: {
    minHeight: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  actionText: {
    color: colors.text,
    fontWeight: "700",
  },
  deleteButton: {
    backgroundColor: "#FFF2F2",
  },
  pressed: {
    opacity: 0.65,
  },
  disabled: {
    opacity: 0.5,
  },
});
