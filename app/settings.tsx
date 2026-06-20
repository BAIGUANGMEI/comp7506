import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { Image, Platform, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { Image as ImageIcon } from "lucide-react-native";
import { Button, Card, Screen, SectionTitle, TopBar } from "@/components/ui";
import { colors, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";
import { imageAssetToDataUri } from "@/lib/user/avatar";
import { getErrorMessage } from "@/lib/utils/errors";

export default function SettingsScreen() {
  const { entry } = useLocalSearchParams<{ entry?: string }>();
  const stackEntry = entry === "stack";
  const { config, profile, apiKey, saveConfig, saveProfile, testConnection } = useApp();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatarDataUri, setAvatarDataUri] = useState(profile.avatarDataUri ?? null);
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [model, setModel] = useState(config.model);
  const [key, setKey] = useState(apiKey);
  const [deleteRemote, setDeleteRemote] = useState(config.deleteRemoteFilesAfterExtraction);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
  profileCard: {
    padding: spacing.md,
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
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  avatarButton: {
    flex: 1,
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
