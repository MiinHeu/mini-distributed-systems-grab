import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { API_BASE_URL, WS_BASE_URL } from '../config';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  trip_id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  type: 'text' | 'image';
  is_read: boolean;
  created_at: string;
  sender_name?: string;
}

interface ChatScreenProps {
  tripId: number;
  currentUserId: number;
  receiverId: number;
  receiverName: string;
  token: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ChatScreen({
  tripId,
  currentUserId,
  receiverId,
  receiverName,
  token,
}: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Tải lịch sử chat từ REST API ──────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/messages/${tripId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(res.data.data ?? []);
      setReadOnly(res.data.readOnly ?? false);
    } catch (err) {
      console.warn('Không tải được lịch sử chat:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tripId, token]);

  // ── Kết nối WebSocket ──────────────────────────────────────────────────────
  useEffect(() => {
    loadHistory();

    const socket = io(`${WS_BASE_URL}/chat`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      // Vào phòng chat của chuyến này
      socket.emit('join:trip', { trip_id: tripId });
      // Đánh dấu đã đọc khi vào phòng
      socket.emit('message:read', { trip_id: tripId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connected', (data: { userId: number }) => {
      console.log('WS authenticated as user', data.userId);
    });

    // Nhận tin nhắn mới
    socket.on('message:receive', (msg: Message) => {
      setMessages((prev) => {
        // Tránh duplicate
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Đánh dấu đã đọc nếu mình là receiver
      if (msg.receiver_id === currentUserId) {
        socket.emit('message:read', { trip_id: tripId });
      }
      // Scroll xuống cuối
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    // Cập nhật trạng thái đã đọc
    socket.on('message:read', (data: { trip_id: number; read_by: number }) => {
      if (data.read_by !== currentUserId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.sender_id === currentUserId ? { ...m, is_read: true } : m,
          ),
        );
      }
    });

    // Thông báo đang gõ
    socket.on('typing', (data: { user_id: number; is_typing: boolean }) => {
      if (data.user_id !== currentUserId) {
        setIsTyping(data.is_typing);
      }
    });

    socket.on('error', (err: { message: string }) => {
      Alert.alert('Lỗi kết nối', err.message);
    });

    return () => {
      socket.disconnect();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [tripId, token, currentUserId, loadHistory]);

  // ── Gửi tin nhắn ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(() => {
    const text = inputText.trim();
    if (!text || !socketRef.current) return;

    socketRef.current.emit('message:send', {
      trip_id: tripId,
      receiver_id: receiverId,
      content: text,
      type: 'text',
    });

    setInputText('');
    // Dừng typing indicator
    socketRef.current.emit('typing', { trip_id: tripId, is_typing: false });
  }, [inputText, tripId, receiverId]);

  // ── Xử lý typing indicator ────────────────────────────────────────────────
  const handleTextChange = useCallback(
    (text: string) => {
      setInputText(text);
      if (!socketRef.current) return;

      socketRef.current.emit('typing', { trip_id: tripId, is_typing: true });

      // Tắt typing sau 2 giây không gõ
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socketRef.current?.emit('typing', { trip_id: tripId, is_typing: false });
      }, 2000);
    },
    [tripId],
  );

  // ── Render từng tin nhắn ──────────────────────────────────────────────────
  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isMine = item.sender_id === currentUserId;
      const time = new Date(item.created_at).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });

      return (
        <View style={[styles.messageRow, isMine ? styles.myRow : styles.theirRow]}>
          <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
            <Text style={[styles.messageText, isMine ? styles.myText : styles.theirText]}>
              {item.content}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.timeText}>{time}</Text>
              {isMine && (
                <Text style={styles.readStatus}>{item.is_read ? ' ✓✓' : ' ✓'}</Text>
              )}
            </View>
          </View>
        </View>
      );
    },
    [currentUserId],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00af50" />
        <Text style={styles.loadingText}>Đang tải tin nhắn...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{receiverName}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, isConnected ? styles.dotOnline : styles.dotOffline]} />
            <Text style={styles.statusText}>{isConnected ? 'Đang kết nối' : 'Mất kết nối'}</Text>
          </View>
        </View>
      </View>

      {/* Read-only warning */}
      {readOnly && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            ⚠️ Chế độ chỉ đọc — Không thể gửi tin nhắn mới
          </Text>
        </View>
      )}

      {/* Danh sách tin nhắn */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!</Text>
          </View>
        }
      />

      {/* Typing indicator */}
      {isTyping && (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>{receiverName} đang gõ...</Text>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={handleTextChange}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor="#999"
          multiline
          maxLength={500}
          editable={!readOnly && isConnected}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!inputText.trim() || readOnly || !isConnected) && styles.sendBtnDisabled,
          ]}
          onPress={sendMessage}
          disabled={!inputText.trim() || readOnly || !isConnected}
        >
          <Text style={styles.sendBtnText}>Gửi</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },

  // Header
  header: {
    backgroundColor: '#00af50',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  dotOnline: { backgroundColor: '#a8f0c6' },
  dotOffline: { backgroundColor: '#ffcdd2' },
  statusText: {
    color: '#e0f7ea',
    fontSize: 12,
  },

  // Warning banner
  warningBanner: {
    backgroundColor: '#fff3cd',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ffc107',
  },
  warningText: {
    color: '#856404',
    fontSize: 13,
    textAlign: 'center',
  },

  // Messages
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageRow: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  myRow: {
    justifyContent: 'flex-end',
  },
  theirRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  myBubble: {
    backgroundColor: '#00af50',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myText: { color: '#fff' },
  theirText: { color: '#222' },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 3,
  },
  timeText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  readStatus: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 30,
  },

  // Typing indicator
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  typingText: {
    color: '#888',
    fontSize: 13,
    fontStyle: 'italic',
  },

  // Input area
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
    color: '#222',
    marginRight: 8,
  },
  sendBtn: {
    backgroundColor: '#00af50',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#ccc',
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
