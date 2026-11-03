import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useApp } from '../../src/services/AppProvider';
import { managedFile } from '../../src/services/library';
import { Reader } from '../../src/components/Reader';
import type { Book } from '../../src/domain/models';
export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repo } = useApp();
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setBook(null);
    setError('');
    void (async () => {
      const found = await repo.book(id);
      if (!found) throw new Error('书籍不存在或已经删除');
      if (!managedFile(found.fileName).exists)
        throw new Error('本地书籍文件丢失，请返回书库重新导入');
      if (active) setBook(found);
    })().catch((e) => {
      if (active) setError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      active = false;
    };
  }, [id, repo]);
  if (book) return <Reader key={book.id} book={book} />;
  return (
    <View className="flex-1 items-center justify-center gap-5 bg-background p-6">
      {error ? (
        <>
          <Text>{error}</Text>
          <Button onPress={() => router.replace('/')}>返回书库</Button>
        </>
      ) : (
        <ActivityIndicator />
      )}
    </View>
  );
}
