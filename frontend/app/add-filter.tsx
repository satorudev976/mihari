import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { getOrCreateUid } from "@/lib/auth";
import { createFilter } from "@/lib/api";

const PRESETS = [
  {
    title: "領収書・請求書",
    query:
      "subject:(領収書 OR レシート OR 請求 OR 支払い OR ご利用明細)",
  },
  {
    title: "サブスク更新",
    query:
      "subject:(更新 OR renewal OR subscription OR 定期 OR membership)",
  },
  {
    title: "決済サービス",
    query: "from:(stripe OR paypal OR apple OR google OR amazon)",
  },
];

export default function AddFilterScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setTitle(preset.title);
    setQuery(preset.query);
  };

  const handleSave = async () => {
    if (!title.trim() || !query.trim()) {
      Alert.alert("入力エラー", "タイトルとクエリは必須です");
      return;
    }
    setSaving(true);
    try {
      const uid = await getOrCreateUid();
      await createFilter(uid, title.trim(), query.trim());
      router.back();
    } catch (err) {
      Alert.alert("エラー", String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>プリセットから選択</Text>
      {PRESETS.map((preset) => (
        <TouchableOpacity
          key={preset.title}
          style={styles.presetCard}
          onPress={() => applyPreset(preset)}
        >
          <Text style={styles.presetTitle}>{preset.title}</Text>
          <Text style={styles.presetQuery} numberOfLines={2}>
            {preset.query}
          </Text>
        </TouchableOpacity>
      ))}

      <Text style={[styles.heading, { marginTop: 24 }]}>カスタム設定</Text>

      <Text style={styles.label}>タイトル</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="例: Amazonの請求"
      />

      <Text style={styles.label}>Gmailクエリ</Text>
      <TextInput
        style={[styles.input, styles.queryInput]}
        value={query}
        onChangeText={setQuery}
        placeholder="例: from:amazon subject:請求"
        multiline
      />

      <TouchableOpacity
        style={[styles.saveButton, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveText}>
          {saving ? "保存中..." : "フィルタを保存"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa", padding: 20 },
  heading: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 12,
  },
  presetCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  presetTitle: { fontSize: 15, fontWeight: "600", color: "#333" },
  presetQuery: { fontSize: 12, color: "#999", marginTop: 4 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  queryInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: "#4285F4",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 28,
    marginBottom: 60,
  },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
