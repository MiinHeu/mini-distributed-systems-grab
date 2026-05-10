import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { API_BASE_URL, WS_BASE_URL } from '../config';
import { Colors, Spacing, Radius, Shadow } from '../theme';

interface Message { id: string; trip_id: number; sender_id: number; receiver_id: number; content: string; type: 'text' | 'image'; is_read: boolean; created_at: string; sender_name?: string; }
interface ChatScreenProps { tripId: number; currentUserId: number; receiverId: number; receiverName: string; token: string; }

export default function ChatScreen({ tripId, currentUserId, receiverId, receiverName, token }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/messages/${tripId}`, { headers: { Authorization: `Bearer ${token}` } });
      setMessages(res.data.data ?? []);
      setReadOnly(res.data.readOnly ?? false);
    } catch {}
    finally { setIsLoading(false); }
  }, [tripId, token]);

  useEffect(() => {
    loadHistory();
    const socket = io(`${WS_BASE_URL}/chat`, { auth: { token }, transports: ['websocket'], reconnection: true, reconnectionAttempts: 5, reconnectionDelay: 2000 });
    socketRef.current = socket;
    socket.on('connect', () => { setIsConnected(true); socket.emit('join:trip', { trip_id: tripId }); socket.emit('message:read', { trip_id: tripId }); });
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('message:receive', (msg: Message) => {
      setMessages(prev => { if (prev.some(m => m.id === msg.id)) return prev; return [...prev, msg]; });
      if (msg.receiver_id === currentUserId) socket.emit('message:read', { trip_id: tripId });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    socket.on('message:read', (data: { trip_id: number; read_by: number }) => {
      if (data.read_by !== currentUserId) setMessages(prev => prev.map(m => m.sender_id === currentUserId ? { ...m, is_read: true } : m));
    });
    socket.on('typing', (data: { user_id: number; is_typing: boolean }) => { if (data.user_id !== currentUserId) setIsTyping(data.is_typing); });
    socket.on('error', (err: { message: string }) => Alert.alert('Loi ket noi', err.message));
    return () => { socket.disconnect(); if (typingTimerRef.current) clearTimeout(typingTimerRef.current); };
  }, [tripId, token, currentUserId, loadHistory]);

  const sendMessage = useCallback(() => {
    const text = inputText.trim();
    if (!text || !socketRef.current) return;
    socketRef.current.emit('message:send', { trip_id: tripId, receiver_id: receiverId, content: text, type: 'text' });
    setInputText('');
    socketRef.current.emit('typing', { trip_id: tripId, is_typing: false });
  }, [inputText, tripId, receiverId]);

  const handleTextChange = useCallback((text: string) => {
    setInputText(text);
    if (!socketRef.current) return;
    socketRef.current.emit('typing', { trip_id: tripId, is_typing: true });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => socketRef.current?.emit('typing', { trip_id: tripId, is_typing: false }), 2000);
  }, [tripId]);

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isMine = item.sender_id === currentUserId;
    const time = new Date(item.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return (
      <View style={[S.msgRow, isMine ? S.myRow : S.theirRow]}>
        {!isMine && <View style={S.avatar}><Text style={S.avatarText}>{receiverName[0]?.toUpperCase()}</Text></View>}
        <View style={[S.bubble, isMine ? S.myBubble : S.theirBubble]}>
          <Text style={[S.msgText, isMine ? S.myText : S.theirText]}>{item.content}</Text>
          <View style={S.metaRow}>
            <Text style={[S.timeText, isMine && S.timeTextMine]}>{time}</Text>
            {isMine && <Text style={S.readStatus}>{item.is_read ? ' vv' : ' v'}</Text>}
          </View>
        </View>
      </View>
    );
  }, [currentUserId, receiverName]);

  if (isLoading) return <View style={S.centered}><ActivityIndicator size="large" color={Colors.primary} /><Text style={S.loadingText}>Dang tai tin nhan...</Text></View>;

  return (
    <KeyboardAvoidingView style={S.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      {readOnly && (
        <View style={S.readOnlyBanner}>
          <Text style={S.readOnlyText}>! Che do chi doc - Khong the gui tin nhan moi</Text>
        </View>
      )}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={S.msgList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<View style={S.emptyChat}><Text style={S.emptyChatText}>Chua co tin nhan nao. Hay bat dau cuoc tro chuyen!</Text></View>}
      />
      {isTyping && <View style={S.typingWrap}><Text style={S.typingText}>{receiverName} dang go...</Text></View>}
      <View style={S.inputBar}>
        <TextInput style={S.input} value={inputText} onChangeText={handleTextChange} placeholder="Nhap tin nhan..." placeholderTextColor={Colors.gray400} multiline maxLength={500} editable={!readOnly && isConnected} />
        <TouchableOpacity style={[S.sendBtn, (!inputText.trim() || readOnly || !isConnected) && S.sendBtnDisabled]} onPress={sendMessage} disabled={!inputText.trim() || readOnly || !isConnected}>
          <Text style={S.sendBtnText}>Gui</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: Colors.gray600 },
  readOnlyBanner: { backgroundColor: '#FEF3C7', paddingHorizontal: Spacing.base, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
  readOnlyText: { color: '#92400E', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  msgList: { paddingHorizontal: 12, paddingVertical: 16, gap: 8 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  myRow: { justifyContent: 'flex-end' },
  theirRow: { justifyContent: 'flex-start' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  bubble: { maxWidth: '72%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  myBubble: { backgroundColor: Colors.primary, borderBottomRightRadius: 4, ...Shadow.sm },
  theirBubble: { backgroundColor: Colors.white, borderBottomLeftRadius: 4, ...Shadow.sm },
  msgText: { fontSize: 15, lineHeight: 21 },
  myText: { color: Colors.white },
  theirText: { color: Colors.gray900 },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, gap: 2 },
  timeText: { fontSize: 11, color: Colors.gray400 },
  timeTextMine: { color: 'rgba(255,255,255,0.65)' },
  readStatus: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  emptyChat: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyChatText: { color: Colors.gray400, fontSize: 14, textAlign: 'center', paddingHorizontal: 30 },
  typingWrap: { paddingHorizontal: Spacing.base, paddingVertical: 6 },
  typingText: { color: Colors.gray400, fontSize: 13, fontStyle: 'italic' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.gray200, gap: 8 },
  input: { flex: 1, minHeight: 42, maxHeight: 100, backgroundColor: Colors.gray50, borderRadius: 21, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: Colors.gray900, borderWidth: 1, borderColor: Colors.gray200 },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: 21, paddingHorizontal: 20, paddingVertical: 11, justifyContent: 'center', alignItems: 'center', ...Shadow.primary },
  sendBtnDisabled: { backgroundColor: Colors.gray300, shadowOpacity: 0 },
  sendBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
});
