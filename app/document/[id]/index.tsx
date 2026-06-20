import { router, useLocalSearchParams } from "expo-router";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react-native";
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
  const { getDocumentById, getDocumentChunks, deleteDocument } = useApp();
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
      await run();
      return;
    }
    Alert.alert("Delete document?", "This removes the local summary, chunks, and chat history.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: run },
    ]);
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

  return (
    <Screen>
      <TopBar
        title="Document Detail"
        back
        right={
          <IconButton label="Delete document" onPress={remove}>
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

      {document.error ? <Text style={styles.error}>{document.error}</Text> : null}

      <SectionTitle>Properties</SectionTitle>
      <Card>
        <Property label="Format" value={document.ext.toUpperCase()} />
        <Property label="Status" value={document.status} />
        <Property label="Created" value={formatShortDate(document.createdAt)} />
        <Property label="Updated" value={formatShortDate(document.updatedAt)} last />
      </Card>

      <SectionTitle>Overview</SectionTitle>
      <CollapsibleMarkdownCard
        text={document.summary}
        emptyText="The document is still being processed. Pull back later for the summary."
      />

      <SectionTitle>Visual Content</SectionTitle>
      <CollapsibleMarkdownCard
        text={document.visualSummary}
        emptyText="No visual content was detected in the extraction."
      />

      <SectionTitle>Table of Contents</SectionTitle>
      <Card>
        {chunks.slice(0, 5).map((chunk, index) => (
          <Property
            key={chunk.id}
            label={`Chunk ${index + 1}`}
            value={chunk.sectionTitle || "Untitled section"}
            last={index === Math.min(chunks.length, 5) - 1}
          />
        ))}
      </Card>

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
    </Screen>
  );
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
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "800",
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
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});
