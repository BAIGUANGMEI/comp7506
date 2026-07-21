import * as AppleAuthentication from "expo-apple-authentication";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { Image, Platform, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useEffect, useState } from "react";
import { BadgeCheck, Image as ImageIcon, LogOut } from "lucide-react-native";
import { Button, Card, Screen, SectionTitle, TopBar } from "@/components/ui";
import { colors, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";
import { buildAppleDisplayName } from "@/lib/auth/account";
import { imageAssetToDataUri } from "@/lib/user/avatar";
import type { AuthAccount } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils/errors";

export default function SettingsScreen() {
  const { entry } = useLocalSearchParams<{ entry?: string }>();
  const stackEntry = entry === "stack";
  const {
    authAccount,
    config,
    profile,
    apiKey,
    saveAuthAccount,
    saveConfig,
    saveProfile,
    signOutAuth,
    testConnection,
  } = useApp();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatarDataUri, setAvatarDataUri] = useState(profile.avatarDataUri ?? null);
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [model, setModel] = useState(config.model);
  const [key, setKey] = useState(apiKey);
  const [deleteRemote, setDeleteRemote] = useState(config.deleteRemoteFilesAfterExtraction);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  async function pickAvatar() {
    setMessage(null);
    try {
      if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setMessage("Allow photo library access to update your avatar.");
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const dataUri = await imageAssetToDataUri({
        uri: asset.uri,
        name: asset.fileName ?? "avatar.jpg",
        size: asset.fileSize,
        mimeType: asset.mimeType ?? "image/jpeg",
        file: asset.file,
      });
      setAvatarDataUri(dataUri);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  function nextConfig() {
    return {
      ...config,
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      deleteRemoteFilesAfterExtraction: deleteRemote,
    };
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await saveConfig(nextConfig(), key.trim());
      await saveProfile({
        displayName,
        avatarDataUri,
      });
      setMessage("Settings saved.");
    } catch (error) {
      setMessage(getErrorMessage(error));
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function applySignedInAccount(account: AuthAccount) {
    await saveAuthAccount(account);
    const nextDisplayName = account.displayName?.trim() || displayName;
    setDisplayName(nextDisplayName);
    await saveProfile({
      displayName: nextDisplayName,
      avatarDataUri,
    });
  }

  async function signInWithApple() {
    if (!appleAvailable) {
      setMessage("Apple sign-in is available on supported iOS devices.");
      return;
    }

    setMessage(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const account: AuthAccount = {
        provider: "apple",
        subject: credential.user,
        email: credential.email ?? authAccount?.email ?? null,
        displayName: buildAppleDisplayName(credential.fullName) ?? authAccount?.displayName ?? null,
        signedInAt: new Date().toISOString(),
      };
      await applySignedInAccount(account);
      setMessage("Signed in with Apple.");
    } catch (error) {
      if (isCanceledAuth(error)) {
        return;
      }
      setMessage(getErrorMessage(error));
    }
  }

  async function disconnectAccount() {
    setMessage(null);
    try {
      await signOutAuth();
      setMessage("Signed out.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function runTest() {
    setTesting(true);
    setMessage(null);
    try {
      const configToTest = nextConfig();
      const keyToTest = key.trim();
      await saveConfig(configToTest, keyToTest);
      await testConnection({ config: configToTest, apiKey: keyToTest });
      setMessage("Connection test succeeded.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setTesting(false);
    }
  }

  return (
    <Screen>
      <TopBar title="Settings" back={stackEntry} menu={!stackEntry} />

      {Platform.OS === "web" ? (
        <View style={styles.webNotice}>
          <Text style={styles.webNoticeTitle}>Web debug storage</Text>
          <Text style={styles.webNoticeBody}>
            API keys are saved in browser local storage for the Web target. Use the
            native app for SecureStore-backed keychain storage.
          </Text>
        </View>
      ) : null}

      <SectionTitle>Profile</SectionTitle>
      <Card style={styles.profileCard}>
        <View style={styles.profileRow}>
          <AvatarPreview avatarDataUri={avatarDataUri} displayName={displayName} />
          <View style={styles.profileBody}>
            <Field
              label="Display Name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="User"
            />
            <View style={styles.avatarActions}>
              <Button
                variant="secondary"
                onPress={pickAvatar}
                style={styles.avatarButton}
                icon={<ImageIcon size={17} color={colors.text} />}
              >
                Avatar
              </Button>
              <Button
                variant="ghost"
                onPress={() => setAvatarDataUri(null)}
                disabled={!avatarDataUri}
                style={styles.avatarButton}
              >
                Remove
              </Button>
            </View>
          </View>
        </View>

        <View style={styles.accountHeader}>
          <View style={styles.accountIcon}>
            <BadgeCheck size={22} color={authAccount ? colors.success : colors.textMuted} />
          </View>
          <View style={styles.accountCopy}>
            <Text style={styles.accountTitle}>
              {authAccount ? "Signed in with Apple" : "Not signed in"}
            </Text>
            <Text style={styles.accountMeta} numberOfLines={1}>
              {authAccount?.email ?? authAccount?.displayName ?? "Use Apple to identify this workspace."}
            </Text>
          </View>
        </View>

        {authAccount ? (
          <Button
            variant="ghost"
            onPress={disconnectAccount}
            icon={<LogOut size={17} color={colors.text} />}
            style={styles.signOutButton}
          >
            Sign Out
          </Button>
        ) : (
          appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={8}
              onPress={signInWithApple}
              style={styles.appleButton}
            />
          ) : null
        )}
      </Card>

      <SectionTitle>AI Provider</SectionTitle>
      <Card style={styles.form}>
        <Field label="Base URL" value={baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" />
        <Field label="Model" value={model} onChangeText={setModel} autoCapitalize="none" />
        <Field
          label="API Key"
          value={key}
          onChangeText={setKey}
          autoCapitalize="none"
          secureTextEntry
          placeholder="sk-..."
        />
      </Card>

      <SectionTitle>Behavior</SectionTitle>
      <Card>
        <Toggle
          label="Delete remote files after extraction"
          body="Keeps provider storage cleaner after the app has saved extracted text."
          value={deleteRemote}
          onValueChange={setDeleteRemote}
          last
        />
      </Card>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.actions}>
        <Button onPress={save} loading={saving}>
          Save Settings
        </Button>
        <Button variant="secondary" onPress={runTest} loading={testing}>
          Test Connection
        </Button>
      </View>
    </Screen>
  );
}

function AvatarPreview({
  avatarDataUri,
  displayName,
}: {
  avatarDataUri?: string | null;
  displayName: string;
}) {
  const initial = (displayName.trim()[0] || "U").toUpperCase();

  return (
    <View style={styles.avatarPreview}>
      {avatarDataUri ? (
        <Image source={{ uri: avatarDataUri }} style={styles.avatarImage} />
      ) : (
        <Text style={styles.avatarInitial}>{initial}</Text>
      )}
    </View>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & {
  label: string;
};

function Field({ label, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.textSubtle}
        style={styles.fieldInput}
      />
    </View>
  );
}

function Toggle({
  label,
  body,
  value,
  onValueChange,
  last,
}: {
  label: string;
  body: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.toggle, last && styles.lastToggle]}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleBody}>{body}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.surfaceMuted, true: colors.primarySoft }}
        thumbColor={value ? colors.primary : "#FFFFFF"}
      />
    </View>
  );
}

function isCanceledAuth(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ERR_REQUEST_CANCELED"
  );
}

const styles = StyleSheet.create({
  webNotice: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  webNoticeTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 16,
  },
  webNoticeBody: {
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  form: {
    paddingVertical: spacing.sm,
  },
  accountHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  accountIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  accountCopy: {
    flex: 1,
    minWidth: 0,
  },
  accountTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  accountMeta: {
    color: colors.textMuted,
    marginTop: 3,
  },
  appleButton: {
    width: "100%",
    height: 46,
  },
  signOutButton: {
    minHeight: 42,
  },
  profileCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  profileRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  avatarPreview: {
    width: 68,
    height: 68,
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
    fontSize: 26,
    fontWeight: "600",
  },
  profileBody: {
    flex: 1,
    minWidth: 0,
  },
  avatarActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  avatarButton: {
    flex: 1,
    minWidth: 104,
    minHeight: 42,
  },
  field: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: spacing.xs,
  },
  fieldInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  toggle: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastToggle: {
    borderBottomWidth: 0,
  },
  toggleText: {
    flex: 1,
  },
  toggleLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  toggleBody: {
    color: colors.textMuted,
    lineHeight: 19,
    marginTop: 2,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  message: {
    color: colors.textMuted,
    marginTop: spacing.lg,
    lineHeight: 20,
  },
});
