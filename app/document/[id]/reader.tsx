import { router, useLocalSearchParams } from "expo-router";
import { ExternalLink, MessageCircle, Search } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Button, EmptyState, IconButton, Screen, TopBar } from "@/components/ui";
import { colors, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";
import type { DocumentChunk, DocumentRecord } from "@/lib/types";

type ReaderKind = "pdf" | "markdown" | "word" | "text";

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getDocumentById, getDocumentChunks } = useApp();
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

  const body = useMemo(
    () =>
      chunks
        .map((chunk) => {
          const heading = chunk.sectionTitle ? `${chunk.sectionTitle}\n\n` : "";
          return `${heading}${chunk.text}`;
        })
        .join("\n\n"),
    [chunks],
  );
  const readerBody = useMemo(() => {
    if (!document) {
      return "";
    }

    if (document.ext === "md" || document.ext === "txt") {
      return document.originalText || document.extractedText || body;
    }

    return document.extractedText || body;
  }, [body, document]);

  if (!document) {
    return (
      <Screen>
        <TopBar title="Reader" back />
        <EmptyState title="Nothing to read" body="This document is not available." />
      </Screen>
    );
  }

  const readerKind = getReaderKind(document.ext);

  return (
    <Screen>
      <TopBar
        title="Reader"
        back
        right={
          <>
            <IconButton label="Search" onPress={() => router.push("/search")}>
              <Search size={20} color={colors.text} />
            </IconButton>
            <IconButton label="Chat" onPress={() => router.push(`/document/${document.id}/chat`)}>
              <MessageCircle size={20} color={colors.text} />
            </IconButton>
          </>
        }
      />

      <View style={styles.header}>
        <Text style={styles.h1}>{document.title}</Text>
        <Text style={styles.meta}>
          {readerLabel(readerKind)} · {document.ext.toUpperCase()} · {chunks.length || 1} sections
        </Text>
      </View>

      <ReaderByFormat document={document} kind={readerKind} text={readerBody} />

      <Button onPress={() => router.push(`/document/${document.id}/chat`)}>
        Ask about this document
      </Button>
    </Screen>
  );
}

function ReaderByFormat({
  document,
  kind,
  text,
}: {
  document: DocumentRecord;
  kind: ReaderKind;
  text: string;
}) {
  if (kind === "pdf") {
    return <PdfReader document={document} fallbackText={text} />;
  }

  if (kind === "markdown") {
    return <MarkdownReader text={text} />;
  }

  if (kind === "word") {
    return <WordReader document={document} text={text} />;
  }

  return <TextReader text={text} />;
}

function PdfReader({
  document,
  fallbackText,
}: {
  document: DocumentRecord;
  fallbackText: string;
}) {
  if (Platform.OS === "web" && document.localUri) {
    return (
      <View style={styles.readerBlock}>
        <View style={styles.pdfFrameWrap}>
          {React.createElement("iframe", {
            src: document.localUri,
            title: document.title,
            style: {
              width: "100%",
              height: "100%",
              border: 0,
              backgroundColor: "#FFFFFF",
            },
          })}
        </View>
        <OpenOriginalButton uri={document.localUri} />
      </View>
    );
  }

  return (
    <View style={styles.readerBlock}>
      <OriginalUnavailable document={document} />
      <TextReader text={fallbackText} compact />
    </View>
  );
}

function MarkdownReader({ text }: { text: string }) {
  if (!text.trim()) {
    return <EmptyReader />;
  }

  return (
    <View style={[styles.readerBlock, styles.markdownPage]}>
      <MarkdownContent text={text} />
    </View>
  );
}

function WordReader({ document, text }: { document: DocumentRecord; text: string }) {
  const paragraphs = splitParagraphs(text);

  return (
    <View style={styles.readerBlock}>
      {document.localUri ? <OpenOriginalButton uri={document.localUri} /> : null}
      <View style={styles.wordPage}>
        <Text style={styles.wordTitle}>{document.title}</Text>
        <Text style={styles.wordMeta}>{document.ext.toUpperCase()} document reader</Text>
        {paragraphs.length > 0 ? (
          paragraphs.map((paragraph, index) => (
            <Text key={`${index}-${paragraph.slice(0, 16)}`} style={styles.wordParagraph}>
              {paragraph}
            </Text>
          ))
        ) : (
          <EmptyReader />
        )}
      </View>
    </View>
  );
}

function TextReader({ text, compact }: { text: string; compact?: boolean }) {
  const paragraphs = splitParagraphs(text);

  if (paragraphs.length === 0) {
    return <EmptyReader />;
  }

  return (
    <View style={[styles.readerBlock, styles.textPage, compact && styles.compactPage]}>
      {paragraphs.map((paragraph, index) => (
        <Text key={`${index}-${paragraph.slice(0, 16)}`} style={styles.readerText}>
          {paragraph}
        </Text>
      ))}
    </View>
  );
}

function OpenOriginalButton({ uri }: { uri: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open original file"
      onPress={() => openOriginal(uri)}
      style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}
    >
      <ExternalLink size={18} color={colors.text} />
      <Text style={styles.openButtonText}>Open original file</Text>
    </Pressable>
  );
}

function OriginalUnavailable({ document }: { document: DocumentRecord }) {
  return (
    <View style={styles.unavailable}>
      <Text style={styles.unavailableTitle}>Original file preview is unavailable</Text>
      <Text style={styles.unavailableText}>
        This {document.ext.toUpperCase()} was imported before original-file reading was enabled,
        or the platform did not provide a reusable file URI. The extracted document content is
        shown below.
      </Text>
    </View>
  );
}

function EmptyReader() {
  return (
    <View style={styles.emptyReader}>
      <Text style={styles.unavailableTitle}>No readable content</Text>
      <Text style={styles.unavailableText}>The document does not have readable text yet.</Text>
    </View>
  );
}

async function openOriginal(uri: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(uri, "_blank", "noopener,noreferrer");
    return;
  }
  await Linking.openURL(uri);
}

function getReaderKind(ext: string): ReaderKind {
  if (ext === "pdf") {
    return "pdf";
  }
  if (ext === "md") {
    return "markdown";
  }
  if (ext === "doc" || ext === "docx") {
    return "word";
  }
  return "text";
}

function readerLabel(kind: ReaderKind) {
  switch (kind) {
    case "pdf":
      return "PDF Reader";
    case "markdown":
      return "Markdown Reader";
    case "word":
      return "Word Reader";
    case "text":
      return "Text Reader";
  }
}

function splitParagraphs(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  h1: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 38,
    fontWeight: "800",
  },
  meta: {
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  readerBlock: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  pdfFrameWrap: {
    height: 560,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  openButton: {
    minHeight: 50,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  openButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.65,
  },
  markdownPage: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  readerText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 27,
  },
  wordPage: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  wordTitle: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "800",
  },
  wordMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  wordParagraph: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 27,
  },
  textPage: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  compactPage: {
    marginTop: 0,
  },
  unavailable: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  unavailableTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  unavailableText: {
    color: colors.textMuted,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  emptyReader: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
});
