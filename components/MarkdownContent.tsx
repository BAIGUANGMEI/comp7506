import { Platform, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/config/theme";

type MarkdownBlock =
  | { type: "heading"; text: string; level: number }
  | { type: "paragraph"; text: string }
  | { type: "list"; text: string }
  | { type: "quote"; text: string }
  | { type: "code"; text: string }
  | { type: "rule"; text: string };

type MarkdownContentProps = {
  text: string;
  compact?: boolean;
};

export function MarkdownContent({ text, compact }: MarkdownContentProps) {
  const blocks = parseMarkdownBlocks(text);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <View style={[styles.content, compact && styles.compactContent]}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <Text
              key={`${block.type}-${index}`}
              style={[
                styles.heading,
                block.level === 1 && styles.heading1,
                block.level === 2 && styles.heading2,
                compact && styles.compactHeading,
              ]}
            >
              {stripInlineMarkdown(block.text)}
            </Text>
          );
        }
        if (block.type === "list") {
          return (
            <View key={`${block.type}-${index}`} style={styles.listRow}>
              <Text style={[styles.bullet, compact && styles.compactText]}>•</Text>
              <Text style={[styles.text, compact && styles.compactText]}>
                {stripInlineMarkdown(block.text)}
              </Text>
            </View>
          );
        }
        if (block.type === "quote") {
          return (
            <View key={`${block.type}-${index}`} style={styles.quote}>
              <Text style={[styles.quoteText, compact && styles.compactText]}>
                {stripInlineMarkdown(block.text)}
              </Text>
            </View>
          );
        }
        if (block.type === "code") {
          return (
            <Text key={`${block.type}-${index}`} style={[styles.codeBlock, compact && styles.compactCode]}>
              {block.text}
            </Text>
          );
        }
        if (block.type === "rule") {
          return <View key={`${block.type}-${index}`} style={styles.rule} />;
        }
        return (
          <Text key={`${block.type}-${index}`} style={[styles.text, compact && styles.compactText]}>
            {stripInlineMarkdown(block.text)}
          </Text>
        );
      })}
    </View>
  );
}

export function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let code: string[] = [];
  let inCode = false;

  function flushParagraph() {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCode) {
        blocks.push({ type: "code", text: code.join("\n") });
        code = [];
        inCode = false;
      } else {
        flushParagraph();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      continue;
    }

    if (/^([-*_])\1\1+$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ type: "rule", text: "" });
      continue;
    }

    const listMatch = /^[-*+]\s+(.+)$/.exec(trimmed) ?? /^\d+\.\s+(.+)$/.exec(trimmed);
    if (listMatch) {
      flushParagraph();
      blocks.push({ type: "list", text: listMatch[1] });
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph();
      blocks.push({ type: "quote", text: trimmed.replace(/^>\s?/, "") });
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  if (code.length > 0) {
    blocks.push({ type: "code", text: code.join("\n") });
  }

  return blocks;
}

export function stripInlineMarkdown(text: string) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1");
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
  compactContent: {
    gap: spacing.sm,
  },
  heading: {
    color: colors.text,
    fontSize: 19,
    lineHeight: 27,
    fontWeight: "800",
    marginTop: spacing.sm,
  },
  heading1: {
    fontSize: 26,
    lineHeight: 34,
  },
  heading2: {
    fontSize: 22,
    lineHeight: 30,
  },
  compactHeading: {
    fontSize: 16,
    lineHeight: 23,
    marginTop: 0,
  },
  text: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 26,
  },
  compactText: {
    fontSize: 15,
    lineHeight: 23,
  },
  listRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  bullet: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 26,
    width: 14,
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
  },
  quoteText: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 25,
  },
  codeBlock: {
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: spacing.md,
    lineHeight: 22,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  compactCode: {
    fontSize: 13,
    lineHeight: 19,
    padding: spacing.sm,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
});
