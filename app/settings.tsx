import { Platform, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { Button, Card, Screen, SectionTitle, TopBar } from "@/components/ui";
import { colors, radius, spacing } from "@/config/theme";
import { useApp } from "@/lib/AppProvider";
import { getErrorMessage } from "@/lib/utils/errors";

export default function SettingsScreen() {
  const { config, apiKey, saveConfig, testConnection } = useApp();
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [model, setModel] = useState(config.model);
  const [key, setKey] = useState(apiKey);
  const [deleteRemote, setDeleteRemote] = useState(config.deleteRemoteFilesAfterExtraction);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
      <TopBar title="Settings" menu />

      {Platform.OS === "web" ? (
        <View style={styles.webNotice}>
          <Text style={styles.webNoticeTitle}>Web debug storage</Text>
          <Text style={styles.webNoticeBody}>
            API keys are saved in browser local storage for the Web target. Use the
            native app for SecureStore-backed keychain storage.
          </Text>
        </View>
      ) : null}

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
