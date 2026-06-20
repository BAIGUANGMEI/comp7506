import React, { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  GestureResponderEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Menu, Search, Settings } from "lucide-react-native";
import { router } from "expo-router";
import { colors, layout, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";
import type { DocumentRecord, DocumentStatus } from "@/lib/types";

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function Screen({ children, scroll = true, padded = true, style }: ScreenProps) {
  const childArray = React.Children.toArray(children);
  const fixedChildren = childArray.filter(isTopBarElement);
  const contentChildren = childArray.filter((child) => !isTopBarElement(child));
  const content = (
    <View style={[styles.screenInner, padded && styles.screenPadding, style]}>
      {contentChildren}
    </View>
  );

  return (
    <View style={styles.screen}>
      {fixedChildren.length > 0 ? (
        <View style={[styles.fixedHeaderInner, padded && styles.screenHeaderPadding]}>
          {fixedChildren}
        </View>
      ) : null}
      {scroll ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </View>
  );
}

function isTopBarElement(child: React.ReactNode) {
  return React.isValidElement(child) && Boolean((child.type as { isAppTopBar?: boolean }).isAppTopBar);
}

type TopBarProps = {
  title?: string;
  back?: boolean;
  menu?: boolean;
  search?: boolean;
  settings?: boolean;
  right?: React.ReactNode;
};

type TopBarComponent = ((props: TopBarProps) => React.ReactElement) & {
  isAppTopBar?: boolean;
};

export const TopBar: TopBarComponent = function TopBar({
  title,
  back,
  menu,
  search,
  settings,
  right,
}: TopBarProps) {
  const { openDrawer } = useApp();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, 32);

  return (
    <View style={[styles.topBar, { height: topPadding + 50, paddingTop: topPadding }]}>
      <View style={styles.topBarSide}>
        {back ? (
          <IconButton label="Back" onPress={goBackOrHome}>
            <ArrowLeft size={22} color={colors.text} />
          </IconButton>
        ) : menu ? (
          <IconButton label="Menu" onPress={openDrawer}>
            <Menu size={22} color={colors.text} />
          </IconButton>
        ) : null}
      </View>
      <Text style={styles.topBarTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.topBarSide, styles.topBarRight]}>
        {search ? (
          <IconButton label="Search" onPress={() => router.push("/search")}>
            <Search size={21} color={colors.text} />
          </IconButton>
        ) : null}
        {settings ? (
          <IconButton
            label="Settings"
            onPress={() => router.push({ pathname: "/settings", params: { entry: "stack" } })}
          >
            <Settings size={21} color={colors.text} />
          </IconButton>
        ) : null}
        {right}
      </View>
    </View>
  );
};

TopBar.isAppTopBar = true;

export function goBackOrHome() {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace("/");
}

type IconButtonProps = PropsWithChildren<{
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
}>;

export function IconButton({ children, label, onPress, style }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

type ButtonProps = PropsWithChildren<{
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}>;

export function Button({
  children,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  style,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        (pressed || loading) && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={variant === "primary" ? "#FFFFFF" : colors.primary} /> : null}
      {!loading && icon ? <View style={styles.buttonIcon}>{icon}</View> : null}
      <Text style={[styles.buttonText, styles[`buttonText_${variant}`] as StyleProp<TextStyle>]}>
        {children}
      </Text>
    </Pressable>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function DocumentBadge({ ext }: { ext: string }) {
  const upper = ext.toUpperCase();
  const palette =
    ext === "pdf"
      ? { background: colors.pdf, text: colors.pdfText }
      : ext === "md"
        ? { background: colors.md, text: colors.mdText }
        : ext === "doc" || ext === "docx"
          ? { background: colors.doc, text: colors.docText }
          : { background: colors.txt, text: colors.txtText };
  return (
    <View style={[styles.documentBadge, { backgroundColor: palette.background }]}>
      <Text style={[styles.documentBadgeText, { color: palette.text }]}>
        {upper === "DOCX" ? "W" : upper}
      </Text>
    </View>
  );
}

export function StatusPill({ status }: { status: DocumentStatus }) {
  const color =
    status === "ready"
      ? colors.success
      : status === "failed"
        ? colors.danger
        : status === "queued" || status === "local"
          ? colors.textMuted
          : colors.warning;
  return (
    <View style={[styles.pill, { borderColor: `${color}44`, backgroundColor: `${color}12` }]}>
      <Text style={[styles.pillText, { color }]}>{statusLabel(status)}</Text>
    </View>
  );
}

export function DocumentRow({
  document,
  onPress,
}: {
  document: DocumentRecord;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.documentRow, pressed && styles.pressed]}
    >
      <DocumentBadge ext={document.ext} />
      <View style={styles.documentRowBody}>
        <Text style={styles.documentTitle} numberOfLines={1}>
          {document.title}
        </Text>
        <Text style={styles.documentMeta} numberOfLines={1}>
          {document.ext.toUpperCase()} · {statusLabel(document.status)}
        </Text>
      </View>
      <StatusPill status={document.status} />
    </Pressable>
  );
}

export function statusLabel(status: DocumentStatus) {
  switch (status) {
    case "local":
      return "Local";
    case "queued":
      return "Queued";
    case "uploading":
      return "Uploading";
    case "extracting":
      return "Extracting";
    case "summarizing":
      return "Summarizing";
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
  }
}

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  fixedHeaderInner: {
    width: "100%",
    maxWidth: Platform.OS === "web" ? layout.screenMaxWidth : undefined,
    alignSelf: "center",
    zIndex: 10,
    backgroundColor: colors.background,
  },
  screenHeaderPadding: {
    paddingHorizontal: layout.screenMargin,
  },
  screenInner: {
    width: "100%",
    maxWidth: Platform.OS === "web" ? layout.screenMaxWidth : undefined,
    alignSelf: "center",
    minHeight: "100%",
  },
  screenPadding: {
    paddingHorizontal: layout.screenMargin,
    paddingBottom: 34,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarSide: {
    width: 92,
    flexDirection: "row",
    alignItems: "center",
  },
  topBarRight: {
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  topBarTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "500",
    color: colors.text,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.62,
  },
  button: {
    minHeight: 54,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  button_primary: {
    backgroundColor: colors.primary,
  },
  button_secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button_ghost: {
    backgroundColor: "transparent",
  },
  button_danger: {
    backgroundColor: "#FEE2E2",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  buttonText_primary: {
    color: "#FFFFFF",
  },
  buttonText_secondary: {
    color: colors.text,
  },
  buttonText_ghost: {
    color: colors.text,
  },
  buttonText_danger: {
    color: colors.danger,
  },
  buttonIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.5,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
    marginTop: spacing.xl,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    minHeight: 260,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  emptyAction: {
    marginTop: spacing.xl,
    width: "100%",
  },
  documentBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  documentBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  pill: {
    minHeight: 24,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  documentRow: {
    minHeight: 67,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  documentRowBody: {
    flex: 1,
    minWidth: 0,
  },
  documentTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  documentMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 3,
  },
});
