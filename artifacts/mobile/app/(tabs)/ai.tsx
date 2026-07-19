import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useNutritionChat } from '@workspace/api-client-react';
import * as Haptics from 'expo-haptics';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  'What should I eat to build muscle?',
  'How much protein do I need daily?',
  'What are good high-fiber foods?',
  'How do I reduce sugar intake?',
];

export default function AIScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  const chat = useNutritionChat({
    mutation: {
      onSuccess: (data) => {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-assistant`,
            role: 'assistant',
            content: data.message,
          },
        ]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onError: () => {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-err`,
            role: 'assistant',
            content: "I couldn't get a response right now. Please try again.",
          },
        ]);
      },
    },
  });

  const send = (text: string = input.trim()) => {
    if (!text) return;
    const userMsg: Message = { id: `${Date.now()}-user`, role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    chat.mutate({
      data: {
        messages: next.map((m) => ({ role: m.role, content: m.content })),
        includeProfile: true,
      },
    });
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const styles = makeStyles(colors, insets);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerIcon}>
            <Feather name="cpu" size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.title}>NutriAI Coach</Text>
            <Text style={styles.subtitle}>Personalized nutrition guidance</Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="message-circle" size={32} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Ask me anything</Text>
              <Text style={styles.emptyText}>
                I'm your AI nutrition coach. Ask about macros, meal planning, diet goals, or anything nutrition-related.
              </Text>
              <View style={styles.suggestions}>
                {SUGGESTED_QUESTIONS.map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={styles.suggestionChip}
                    onPress={() => send(q)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.suggestionText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.msgBubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              {item.role === 'assistant' && (
                <View style={styles.aiAvatar}>
                  <Feather name="cpu" size={12} color={colors.primary} />
                </View>
              )}
              <View style={[styles.bubbleContent, item.role === 'user' ? styles.userContent : styles.aiContent]}>
                <Text style={[styles.msgText, item.role === 'user' ? styles.userText : styles.aiText]}>
                  {item.content}
                </Text>
              </View>
            </View>
          )}
        />

        {/* Typing indicator */}
        {chat.isPending && (
          <View style={styles.typingRow}>
            <View style={styles.aiAvatar}>
              <Feather name="cpu" size={12} color={colors.primary} />
            </View>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          </View>
        )}

        {/* Input */}
        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.input}
            placeholder="Ask about nutrition..."
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || chat.isPending) && { opacity: 0.5 }]}
            onPress={() => send()}
            disabled={!input.trim() || chat.isPending}
          >
            <Feather name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 17, fontFamily: 'Inter_700Bold', color: colors.foreground },
    subtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    emptyState: { alignItems: 'center', paddingTop: 40, gap: 12 },
    emptyIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    emptyTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground },
    emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: 16 },
    suggestions: { width: '100%', gap: 8, marginTop: 8 },
    suggestionChip: { borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, padding: 12 },
    suggestionText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground },
    msgBubble: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, gap: 8 },
    userBubble: { justifyContent: 'flex-end' },
    aiBubble: { justifyContent: 'flex-start' },
    aiAvatar: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    bubbleContent: { maxWidth: '80%', borderRadius: 16, padding: 12 },
    userContent: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
    aiContent: { backgroundColor: colors.card, borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
    msgText: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
    userText: { color: '#fff' },
    aiText: { color: colors.foreground },
    typingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 20, paddingBottom: 4 },
    typingBubble: { backgroundColor: colors.card, borderRadius: 16, padding: 12 },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
    input: { flex: 1, maxHeight: 100, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.foreground, backgroundColor: colors.card },
    sendBtn: { width: 46, height: 46, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  });
}
