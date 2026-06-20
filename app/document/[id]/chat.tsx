import { useLocalSearchParams } from "expo-router";
import { Send } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Card, DocumentBadge, IconButton, Screen, TopBar } from "@/components/ui";
import { colors, layout, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";
import type { ChatMessage, DocumentRecord } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils/errors";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { activeChats, getDocumentById, getMessages, sendQuestion } = useApp();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const mountedRef = useRef(true);
  const hadActiveChatRef = useRef(false);
  const activeChat = id ? activeChats[id] : undefined;
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
    const nextDocument = await getDocumentById(id);
    const nextMessages = await getMessages(id);
    if (!mountedRef.current) {
      return;
    }
    setDocument(nextDocument);
    setMessages(nextMessages);
  }, [getDocumentById, getMessages, id]);

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
    if (!id || !input.trim() || busy) {
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
        role: "user",
        content: question,
        createdAt: new Date().toISOString(),
      },
    ]);
    sendQuestion(id, question)
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

  return (
    <Screen scroll={false} padded={false} style={styles.screenBody}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.padded}>
          <TopBar title="Ask AI" back />
          {document ? (
            <Card style={styles.docCard}>
              <DocumentBadge ext={document.ext} />
              <View style={styles.docText}>
                <Text style={styles.docTitle} numberOfLines={1}>
                  {document.title}
                </Text>
                <Text style={styles.docMeta}>Grounded in extracted document chunks</Text>
              </View>
            </Card>
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
            <Bubble key={message.id} message={message} />
          ))}
          {activePartial ? (
            <View style={[styles.bubble, styles.aiBubble]}>
              <MarkdownContent text={activePartial} compact />
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
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const user = message.role === "user";
  return (
    <View style={[styles.bubble, user ? styles.userBubble : styles.aiBubble]}>
      {user ? (
        <Text style={styles.userText}>{message.content}</Text>
      ) : (
        <MarkdownContent text={message.content} compact />
      )}
    </View>
  );
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
    borderRadius: radius.md,
    padding: spacing.md,
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
  },
  aiText: {
    color: colors.text,
    lineHeight: 21,
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
});
