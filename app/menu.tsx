import { router } from "expo-router";
import { Bot, FileText, HelpCircle, Plus, Settings, Trash2 } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { IconButton, Screen, TopBar } from "@/components/ui";
import { colors, layout, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";

export default function MenuScreen() {
  const { documents } = useApp();
  const readyCount = documents.filter((document) => document.status === "ready").length;

  return (
    <Screen>
      <TopBar title="Menu" back />
      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Bot size={22} color="#FFFFFF" />
        </View>
        <View>
          <Text style={styles.profileName}>Document AI</Text>
          <Text style={styles.profilePlan}>Local workspace</Text>
        </View>
      </View>

      <View style={styles.menuList}>
        <MenuItem icon={<FileText size={22} color={colors.primaryDark} />} label="Documents" onPress={() => router.replace("/")} active />
        <MenuItem icon={<Bot size={22} color={colors.primaryDark} />} label="AI Conversations" onPress={() => router.replace("/search")} />
        <MenuItem icon={<Plus size={22} color={colors.primaryDark} />} label="Import Document" onPress={() => router.replace("/import")} />
        <MenuItem icon={<Settings size={22} color={colors.primaryDark} />} label="Settings" onPress={() => router.replace("/settings")} />
      </View>

      <View style={styles.menuList}>
        <MenuItem icon={<HelpCircle size={22} color={colors.textMuted} />} label="Help" onPress={() => undefined} />
        <MenuItem icon={<Trash2 size={22} color={colors.textMuted} />} label="Trash" onPress={() => undefined} />
      </View>

      <View style={styles.storage}>
        <Text style={styles.storageLine}>Ready documents</Text>
        <Text style={styles.storageAmount}>
          {readyCount}/{documents.length}
        </Text>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${documents.length ? (readyCount / documents.length) * 100 : 0}%` },
            ]}
          />
        </View>
      </View>

      <View style={styles.fabWrap}>
        <IconButton label="Import document" onPress={() => router.replace("/import")} style={styles.fab}>
          <Plus size={28} color="#FFFFFF" />
        </IconButton>
      </View>
    </Screen>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.menuItem, active && styles.activeMenuItem]}
    >
      <View style={styles.menuIcon}>{icon}</View>
      <Text style={[styles.menuLabel, active && styles.activeMenuLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  profilePlan: {
    color: colors.textMuted,
    marginTop: 2,
  },
  menuList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
  },
  menuItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  activeMenuItem: {
    backgroundColor: colors.primarySoft,
  },
  menuLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  activeMenuLabel: {
    color: colors.primary,
  },
  menuIcon: {
    width: 28,
  },
  storage: {
    marginTop: "auto",
    paddingBottom: spacing.xl,
  },
  storageLine: {
    color: colors.textMuted,
    fontWeight: "800",
  },
  storageAmount: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginTop: spacing.xs,
  },
  track: {
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  fill: {
    height: "100%",
    backgroundColor: colors.primary,
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
  },
});
