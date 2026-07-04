import { router, useLocalSearchParams } from "expo-router";
import { ChevronDown, ChevronUp, Folder, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { MarkdownContent } from "@/components/MarkdownContent";
import {
  Button,
  Card,
  DocumentBadge,
  EmptyState,
  IconButton,
  Screen,
  SectionTitle,
  StatusPill,
  TopBar,
} from "@/components/ui";
import { colors, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";
import type { DocumentChunk, DocumentRecord } from "@/lib/types";
import { formatShortDate } from "@/lib/utils/dates";

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { folders, getDocumentById, getDocumentChunks, deleteDocument, moveDocumentToFolder } = useApp();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);

  const load = useCallback(async () => {
    if (!id) {
      return;
    }
    const nextDocument = await getDocumentById(id);
    setDocument(nextDocument);
    setChunks(nextDocument ? await getDocumentChunks(id) : []);
  }, [getDocumentById, getDocumentChunks, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove() {
    if (!document) {
      return;
    }
    const run = async () => {
      await deleteDocument(document.id);
      router.replace("/");
    };
    if (Platform.OS === "web") {
      if (window.confirm("Move this document to Trash? You can restore it later from the Trash page.")) {
        await run();
      }
      return;
    }
    Alert.alert("Move to Trash?", "You can restore this document later from the Trash page.", [
      { text: "Cancel", style: "cancel" },
      { text: "Move to Trash", style: "destructive", onPress: run },
    ]);
  }

  async function moveToFolder() {
    if (!document) {
      return;
    }
    const selectedFolderId = await askForFolder({
      currentFolderId: document.folderId ?? null,
      folders,
    });
    if (selectedFolderId === undefined) {
      return;
    }
    await moveDocumentToFolder(document.id, selectedFolderId);
    await load();
  }

  if (!document) {
    return (
      <Screen>
        <TopBar title="Document Detail" back />
        <EmptyState
          title="Document not found"
          body="The document may have been deleted."
          action={<Button onPress={() => router.replace("/")}>Back to Library</Button>}
        />
      </Screen>
    );
  }

  const visualSummary = visibleVisualSummary(document.visualSummary);

  return (
    <Screen>
      <TopBar
        title="Document Detail"
        back
        right={
          <IconButton label="Move document to Trash" onPress={remove}>
            <Trash2 size={20} color={colors.danger} />
          </IconButton>
        }
      />

      <View style={styles.hero}>
        <DocumentBadge ext={document.ext} />
        <View style={styles.heroText}>
          <Text style={styles.title}>{document.title}</Text>
          <Text style={styles.meta}>
            {document.ext.toUpperCase()} · {chunks.length} chunks · {formatShortDate(document.updatedAt)}
          </Text>
        </View>
        <StatusPill status={document.status} />
      </View>

      <View style={styles.actions}>
        <Button
          variant="secondary"
          onPress={() => router.push(`/document/${document.id}/reader`)}
        >
          Read
        </Button>
        <Button
          onPress={() => router.push(`/document/${document.id}/chat`)}
          disabled={document.status !== "ready"}
        >
          Ask AI
        </Button>
      </View>

      {document.error ? <Text style={styles.error}>{document.error}</Text> : null}

      <SectionTitle>Properties</SectionTitle>
      <Card>
        <Property label="Format" value={document.ext.toUpperCase()} />
        <Property label="Status" value={document.status} />
        <Property label="Folder" value={folderName(document.folderId, folders)} />
        <Property label="Created" value={formatShortDate(document.createdAt)} />
        <Property label="Updated" value={formatShortDate(document.updatedAt)} last />
      </Card>

      <SectionTitle>Folder</SectionTitle>
      <Card style={styles.folderCard}>
        <View style={styles.folderSummary}>
          <View style={styles.folderIcon}>
            <Folder size={21} color={colors.folder} />
          </View>
          <View style={styles.folderCopy}>
            <Text style={styles.folderTitle}>{folderName(document.folderId, folders)}</Text>
            <Text style={styles.folderBody}>Organize this document in your library.</Text>
          </View>
        </View>
        <Button variant="secondary" onPress={moveToFolder}>
          Move to Folder
        </Button>
      </Card>

      <SectionTitle>Overview</SectionTitle>
      <CollapsibleMarkdownCard
        text={document.summary}
        emptyText="The document is still being processed. Pull back later for the summary."
      />

      {visualSummary ? (
        <>
          <SectionTitle>Visual Content</SectionTitle>
          <CollapsibleMarkdownCard
            text={visualSummary}
            emptyText="No visual content was detected in the extraction."
          />
        </>
      ) : null}

      {chunks.length > 0 ? (
        <>
          <SectionTitle>Chunks</SectionTitle>
          <Card style={styles.chunkList}>
            {chunks.map((chunk, index) => (
              <ChunkPreview
                key={chunk.id}
                chunk={chunk}
                last={index === chunks.length - 1}
              />
            ))}
          </Card>
        </>
      ) : null}

    </Screen>
  );
}

function visibleVisualSummary(text?: string | null) {
  const content = text?.trim();
  if (!content) {
    return null;
  }
  if (/^AI visual analysis was not run/i.test(content)) {
    return null;
  }
  if (/^No visual content/i.test(content)) {
    return null;
  }
  return content;
}

function folderName(folderId: string | null | undefined, folders: Array<{ id: string; name: string }>) {
  if (!folderId) {
    return "No Folder";
  }
  return folders.find((folder) => folder.id === folderId)?.name ?? "Unknown Folder";
}

function askForFolder({
  currentFolderId,
  folders,
}: {
  currentFolderId: string | null;
  folders: Array<{ id: string; name: string }>;
}) {
  if (Platform.OS === "web") {
    const options = ["0. No Folder", ...folders.map((folder, index) => `${index + 1}. ${folder.name}`)];
    const answer = window.prompt(`Move to folder:\n${options.join("\n")}`, currentFolderId ? "" : "0");
    if (answer === null) {
      return Promise.resolve<undefined | string | null>(undefined);
    }
    const index = Number(answer.trim());
    if (index === 0) {
      return Promise.resolve(null);
    }
    return Promise.resolve(folders[index - 1]?.id);
  }

  return new Promise<undefined | string | null>((resolve) => {
    Alert.alert(
      "Move to folder",
      "Choose where this document should live.",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(undefined) },
        { text: "No Folder", onPress: () => resolve(null) },
        ...folders.map((folder) => ({
          text: folder.name,
          onPress: () => resolve(folder.id),
        })),
      ],
    );
  });
}

function Property({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.property, last && styles.lastProperty]}>
      <Text style={styles.propertyLabel}>{label}</Text>
      <Text style={styles.propertyValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function ChunkPreview({ chunk, last }: { chunk: DocumentChunk; last?: boolean }) {
  const title = chunk.sectionTitle?.trim();

  return (
    <View style={[styles.chunkItem, last && styles.lastChunkItem]}>
      <Text style={styles.chunkNumber}>Chunk {chunk.chunkIndex + 1}</Text>
      {title ? (
        <Text style={styles.chunkTitle} numberOfLines={1}>
          {title}
        </Text>
      ) : null}
    </View>
  );
}

function CollapsibleMarkdownCard({
  text,
  emptyText,
}: {
  text?: string | null;
  emptyText: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const content = text?.trim();
  const canCollapse = Boolean(
    content && (content.length > 520 || content.split(/\n/).length > 8),
  );

  return (
    <Card style={styles.summaryCard}>
      {content ? (
        <View style={[styles.markdownClip, canCollapse && !expanded && styles.markdownCollapsed]}>
          <MarkdownContent text={content} compact />
        </View>
      ) : (
        <Text style={styles.summaryText}>{emptyText}</Text>
      )}

      {canCollapse ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Collapse overview" : "Expand overview"}
          onPress={() => setExpanded((current) => !current)}
          style={({ pressed }) => [styles.expandButton, pressed && styles.pressed]}
        >
          <Text style={styles.expandText}>{expanded ? "Show less" : "Show more"}</Text>
          {expanded ? (
            <ChevronUp size={17} color={colors.text} />
          ) : (
            <ChevronDown size={17} color={colors.text} />
          )}
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "500",
    color: colors.text,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  error: {
    color: colors.danger,
    backgroundColor: "#FFF2F2",
    padding: spacing.md,
    borderRadius: radius.md,
    lineHeight: 20,
  },
  folderCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  folderSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  folderIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
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
    fontWeight: "800",
  },
  folderBody: {
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: 2,
  },
  summaryCard: {
    padding: spacing.lg,
  },
  summaryText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 24,
  },
  markdownClip: {
    overflow: "hidden",
  },
  markdownCollapsed: {
    maxHeight: 220,
  },
  expandButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  expandText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.62,
  },
  property: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastProperty: {
    borderBottomWidth: 0,
  },
  propertyLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    width: 90,
  },
  propertyValue: {
    flex: 1,
    textAlign: "right",
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  chunkList: {
    paddingVertical: spacing.xs,
  },
  chunkItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  lastChunkItem: {
    borderBottomWidth: 0,
  },
  chunkNumber: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  chunkTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
});
