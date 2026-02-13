import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useGoogleAuth, getOrCreateUid } from "@/lib/auth";
import { postGoogleAuth } from "@/lib/api";

export default function HomeScreen() {
  const router = useRouter();
  const { response, promptAsync, redirectUri } = useGoogleAuth();
  const [uid, setUid] = useState<string | null>(null);
  const [gmailLinked, setGmailLinked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getOrCreateUid().then(setUid);
  }, []);

  // Handle Google OAuth response
  useEffect(() => {
    if (response?.type === "success" && uid) {
      const { code } = response.params;
      setLoading(true);
      postGoogleAuth(uid, code, redirectUri)
        .then(() => {
          setGmailLinked(true);
          Alert.alert("完了", "Gmailアカウントを連携しました");
        })
        .catch((err) => Alert.alert("エラー", String(err)))
        .finally(() => setLoading(false));
    }
  }, [response, uid, redirectUri]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>mihari</Text>
      <Text style={styles.subtitle}>
        サブスク・請求メールをLINEでお知らせ
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Gmailを連携</Text>
        {gmailLinked ? (
          <View style={styles.doneRow}>
            <Text style={styles.doneText}>Gmail 連携済み</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.button}
            onPress={() => promptAsync()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Googleでログイン</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. LINE通知を連携</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push("/link-line")}
        >
          <Text style={styles.buttonText}>LINE連携を開始</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. 通知フィルタを設定</Text>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => router.push("/filters")}
        >
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
            フィルタ設定
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginTop: 32,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
    marginBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#4285F4",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonSecondary: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#4285F4",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonTextSecondary: {
    color: "#4285F4",
  },
  doneRow: {
    backgroundColor: "#e8f5e9",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  doneText: {
    color: "#2e7d32",
    fontSize: 16,
    fontWeight: "600",
  },
});
