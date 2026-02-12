import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { getOrCreateUid } from "@/lib/auth";
import { startLineLink } from "@/lib/api";

// Replace with your LINE Official Account URL
const LINE_OA_URL = "https://line.me/R/ti/p/@YOUR_LINE_OA_ID";

export default function LinkLineScreen() {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const uid = await getOrCreateUid();
      const result = await startLineLink(uid);
      setCode(result.code);
    } catch (err) {
      Alert.alert("エラー", String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>LINE連携の手順</Text>

      <View style={styles.step}>
        <Text style={styles.stepNumber}>Step 1</Text>
        <Text style={styles.stepText}>
          下のボタンで連携コードを発行してください
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>連携コードを発行</Text>
          )}
        </TouchableOpacity>
      </View>

      {code && (
        <>
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>連携コード（10分間有効）</Text>
            <Text style={styles.code}>{code}</Text>
          </View>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>Step 2</Text>
            <Text style={styles.stepText}>
              下のボタンでLINE公式アカウントを友だち追加してください
            </Text>
            <TouchableOpacity
              style={[styles.button, styles.lineButton]}
              onPress={() => Linking.openURL(LINE_OA_URL)}
            >
              <Text style={styles.buttonText}>LINEで友だち追加</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>Step 3</Text>
            <Text style={styles.stepText}>
              LINE のトーク画面で上記の6桁コードを送信してください。
              {"\n"}「連携が完了しました」と返信が届けば成功です。
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    padding: 24,
  },
  heading: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 24,
  },
  step: {
    marginBottom: 24,
  },
  stepNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4285F4",
    marginBottom: 4,
  },
  stepText: {
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#4285F4",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  lineButton: {
    backgroundColor: "#06C755",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  codeBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#4285F4",
  },
  codeLabel: {
    fontSize: 13,
    color: "#888",
    marginBottom: 8,
  },
  code: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#1a1a2e",
    letterSpacing: 12,
  },
});
