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
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { DimensionValue } from "react-native";
import { colors, layout, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";

export function SideDrawer() {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { drawerOpen, closeDrawer, documents } = useApp();
  const progress = useRef(new Animated.Value(0)).current;
  const readyCount = documents.filter((document) => document.status === "ready").length;
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
    return `${Math.round((readyCount / documents.length) * 100)}%`;
  }, [documents.length, readyCount]);

  function navigateTo(path: "/" | "/search" | "/import" | "/settings") {
    closeDrawer();
    if (pathname === path) {
      return;
    }
    if (path === "/") {
      router.replace(path);
      return;
    }
    router.push(path);
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
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.drawerContent}>
            <View style={styles.profile}>
              <View style={styles.avatar} />
              <View style={styles.profileCopy}>
                <Text style={styles.profileName}>Hello, User</Text>
                <Text style={styles.profilePlan}>Personal</Text>
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
                onPress={() => navigateTo("/search")}
                active={pathname === "/search"}
              />
              <MenuItem
                icon={<Plus size={25} color={colors.text} />}
                label="Import Document"
                onPress={() => navigateTo("/import")}
                active={pathname === "/import"}
              />
              <MenuItem
                icon={<Settings size={23} color={colors.text} />}
                label="Settings"
                onPress={() => navigateTo("/settings")}
                active={pathname === "/settings"}
              />
              <MenuItem
                icon={<Trash2 size={23} color={colors.textSubtle} />}
                label="Trash"
                onPress={closeDrawer}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.secondaryMenu}>
              <MenuItem
                icon={<HelpCircle size={23} color={colors.text} />}
                label="Help"
                onPress={closeDrawer}
              />
            </View>

            <View style={styles.storage}>
              <View style={styles.storageHeader}>
                <Text style={styles.storageLine}>Storage</Text>
                <Text style={styles.storageAmount}>{readyCount}/{documents.length || 0} docs</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: storageWidth }]} />
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
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
    paddingTop: 72,
    paddingBottom: 26,
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
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  profilePlan: {
    color: colors.textMuted,
    fontSize: 17,
    marginTop: 7,
  },
  primaryMenu: {
    marginTop: 46,
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
