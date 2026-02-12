import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { getOrCreateUid } from "@/lib/auth";
import { getFilters, updateFilter, deleteFilter, type Filter } from "@/lib/api";

export default function FiltersScreen() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const id = uid ?? (await getOrCreateUid());
    if (!uid) setUid(id);
    setLoading(true);
    try {
      const res = await getFilters(id);
      setFilters(res.filters);
    } catch (err) {
      Alert.alert("エラー", String(err));
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleFilter = async (filter: Filter) => {
    if (!uid) return;
    try {
      await updateFilter(uid, filter.id, { enabled: !filter.enabled });
      setFilters((prev) =>
        prev.map((f) =>
          f.id === filter.id ? { ...f, enabled: !f.enabled } : f
        )
      );
    } catch (err) {
      Alert.alert("エラー", String(err));
    }
  };

  const removeFilter = (filter: Filter) => {
    Alert.alert("削除確認", `「${filter.title}」を削除しますか？`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: async () => {
          if (!uid) return;
          try {
            await deleteFilter(uid, filter.id);
            setFilters((prev) => prev.filter((f) => f.id !== filter.id));
          } catch (err) {
            Alert.alert("エラー", String(err));
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Filter }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Switch
          value={item.enabled}
          onValueChange={() => toggleFilter(item)}
          trackColor={{ true: "#4285F4" }}
        />
      </View>
      <Text style={styles.cardQuery} numberOfLines={2}>
        {item.query}
      </Text>
      <TouchableOpacity onPress={() => removeFilter(item)}>
        <Text style={styles.deleteText}>削除</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={filters}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.empty}>
              フィルタがまだありません。{"\n"}追加ボタンからプリセットを選べます。
            </Text>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/add-filter")}
      >
        <Text style={styles.fabText}>＋ フィルタ追加</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa", padding: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#333", flex: 1 },
  cardQuery: { fontSize: 13, color: "#888", marginBottom: 8 },
  deleteText: { fontSize: 13, color: "#e53935" },
  empty: {
    textAlign: "center",
    color: "#999",
    marginTop: 60,
    fontSize: 15,
    lineHeight: 24,
  },
  fab: {
    position: "absolute",
    bottom: 32,
    left: 24,
    right: 24,
    backgroundColor: "#4285F4",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  fabText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
