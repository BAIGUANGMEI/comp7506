import { router } from "expo-router";
import { FileText, MessageCircle, Search, TextSearch, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, EmptyState, IconButton, Screen, goBackOrHome } from "@/components/ui";
import { colors, layout, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";

type SearchResult = Awaited<ReturnType<ReturnType<typeof useApp>["searchAll"]>>[number];

export default function SearchScreen() {
  const { searchAll } = useApp();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top + 2, 36);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [tab, setTab] = useState<"all" | "document" | "chat">("all");

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(async () => {
      const next = await searchAll(query);
      if (mounted) {
        setResults(next);
      }
    }, 180);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [query, searchAll]);

  const filtered =
    tab === "all"
      ? results
      : results.filter((result) => (tab === "chat" ? result.type === "chat" : result.type !== "chat"));

  return (
    <Screen scroll={false} padded={false} style={styles.screenContent}>
      <View
        style={[
          styles.searchBar,
          {
            height: topPadding + 54,
            paddingTop: topPadding,
            paddingHorizontal: layout.screenMargin,
          },
        ]}
      >
          <Search size={18} color={colors.textMuted} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search documents and chats"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
          />
          {query ? (
            <IconButton label="Clear search" onPress={() => setQuery("")} style={styles.closeButton}>
              <X size={18} color={colors.textMuted} />
            </IconButton>
          ) : null}
          <Text style={styles.cancel} onPress={goBackOrHome}>
            Cancel
          </Text>
        </View>

        <View style={styles.tabs}>
          {[
            ["all", "All"],
            ["document", "Documents"],
            ["chat", "Chats"],
          ].map(([value, label]) => (
            <Text
              key={value}
              onPress={() => setTab(value as typeof tab)}
              style={[styles.tab, tab === value && styles.activeTab]}
            >
              {label}
            </Text>
          ))}
        </View>

        <ScrollView
          style={styles.resultsScroll}
          contentContainerStyle={styles.resultsContent}
          keyboardShouldPersistTaps="handled"
        >
          {query.trim() ? (
            filtered.length > 0 ? (
              <Card>
                {filtered.map((result, index) => (
                  <SearchResultRow
                    key={result.id}
                    result={result}
                    last={index === filtered.length - 1}
                  />
                ))}
              </Card>
            ) : (
              <EmptyState
                title="No matches"
                body="Try another keyword, document title, or phrase from a chat answer."
              />
            )
          ) : (
            <EmptyState
              title="Search your workspace"
              body="Find document titles, extracted text chunks, and previous AI answers."
            />
          )}
        </ScrollView>
    </Screen>
  );
}

function SearchResultRow({ result, last }: { result: SearchResult; last?: boolean }) {
  const chat = result.type === "chat";
  const chunk = result.type === "chunk";
  const icon = chat ? (
    <MessageCircle size={18} color={colors.primary} />
  ) : chunk ? (
    <TextSearch size={18} color={colors.textMuted} />
  ) : (
    <FileText size={18} color={colors.text} />
  );
  const label = chat ? "Chat" : chunk ? "Chunk" : "Document";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (chat) {
          router.push({
            pathname: `/document/${result.documentId}/chat`,
            params: result.sessionId ? { sessionId: result.sessionId } : undefined,
          });
          return;
        }
        router.push(`/document/${result.documentId}`);
      }}
      style={({ pressed }) => [
        styles.result,
        chat && styles.chatResult,
        last && styles.lastResult,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.resultIcon, chat && styles.chatIcon]}>
        {icon}
      </View>
      <View style={styles.resultCopy}>
        <View style={styles.resultHeader}>
          <Text style={[styles.resultKind, chat && styles.chatKind]}>{label}</Text>
          <Text style={styles.resultMeta} numberOfLines={1}>
            {result.meta}
          </Text>
        </View>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {result.title}
        </Text>
        <Text style={[styles.resultBody, chat && styles.chatBody]} numberOfLines={chat ? 4 : 3}>
          {result.excerpt}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    minHeight: 0,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 0,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  closeButton: {
    width: 32,
    height: 32,
    marginLeft: -46,
  },
  cancel: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 15,
    paddingLeft: spacing.sm,
  },
  tabs: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  tab: {
    color: colors.textMuted,
    fontWeight: "600",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  activeTab: {
    color: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  resultsScroll: {
    flex: 1,
    minHeight: 0,
  },
  resultsContent: {
    flexGrow: 1,
    paddingHorizontal: layout.screenMargin,
    paddingBottom: 34,
  },
  result: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chatResult: {
    backgroundColor: "#F8F6F1",
  },
  lastResult: {
    borderBottomWidth: 0,
  },
  pressed: {
    opacity: 0.64,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  chatIcon: {
    backgroundColor: colors.primarySoft,
  },
  resultCopy: {
    flex: 1,
    minWidth: 0,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  resultKind: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  chatKind: {
    color: colors.primary,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  resultBody: {
    color: colors.textMuted,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  chatBody: {
    color: colors.text,
  },
  resultMeta: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
});
