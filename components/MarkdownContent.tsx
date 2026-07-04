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
  renderChunkCitations?: boolean;
};

export function MarkdownContent({ text, compact, renderChunkCitations }: MarkdownContentProps) {
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
              {renderInlineText(block.text, renderChunkCitations)}
            </Text>
          );
        }
        if (block.type === "list") {
          return (
            <View key={`${block.type}-${index}`} style={styles.listRow}>
              <Text style={[styles.bullet, compact && styles.compactText]}>•</Text>
              <Text style={[styles.text, compact && styles.compactText]}>
                {renderInlineText(block.text, renderChunkCitations)}
              </Text>
            </View>
          );
        }
        if (block.type === "quote") {
          return (
            <View key={`${block.type}-${index}`} style={styles.quote}>
              <Text style={[styles.quoteText, compact && styles.compactText]}>
                {renderInlineText(block.text, renderChunkCitations)}
              </Text>
            </View>
          );
        }
        if (block.type === "code") {
          return (
            <Text key={`${block.type}-${index}`} style={[styles.codeBlock, compact && styles.compactCode]}>
              {breakLongTokens(block.text, 38)}
            </Text>
          );
        }
        if (block.type === "rule") {
          return <View key={`${block.type}-${index}`} style={styles.rule} />;
        }
        return (
          <Text key={`${block.type}-${index}`} style={[styles.text, compact && styles.compactText]}>
            {renderInlineText(block.text, renderChunkCitations)}
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

function breakLongTokens(text: string, size = 44) {
  return text
    .split(/(\s+)/)
    .map((part) => {
      if (/\s/.test(part) || part.length <= size) {
        return part;
      }
      return part.match(new RegExp(`.{1,${size}}`, "g"))?.join("\n") ?? part;
    })
    .join("");
}

function renderInlineText(text: string, renderChunkCitations?: boolean) {
  const clean = stripInlineMarkdown(text);
  if (!renderChunkCitations) {
    return breakLongTokens(clean);
  }

  const parts = clean.split(/(\[\s*(?:chunk\s*)?\d{1,3}\s*\]|\(\s*chunk\s+\d{1,3}\s*\))/gi);
  return parts.map((part, index) => {
    const citation = /^\[\s*(?:chunk\s*)?(\d{1,3})\s*\]$/i.exec(part)
      ?? /^\(\s*chunk\s+(\d{1,3})\s*\)$/i.exec(part);
    if (!citation?.[1]) {
      return breakLongTokens(part);
    }
    return (
      <Text key={`citation-${index}`} style={styles.inlineCitation}>
        {toSuperscriptNumber(Number(citation[1]))}
      </Text>
    );
  });
}

export function toSuperscriptNumber(value: number) {
  const superscriptDigits: Record<string, string> = {
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
  };
  return String(value)
    .split("")
    .map((digit) => superscriptDigits[digit] ?? digit)
    .join("");
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    maxWidth: "100%",
    minWidth: 0,
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
    maxWidth: "100%",
    flexShrink: 1,
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
    maxWidth: "100%",
    flexShrink: 1,
  },
  compactText: {
    fontSize: 15,
    lineHeight: 23,
  },
  inlineCitation: {
    color: colors.primary,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },
  listRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    maxWidth: "100%",
    minWidth: 0,
  },
  bullet: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 26,
    width: 14,
    flexShrink: 0,
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
    maxWidth: "100%",
    minWidth: 0,
  },
  quoteText: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 25,
    maxWidth: "100%",
    flexShrink: 1,
  },
  codeBlock: {
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: spacing.md,
    lineHeight: 22,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    maxWidth: "100%",
    flexShrink: 1,
    overflow: "hidden",
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
