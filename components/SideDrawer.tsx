import { router, usePathname } from "expo-router";
import {
  Bot,
  FileText,
  HelpCircle,
  Plus,
  Settings,
  Trash2,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DimensionValue } from "react-native";
import { MAX_IMPORT_BYTES } from "@/config/defaults";
import { colors, layout, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";
import { authProviderLabel } from "@/lib/auth/account";

export function SideDrawer() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { authAccount, drawerOpen, closeDrawer, documents, profile } = useApp();
  const progress = useRef(new Animated.Value(0)).current;
  const totalBytes = useMemo(
    () => documents.reduce((sum, document) => sum + (document.fileSizeBytes ?? 0), 0),
    [documents],
  );
  const drawerWidth = Math.min(360, Math.max(320, width * 0.9));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: drawerOpen ? 1 : 0,
      duration: drawerOpen ? 240 : 180,
      useNativeDriver: true,
    }).start();
  }, [drawerOpen, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth, 0],
  });

  const scrimOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.42],
  });

  const storageWidth = useMemo<DimensionValue>(() => {
    if (documents.length === 0) {
      return "0%";
    }
    const storageBasis = documents.length * MAX_IMPORT_BYTES;
    return `${Math.min(100, Math.round((totalBytes / storageBasis) * 100))}%`;
  }, [documents.length, totalBytes]);

  function navigateTo(path: "/" | "/conversations" | "/search" | "/import" | "/settings" | "/trash" | "/help") {
    closeDrawer();
    if (pathname === path) {
      return;
    }
    router.replace(path);
  }

  return (
    <View
      pointerEvents={drawerOpen ? "auto" : "none"}
      style={StyleSheet.absoluteFill}
    >
      <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={closeDrawer}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View style={[styles.drawer, { width: drawerWidth, transform: [{ translateX }] }]}>
        <View style={styles.safeArea}>
          <View
            style={[
              styles.drawerContent,
              {
                paddingTop: Math.max(insets.top + 22, 46),
                paddingBottom: Math.max(insets.bottom + spacing.md, 26),
              },
            ]}
          >
            <View style={styles.profile}>
              <View style={styles.avatar}>
                {profile.avatarDataUri ? (
                  <Image source={{ uri: profile.avatarDataUri }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitial}>{profile.displayName.trim()[0]?.toUpperCase() || "U"}</Text>
                )}
              </View>
              <View style={styles.profileCopy}>
                <Text style={styles.profileName} numberOfLines={1}>
                  Hello, {profile.displayName}
                </Text>
                <Text style={styles.profilePlan} numberOfLines={1}>
                  {authAccount ? `Signed in with ${authProviderLabel(authAccount.provider)}` : "Personal"}
                </Text>
              </View>
            </View>

            <View style={styles.primaryMenu}>
              <MenuItem
                icon={<FileText size={24} color={colors.text} />}
                label="Documents"
                onPress={() => navigateTo("/")}
                active={pathname === "/"}
              />
              <MenuItem
                icon={<Bot size={24} color={colors.text} />}
                label="AI Conversations"
                onPress={() => navigateTo("/conversations")}
                active={pathname === "/conversations"}
              />
              <MenuItem
                icon={<Plus size={25} color={colors.text} />}
                label="Import Document"
                onPress={() => navigateTo("/import")}
                active={pathname === "/import"}
              />
              <MenuItem
                icon={<Trash2 size={23} color={colors.text} />}
                label="Trash"
                onPress={() => navigateTo("/trash")}
                active={pathname === "/trash"}
              />
              <MenuItem
                icon={<Settings size={23} color={colors.text} />}
                label="Settings"
                onPress={() => navigateTo("/settings")}
                active={pathname === "/settings"}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.secondaryMenu}>
              <MenuItem
                icon={<HelpCircle size={23} color={colors.text} />}
                label="Help"
                onPress={() => navigateTo("/help")}
                active={pathname === "/help"}
              />
            </View>

            <View style={styles.storage}>
              <View style={styles.storageHeader}>
                <Text style={styles.storageLine}>Storage</Text>
                <Text style={styles.storageAmount}>{formatBytes(totalBytes)}</Text>
              </View>
              <Text style={styles.storageMeta}>
                {documents.length} {documents.length === 1 ? "document" : "documents"}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: storageWidth }]} />
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function formatBytes(bytes: number) {
  if (bytes <= 0) {
    return "0 KB";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
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
      style={({ pressed }) => [styles.menuItem, active && styles.activeMenuItem, pressed && styles.pressed]}
    >
      <View style={styles.menuIcon}>{icon}</View>
      <Text style={[styles.menuLabel, active && styles.activeMenuLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#8B8882",
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#FFFDF9",
  },
  safeArea: {
    flex: 1,
  },
  drawerContent: {
    flex: 1,
    paddingHorizontal: layout.screenMargin + spacing.lg,
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: "#BDB6AD",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitial: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "600",
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "500",
  },
  profilePlan: {
    color: colors.textMuted,
    fontSize: 17,
    marginTop: 7,
  },
  primaryMenu: {
    marginTop: 34,
    gap: spacing.sm,
  },
  secondaryMenu: {
    gap: spacing.sm,
  },
  menuItem: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg + 8,
  },
  activeMenuItem: {
    backgroundColor: "#F0EFEC",
  },
  pressed: {
    opacity: 0.65,
  },
  menuLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 20,
    fontWeight: "500",
  },
  activeMenuLabel: {
    color: colors.text,
  },
  menuIcon: {
    width: 30,
    alignItems: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: 28,
    marginBottom: 28,
  },
  storage: {
    marginTop: "auto",
    paddingBottom: spacing.md,
  },
  storageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  storageLine: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "500",
  },
  storageAmount: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "600",
  },
  storageMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  track: {
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: "#E4E1DC",
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  fill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
});
