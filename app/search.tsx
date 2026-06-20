import { router } from "expo-router";
import { Search, X } from "lucide-react-native";
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
                  <Pressable
                    key={result.id}
                    accessibilityRole="button"
                    onPress={() => router.push(`/document/${result.documentId}`)}
                    style={[
                      styles.result,
                      index === filtered.length - 1 && styles.lastResult,
                    ]}
                  >
                    <Text style={styles.resultTitle}>{result.title}</Text>
                    <Text style={styles.resultBody} numberOfLines={3}>
                      {result.excerpt}
                    </Text>
                    <Text style={styles.resultMeta}>{result.meta}</Text>
                  </Pressable>
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
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastResult: {
    borderBottomWidth: 0,
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
  resultMeta: {
    color: colors.textSubtle,
    marginTop: spacing.sm,
    fontSize: 12,
    fontWeight: "700",
  },
});
