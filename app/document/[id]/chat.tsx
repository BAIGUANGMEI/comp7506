import { router, useLocalSearchParams } from "expo-router";
import { Download, History, Plus, Send, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MarkdownContent, toSuperscriptNumber } from "@/components/MarkdownContent";
import { Card, DocumentBadge, IconButton, Screen, TopBar } from "@/components/ui";
import { colors, layout, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";
import { buildChatTranscriptMarkdown, chatTranscriptFilename } from "@/lib/chat/export";
import type { ChatMessage, ChatSession, DocumentChunk, DocumentRecord } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils/errors";
import { formatShortDate } from "@/lib/utils/dates";

export default function ChatScreen() {
  const { id, sessionId: routeSessionId } = useLocalSearchParams<{ id: string; sessionId?: string }>();
  const insets = useSafeAreaInsets();
  const {
    activeChats,
    createChatSession,
    deleteChatSession,
    getChatSessions,
    getDocumentById,
    getDocumentChunks,
    getMessagesForSession,
    sendQuestion,
  } = useApp();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const mountedRef = useRef(true);
  const hadActiveChatRef = useRef(false);
  const creatingSessionRef = useRef(false);
  const activeChat = session ? activeChats[session.id] : undefined;
  const activeStatus = activeChat?.status;
  const activePartial = activeChat?.partial ?? "";
  const busy = submitting || activeStatus === "pending";
  const activeError = activeStatus === "failed" ? activeChat?.error : error;

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const load = useCallback(async () => {
    if (!id) {
      return;
    }
    const [nextDocument, nextChunks, nextSessions] = await Promise.all([
      getDocumentById(id),
      getDocumentChunks(id),
      getChatSessions(id),
    ]);
    if (!nextDocument) {
      if (!mountedRef.current) {
        return;
      }
      setDocument(null);
      setSession(null);
      setSessions([]);
      setChunks([]);
      setMessages([]);
      return;
    }

    let availableSessions = nextSessions;
    let selectedSession =
      (routeSessionId ? availableSessions.find((candidate) => candidate.id === routeSessionId) : null)
      ?? availableSessions[0];
    if (!selectedSession) {
      selectedSession = await createChatSession(id);
      availableSessions = [selectedSession];
    }
    const nextMessages = await getMessagesForSession(selectedSession.id);
    if (!mountedRef.current) {
      return;
    }
    setDocument(nextDocument);
    setSession(selectedSession);
    setSessions(availableSessions);
    setChunks(nextChunks);
    setMessages(nextMessages);
  }, [
    createChatSession,
    getChatSessions,
    getDocumentById,
    getDocumentChunks,
    getMessagesForSession,
    id,
    routeSessionId,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (activeStatus === "pending") {
      hadActiveChatRef.current = true;
    }
    if (hadActiveChatRef.current && activeStatus !== "pending") {
      hadActiveChatRef.current = false;
      load();
    }
  }, [activeStatus, load]);

  useEffect(() => {
    if (busy || activePartial) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [activePartial, busy]);

  function submit() {
    if (!id || !session || !input.trim() || busy) {
      return;
    }
    const question = input.trim();
    setInput("");
    setSubmitting(true);
    setError(null);
    setMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        documentId: id,
        sessionId: session.id,
        role: "user",
        content: question,
        createdAt: new Date().toISOString(),
      },
    ]);
    sendQuestion(session.id, question)
      .then(() => {
        if (mountedRef.current) {
          load();
        }
      })
      .catch((nextError) => {
        if (mountedRef.current) {
          setError(getErrorMessage(nextError));
        }
      })
      .finally(() => {
        if (mountedRef.current) {
          setSubmitting(false);
        }
      });
  }

  async function startNewSession() {
    if (!id || !session || creatingSessionRef.current) {
      return;
    }
    if (messages.length === 0) {
      showEmptySessionNotice();
      return;
    }

    creatingSessionRef.current = true;
    setError(null);
    try {
      const nextSession = await createChatSession(id);
      setSession(nextSession);
      setSessions((current) => [nextSession, ...current]);
      setMessages([]);
      setSessionPickerOpen(false);
      router.setParams({ sessionId: nextSession.id });
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      creatingSessionRef.current = false;
    }
  }

  async function selectSession(nextSession: ChatSession) {
    setError(null);
    setSession(nextSession);
    setSessionPickerOpen(false);
    router.setParams({ sessionId: nextSession.id });
    setMessages(await getMessagesForSession(nextSession.id));
  }

  async function deleteSession(targetSession: ChatSession) {
    if (!id) {
      return;
    }
    if (activeChats[targetSession.id]?.status === "pending") {
      setError("Wait for this answer to finish before deleting the conversation.");
      return;
    }

    const run = async () => {
      try {
        setError(null);
        await deleteChatSession(targetSession.id);
        let nextSessions = await getChatSessions(id);
        let nextSession = session;

        if (targetSession.id === session?.id) {
          nextSession = nextSessions[0] ?? null;
          if (!nextSession) {
            nextSession = await createChatSession(id);
            nextSessions = [nextSession];
          }
          setSession(nextSession);
          setMessages(await getMessagesForSession(nextSession.id));
          router.setParams({ sessionId: nextSession.id });
        }

        setSessions(nextSessions);
        setSessionPickerOpen(false);
      } catch (nextError) {
        const message = getErrorMessage(nextError);
        setError(message);
        if (Platform.OS !== "web") {
          Alert.alert("Delete failed", message);
        }
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Delete "${targetSession.title}"? This removes this conversation and its messages.`)) {
        await run();
      }
      return;
    }

    Alert.alert(
      "Delete conversation?",
      "This removes this conversation and its messages.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: run },
      ],
    );
  }

  async function exportConversation() {
    if (!document || messages.length === 0 || exporting) {
      return;
    }

    setExporting(true);
    setError(null);
    try {
      const exportedAt = new Date();
      const filename = chatTranscriptFilename(document.title, exportedAt);
      const transcript = buildChatTranscriptMarkdown({
        document,
        messages,
        chunks,
        exportedAt: exportedAt.toISOString(),
      });

      if (Platform.OS === "web") {
        downloadTextFile(filename, transcript);
        return;
      }

      const FileSystem = await import("expo-file-system/legacy");
      const baseDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDirectory) {
        throw new Error("Could not access a writable export directory.");
      }
      const uri = `${baseDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(uri, transcript, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Share.share({
        title: filename,
        message: transcript,
        url: uri,
      });
    } catch (nextError) {
      const message = getErrorMessage(nextError);
      setError(message);
      if (Platform.OS !== "web") {
        Alert.alert("Export failed", message);
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <Screen scroll={false} padded={false} style={styles.screenBody}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.padded}>
          <TopBar
            title="Ask AI"
            back
            right={
              <>
                <IconButton label="Conversation history" onPress={() => setSessionPickerOpen(true)}>
                  <History size={19} color={colors.text} />
                </IconButton>
                <IconButton label="New conversation" onPress={startNewSession}>
                  <Plus size={20} color={colors.text} />
                </IconButton>
                <IconButton
                  label="Export conversation"
                  onPress={exportConversation}
                  style={(messages.length === 0 || exporting) && styles.disabledExport}
                >
                  <Download size={20} color={colors.text} />
                </IconButton>
              </>
            }
          />
          {document ? (
            <>
              <Card style={styles.docCard}>
                <DocumentBadge ext={document.ext} />
                <View style={styles.docText}>
                  <Text style={styles.docTitle} numberOfLines={1}>
                    {document.title}
                  </Text>
                  <Text style={styles.docMeta}>Grounded in extracted document chunks</Text>
                </View>
              </Card>
              <Card style={styles.sessionCard}>
                <View style={styles.sessionCopy}>
                  <Text style={styles.sessionLabel}>Conversation</Text>
                  <Text style={styles.sessionTitle} numberOfLines={1}>
                    {session?.title ?? "New conversation"}
                  </Text>
                </View>
              </Card>
            </>
          ) : null}
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messageContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 && !busy && !activePartial ? (
            <View style={styles.suggestionWrap}>
              {[
                "Summarize the key decisions.",
                "What are the risks or open questions?",
                "List action items with owners if available.",
              ].map((suggestion) => (
                <Text key={suggestion} style={styles.suggestion} onPress={() => setInput(suggestion)}>
                  {suggestion}
                </Text>
              ))}
            </View>
          ) : null}
          {messages.map((message) => (
            <Bubble key={message.id} message={message} chunks={chunks} />
          ))}
          {activePartial ? (
            <View style={[styles.bubble, styles.aiBubble]}>
              <MarkdownContent text={activePartial} compact renderChunkCitations />
            </View>
          ) : null}
          {busy && !activePartial ? <TypingBubble /> : null}
          {activeError ? <Text style={styles.error}>{activeError}</Text> : null}
        </ScrollView>

        <View
          style={[
            styles.inputWrap,
            { paddingBottom: Math.max(insets.bottom + spacing.sm, layout.screenMargin) },
          ]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about this document"
            placeholderTextColor={colors.textSubtle}
            multiline
            style={styles.input}
          />
          <IconButton
            label="Send"
            onPress={submit}
            style={[styles.sendButton, busy && styles.sendButtonDisabled]}
          >
            <Send size={20} color="#FFFFFF" />
          </IconButton>
        </View>
        <SessionPicker
          visible={sessionPickerOpen}
          sessions={sessions}
          selectedSessionId={session?.id}
          activeSessionIds={Object.keys(activeChats).filter(
            (activeSessionId) => activeChats[activeSessionId]?.status === "pending",
          )}
          onClose={() => setSessionPickerOpen(false)}
          onNew={startNewSession}
          onSelect={selectSession}
          onDelete={deleteSession}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Bubble({ message, chunks }: { message: ChatMessage; chunks: DocumentChunk[] }) {
  const user = message.role === "user";
  const citedChunks = user ? [] : resolveCitedChunks(message.sourceChunkIds, chunks);
  return (
    <View style={[styles.bubble, user ? styles.userBubble : styles.aiBubble]}>
      {user ? (
        <Text style={styles.userText}>{message.content}</Text>
      ) : (
        <>
          <MarkdownContent text={message.content} compact renderChunkCitations />
          {citedChunks.length > 0 ? <SourceSuperscripts chunks={citedChunks} /> : null}
        </>
      )}
    </View>
  );
}

function SessionPicker({
  visible,
  sessions,
  selectedSessionId,
  activeSessionIds,
  onClose,
  onNew,
  onSelect,
  onDelete,
}: {
  visible: boolean;
  sessions: ChatSession[];
  selectedSessionId?: string;
  activeSessionIds: string[];
  onClose: () => void;
  onNew: () => void;
  onSelect: (session: ChatSession) => void;
  onDelete: (session: ChatSession) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close conversation history"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View style={styles.sessionPanel}>
          <View style={styles.sessionPanelHeader}>
            <Text style={styles.sessionPanelTitle}>Conversation History</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onNew}
              style={({ pressed }) => [styles.newSessionButton, pressed && styles.pressed]}
            >
              <Plus size={17} color="#FFFFFF" />
              <Text style={styles.newSessionText}>New</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.sessionList} contentContainerStyle={styles.sessionListContent}>
            {sessions.map((item) => {
              const active = item.id === selectedSessionId;
              const generating = activeSessionIds.includes(item.id);
              return (
                <View
                  key={item.id}
                  style={[
                    styles.sessionRow,
                    active && styles.activeSessionRow,
                  ]}
                >
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onSelect(item)}
                    style={({ pressed }) => [styles.sessionRowMain, pressed && styles.pressed]}
                  >
                    <Text style={[styles.sessionRowTitle, active && styles.activeSessionRowTitle]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.sessionRowMeta} numberOfLines={1}>
                      {generating ? "Generating an answer" : `Updated ${formatShortDate(item.updatedAt)}`}
                    </Text>
                  </Pressable>
                  <IconButton
                    label={`Delete ${item.title}`}
                    onPress={generating ? undefined : () => onDelete(item)}
                    style={[styles.sessionDeleteButton, generating && styles.disabledExport]}
                  >
                    <Trash2 size={18} color={colors.danger} />
                  </IconButton>
                </View>
              );
            })}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.closeSessionButton, pressed && styles.pressed]}
          >
            <Text style={styles.closeSessionText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function SourceSuperscripts({ chunks }: { chunks: DocumentChunk[] }) {
  return (
    <View
      style={styles.sourceRow}
      accessibilityLabel={`Sources: ${chunks
        .map((chunk) => `chunk ${chunk.chunkIndex + 1}`)
        .join(", ")}`}
    >
      <Text style={styles.sourceLabel}>Sources</Text>
      {chunks.map((chunk) => (
        <Text key={chunk.id} style={styles.sourceSuperscript}>
          {toSuperscriptNumber(chunk.chunkIndex + 1)}
        </Text>
      ))}
    </View>
  );
}

function resolveCitedChunks(sourceChunkIds: string[] | null | undefined, chunks: DocumentChunk[]) {
  if (!sourceChunkIds?.length) {
    return [];
  }
  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const seen = new Set<string>();
  return sourceChunkIds.flatMap((id) => {
    if (seen.has(id)) {
      return [];
    }
    seen.add(id);
    const chunk = byId.get(id);
    return chunk ? [chunk] : [];
  });
}

function TypingBubble() {
  const dots = useRef([
    new Animated.Value(0.35),
    new Animated.Value(0.35),
    new Animated.Value(0.35),
  ]).current;

  useEffect(() => {
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 120),
          Animated.timing(dot, {
            toValue: 1,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.35,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.delay(220),
        ]),
      ),
    );

    animations.forEach((animation) => animation.start());
    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [dots]);

  return (
    <View style={[styles.bubble, styles.aiBubble, styles.typingBubble]}>
      {dots.map((dot, index) => (
        <Animated.View
          key={index}
          style={[
            styles.typingDot,
            {
              opacity: dot,
              transform: [
                {
                  translateY: dot.interpolate({
                    inputRange: [0.35, 1],
                    outputRange: [0, -4],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = globalThis.URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  globalThis.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  globalThis.URL.revokeObjectURL(url);
}

function showEmptySessionNotice() {
  const message = "Send a message in this conversation before starting another one.";
  if (Platform.OS === "web") {
    window.alert(message);
    return;
  }
  Alert.alert("New conversation already open", message);
}

const styles = StyleSheet.create({
  screenBody: {
    flex: 1,
    minHeight: 0,
  },
  container: {
    flex: 1,
    minHeight: 0,
    maxWidth: Platform.OS === "web" ? layout.screenMaxWidth : undefined,
    width: "100%",
    alignSelf: "center",
  },
  padded: {
    paddingHorizontal: layout.screenMargin,
  },
  docCard: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  disabledExport: {
    opacity: 0.38,
  },
  sessionCard: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  sessionCopy: {
    flex: 1,
    minWidth: 0,
  },
  sessionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  sessionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  docText: {
    flex: 1,
    minWidth: 0,
  },
  docTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  docMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  messages: {
    flex: 1,
    minHeight: 0,
  },
  messageContent: {
    flexGrow: 1,
    padding: layout.screenMargin,
    gap: spacing.md,
  },
  bubble: {
    maxWidth: "82%",
    minWidth: 0,
    flexShrink: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    overflow: "hidden",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.surfaceMuted,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  userText: {
    color: colors.text,
    lineHeight: 21,
    maxWidth: "100%",
    flexShrink: 1,
  },
  aiText: {
    color: colors.text,
    lineHeight: 21,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sourceLabel: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
    marginRight: 2,
  },
  sourceSuperscript: {
    color: colors.primary,
    fontSize: 11,
    lineHeight: 12,
    fontWeight: "800",
  },
  suggestionWrap: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  suggestion: {
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: radius.md,
    overflow: "hidden",
    fontWeight: "700",
  },
  error: {
    color: colors.danger,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.64,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: layout.screenMargin,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 112,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 16,
  },
  sendButton: {
    width: 42,
    height: 42,
    backgroundColor: colors.primary,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  typingBubble: {
    minWidth: 74,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(33, 31, 27, 0.38)",
    justifyContent: "flex-end",
  },
  sessionPanel: {
    maxHeight: "72%",
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  sessionPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  sessionPanelTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  newSessionButton: {
    minHeight: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  newSessionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  sessionList: {
    maxHeight: 360,
  },
  sessionListContent: {
    gap: spacing.sm,
  },
  sessionRow: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  activeSessionRow: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  sessionRowMain: {
    flex: 1,
    minWidth: 0,
    padding: spacing.md,
  },
  sessionRowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  activeSessionRowTitle: {
    color: colors.primaryDark,
  },
  sessionRowMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 3,
  },
  sessionDeleteButton: {
    marginRight: spacing.sm,
  },
  closeSessionButton: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  closeSessionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
});
