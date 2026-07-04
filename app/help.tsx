import { FileText, HelpCircle } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { Card, DocumentBadge, Screen, SectionTitle, TopBar } from "@/components/ui";
import { colors, radius, spacing } from "@/config/theme";

export default function HelpScreen() {
  return (
    <Screen>
      <TopBar title="Help" menu />

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <HelpCircle size={25} color={colors.text} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>Help</Text>
          <Text style={styles.meta}>Import support, AI analysis flow, and local document behavior.</Text>
        </View>
      </View>

      <SectionTitle>Supported Formats</SectionTitle>
      <View style={styles.formatGrid}>
        {[
          { ext: "pdf", label: "PDF" },
          { ext: "md", label: "Markdown" },
          { ext: "docx", label: "Word" },
          { ext: "txt", label: "TXT" },
        ].map((format) => (
          <View key={format.ext} style={styles.formatItem}>
            <DocumentBadge ext={format.ext} />
            <Text style={styles.formatLabel}>{format.label}</Text>
          </View>
        ))}
      </View>

      <SectionTitle>Import Pipeline</SectionTitle>
      <Card>
        <PipelineRow
          title="1. Choose import mode"
          body="Enable AI analysis for extraction, summary, visual notes, and document Q&A, or import locally when you only need to store and read the file."
        />
        <PipelineRow
          title="2. Upload or save"
          body="With AI analysis enabled, supported files are sent to your configured AI API. Local imports keep metadata and readable local text on this device."
        />
        <PipelineRow
          title="3. Read and ask"
          body="The app stores extracted chunks, summaries, visual notes, and chat history locally for later reading and document-grounded questions."
          last
        />
      </Card>
    </Screen>
  );
}

function PipelineRow({ title, body, last }: { title: string; body: string; last?: boolean }) {
  return (
    <View style={[styles.pipelineRow, last && styles.lastPipelineRow]}>
      <View style={styles.pipelineIcon}>
        <FileText size={18} color={colors.textMuted} />
      </View>
      <View style={styles.pipelineBody}>
        <Text style={styles.pipelineTitle}>{title}</Text>
        <Text style={styles.pipelineText}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "500",
  },
  meta: {
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  formatGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  formatItem: {
    width: "23%",
    minHeight: 82,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  formatLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "700",
  },
  pipelineRow: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  lastPipelineRow: {
    borderBottomWidth: 0,
  },
  pipelineIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  pipelineBody: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.md,
  },
  pipelineTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  pipelineText: {
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: 2,
  },
});
