import { router } from "expo-router";
import { MessageCircle, RotateCcw, Sparkles } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  Button,
  Card,
  DocumentBadge,
  EmptyState,
  Screen,
  SectionTitle,
  StatusPill,
  TopBar,
} from "@/components/ui";
import { DEFAULT_AGENT_CONFIG } from "@/config/defaults";
import { colors, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";
import type { ChatMessage, DocumentRecord } from "@/lib/types";
import { formatShortDate } from "@/lib/utils/dates";

type ConversationSummary = {
  document: DocumentRecord;
  sessionCount: number;
  messageCount: number;
  lastMessage: ChatMessage | null;
};

export default function ConversationsScreen() {
  const { activeChats, agentConfig, documents, getChatSessions, getMessages, saveAgentConfig } = useApp();
  const [summaries, setSummaries] = useState<ConversationSummary[]>([]);
  const [agentPrompt, setAgentPrompt] = useState(agentConfig.systemPrompt);
  const [savingAgent, setSavingAgent] = useState(false);
  const [agentMessage, setAgentMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = await Promise.all(
      documents.map(async (document) => {
        const [messages, sessions] = await Promise.all([
          getMessages(document.id),
          getChatSessions(document.id),
        ]);
        return {
          document,
          sessionCount: sessions.length,
          messageCount: messages.length,
          lastMessage: messages[messages.length - 1] ?? null,
        };
      }),
    );
    setSummaries(
      next.sort((left, right) => {
        const leftTime = left.lastMessage?.createdAt ?? left.document.updatedAt;
        const rightTime = right.lastMessage?.createdAt ?? right.document.updatedAt;
        return rightTime.localeCompare(leftTime);
      }),
    );
  }, [documents, getChatSessions, getMessages]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setAgentPrompt(agentConfig.systemPrompt);
  }, [agentConfig.systemPrompt]);

  async function saveAgent() {
    setSavingAgent(true);
    setAgentMessage(null);
    try {
      await saveAgentConfig({ systemPrompt: agentPrompt });
      setAgentMessage("Agent instructions saved.");
    } finally {
      setSavingAgent(false);
    }
  }

  async function resetAgent() {
    setSavingAgent(true);
    setAgentMessage(null);
    try {
      setAgentPrompt(DEFAULT_AGENT_CONFIG.systemPrompt);
      await saveAgentConfig(DEFAULT_AGENT_CONFIG);
      setAgentMessage("Agent instructions reset.");
    } finally {
      setSavingAgent(false);
    }
  }

  const readySummaries = useMemo(
    () => summaries.filter((summary) => summary.document.status === "ready"),
    [summaries],
  );
  const unavailableSummaries = useMemo(
    () => summaries.filter((summary) => summary.document.status !== "ready"),
    [summaries],
  );
  const activeCount = Object.values(activeChats).filter((chat) => chat.status === "pending").length;

  return (
    <Screen>
      <TopBar title="AI Conversations" menu search />

      {activeCount > 0 ? (
        <View style={styles.activeNotice}>
          <Text style={styles.activeNoticeText}>
            {activeCount} {activeCount === 1 ? "answer is" : "answers are"} still generating.
          </Text>
        </View>
      ) : null}

      <SectionTitle>Agent</SectionTitle>
      <Card style={styles.agentCard}>
        <View style={styles.agentHeader}>
          <View style={styles.agentIcon}>
            <Sparkles size={19} color={colors.text} />
          </View>
          <View style={styles.agentCopy}>
            <Text style={styles.agentTitle}>Custom Agent Instructions</Text>
            <Text style={styles.agentMeta}>Applied to every document conversation.</Text>
          </View>
        </View>
        <TextInput
          value={agentPrompt}
          onChangeText={(value) => {
            setAgentPrompt(value);
            setAgentMessage(null);
          }}
          multiline
          textAlignVertical="top"
          placeholder="Describe how the AI should answer."
          placeholderTextColor={colors.textSubtle}
          style={styles.promptInput}
        />
        {agentMessage ? <Text style={styles.agentMessage}>{agentMessage}</Text> : null}
        <View style={styles.agentActions}>
          <Button
            variant="secondary"
            icon={<RotateCcw size={16} color={colors.text} />}
            onPress={resetAgent}
            disabled={savingAgent}
            style={styles.agentButton}
          >
            Reset
          </Button>
          <Button
            onPress={saveAgent}
            loading={savingAgent}
            disabled={agentPrompt.trim() === agentConfig.systemPrompt.trim()}
            style={styles.agentButton}
          >
            Save Agent
          </Button>
        </View>
      </Card>

      <SectionTitle>Available Documents</SectionTitle>
      <Card>
        {readySummaries.length > 0 ? (
          readySummaries.map((summary, index) => (
            <ConversationRow
              key={summary.document.id}
              summary={summary}
              active={Object.values(activeChats).some(
                (chat) => chat.documentId === summary.document.id && chat.status === "pending",
              )}
              last={index === readySummaries.length - 1}
            />
          ))
        ) : (
          <EmptyState
            title="No documents ready for chat"
            body="Import a document with AI analysis enabled to create a grounded conversation."
            action={<Button onPress={() => router.push("/import")}>Import Document</Button>}
          />
        )}
      </Card>

      {unavailableSummaries.length > 0 ? (
        <>
          <SectionTitle>Not Ready</SectionTitle>
          <Card>
            {unavailableSummaries.map((summary, index) => (
              <ConversationRow
                key={summary.document.id}
                summary={summary}
                disabled
                last={index === unavailableSummaries.length - 1}
              />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function ConversationRow({
  summary,
  active,
  disabled,
  last,
}: {
  summary: ConversationSummary;
  active?: boolean;
  disabled?: boolean;
  last?: boolean;
}) {
  const { document, lastMessage, messageCount } = summary;
  const meta = active
    ? "Generating an answer"
    : messageCount > 0
      ? `${summary.sessionCount} ${summary.sessionCount === 1 ? "session" : "sessions"} · ${messageCount} ${messageCount === 1 ? "message" : "messages"} · Last ${formatShortDate(lastMessage?.createdAt ?? document.updatedAt)}`
      : "Start a new conversation";
  const excerpt = lastMessage?.content?.trim() || "Ask AI to summarize, compare, or find details in this document.";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => router.push(`/document/${document.id}/chat`)}
      style={({ pressed }) => [
        styles.row,
        last && styles.lastRow,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <DocumentBadge ext={document.ext} />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {document.title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {meta}
        </Text>
        <Text style={styles.rowExcerpt} numberOfLines={2}>
          {excerpt}
        </Text>
      </View>
      {disabled ? (
        <StatusPill status={document.status} />
      ) : (
        <View style={styles.openIcon}>
          <MessageCircle size={18} color={colors.text} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  activeNotice: {
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
  },
  activeNoticeText: {
    color: colors.text,
    fontWeight: "700",
  },
  agentCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  agentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  agentIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  agentCopy: {
    flex: 1,
    minWidth: 0,
  },
  agentTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  agentMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  promptInput: {
    minHeight: 132,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  agentMessage: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  agentActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  agentButton: {
    flex: 1,
  },
  row: {
    minHeight: 92,
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
    fontSize: 13,
    marginTop: 3,
  },
  rowExcerpt: {
    color: colors.textMuted,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  openIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.64,
  },
  disabled: {
    opacity: 0.58,
  },
});
