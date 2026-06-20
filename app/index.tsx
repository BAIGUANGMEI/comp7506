import { router } from "expo-router";
import { Folder, Plus } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Button,
  Card,
  DocumentRow,
  EmptyState,
  IconButton,
  Screen,
  SectionTitle,
  TopBar,
} from "@/components/ui";
import { colors, layout, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";

export default function DocumentLibraryScreen() {
  const { documents, apiKey } = useApp();

  return (
    <Screen>
      <TopBar title="Document Library" menu search settings />

      {!apiKey ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/settings")}
          style={styles.configBanner}
        >
          <Text style={styles.configTitle}>Connect your AI API</Text>
          <Text style={styles.configBody}>
            Add an API key and keep Kimi k2.6 as the default model, or point the app
            at another OpenAI-compatible endpoint.
          </Text>
        </Pressable>
      ) : null}

      <SectionTitle>Recent Documents</SectionTitle>
      <Card>
        {documents.length > 0 ? (
          documents
            .slice(0, 6)
            .map((document) => (
              <DocumentRow
                key={document.id}
                document={document}
                onPress={() => router.push(`/document/${document.id}`)}
              />
            ))
        ) : (
          <EmptyState
            title="No documents yet"
            body="Import a TXT, Markdown, PDF, DOC, or DOCX file to generate a summary and ask questions."
            action={<Button onPress={() => router.push("/import")}>Import Document</Button>}
          />
        )}
      </Card>

      <SectionTitle>Folders</SectionTitle>
      <Card>
        <FolderRow title="Product Docs" subtitle={`${documents.length} documents`} />
        <FolderRow title="Research Notes" subtitle="Saved summaries and chats" />
        <FolderRow title="Archive" subtitle="Completed reading sessions" last />
      </Card>

      <View style={styles.fabWrap}>
        <IconButton
          label="Import document"
          onPress={() => router.push("/import")}
          style={styles.fab}
        >
          <Plus size={28} color="#FFFFFF" />
        </IconButton>
      </View>
    </Screen>
  );
}

function FolderRow({
  title,
  subtitle,
  last,
}: {
  title: string;
  subtitle: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.folderRow, last && styles.lastRow]}>
      <View style={styles.folderIcon}>
        <Folder size={20} color={colors.folder} />
      </View>
      <View>
        <Text style={styles.folderTitle}>{title}</Text>
        <Text style={styles.folderSub}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  configBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  configTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  configBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  folderRow: {
    minHeight: 68,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  folderIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.folderSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  folderTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  folderSub: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 3,
  },
  fabWrap: {
    position: "absolute",
    right: layout.screenMargin,
    bottom: 28,
  },
  fab: {
    width: 58,
    height: 58,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
});
