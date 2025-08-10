import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Button,
  CircularProgress,
  Avatar,
  Paper,
  Chip,
  Divider
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { ChatMessage } from '../../types';
import { aiService } from '../../services/ai';
import { safeSendMessage } from '../../utils/message-utils';

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChatHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      console.log('Loading chat history...');
      const response = await chrome.runtime.sendMessage({
        type: 'GET_CHAT_MESSAGES',
        data: { limit: 50 }
      });
      
      console.log('Chat history response:', response);
      if (response && response.messages) {
        setMessages(response.messages);
        console.log('Loaded', response.messages.length, 'chat messages');
      } else {
        console.log('No chat messages found or invalid response');
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      setMessages([]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      userId: 'temp-user', // Will be set by storage service
      type: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Fetch settings & user profile in parallel for accurate user context
      const [searchResponse, profileResp, settingsResp] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'SEARCH_NOTES', data: { query: input.trim(), limit: 5 } }),
        safeSendMessage({ type: 'GET_USER_PROFILE' }),
        safeSendMessage({ type: 'GET_SETTINGS' })
      ]);
      const relatedIds = searchResponse.results?.map((r: any) => r.note.id) || [];
      const context: string[] = searchResponse.results ? searchResponse.results.map((result: any) => 
        `Title: ${result.note.title}\nSummary: ${result.note.summary}\nContent: ${result.note.content}`) : [];

      // Create streaming assistant placeholder
      const assistantId = crypto.randomUUID();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        userId: 'temp-user',
        type: 'assistant',
        content: '',
        timestamp: new Date(),
        relatedNotes: relatedIds,
        streaming: true
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Determine user profile (fallback minimal if unavailable)
      const userProfile = profileResp?.profile || {
        userId: 'temp-user',
        topics: [],
        style: 'academic',
        verbosity: 'concise',
        preferredLength: 'short',
        researchFocus: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Ensure aiService has key loaded (lazy init inside makeGeminiRequest too)
      try { await aiService.initialize(); } catch (e) { console.warn('AI init in chat failed (will rely on lazy):', e); }

      // Streaming simulation using aiService wrapper
      abortRef.current = new AbortController();
      try {
        await aiService.answerQueryStream(
          input.trim(),
          context,
          userProfile as any,
          (chunk) => {
            setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m));
          },
          abortRef.current.signal
        );
      } catch (e) {
        if ((e as any).message === 'aborted') {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + ' [stopped]', streaming: false } : m));
        } else {
          const errMsg = (e as any)?.message?.includes('API key not configured')
            ? 'AI key missing. Set an API key in Settings.'
            : 'Error generating response.';
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: errMsg, streaming: false } : m));
        }
      }

      // mark streaming done
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m));

      // Save messages
      try {
        await chrome.runtime.sendMessage({ type: 'SAVE_CHAT_MESSAGE', data: { message: userMessage } });
        const finalAssistant = (messagesRef.current || []).find(m => m.id === assistantId) || assistantMessage;
        await chrome.runtime.sendMessage({ type: 'SAVE_CHAT_MESSAGE', data: { message: { ...finalAssistant, streaming: undefined } } });
      } catch (saveErr) { console.error('Save error', saveErr); }

    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage: ChatMessage = { id: crypto.randomUUID(), userId: 'temp-user', type: 'assistant', content: 'Sorry, error occurred. Please retry.', timestamp: new Date() };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // keep ref to messages for save
  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(()=>{ messagesRef.current = messages; }, [messages]);

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Box sx={{ pb: 7, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        AI Chat Assistant
      </Typography>

      {/* Messages */}
      <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
        {messages.length > 0 ? (
          <Box>
            {messages.map((message) => (
              <Box
                key={message.id}
                sx={{
                  display: 'flex',
                  justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
                  mb: 2
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    maxWidth: '80%'
                  }}
                >
                  {message.type === 'assistant' && (
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                      <BotIcon />
                    </Avatar>
                  )}
                  
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: message.type === 'user' ? 'primary.main' : 'grey.100',
                      color: message.type === 'user' ? 'white' : 'text.primary',
                      borderRadius: 2,
                      maxWidth: '100%'
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {message.content}
                    </Typography>
                    
                    {message.relatedNotes && message.relatedNotes.length > 0 && (
                      <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                          Based on {message.relatedNotes.length} related note(s)
                        </Typography>
                      </Box>
                    )}
                  </Paper>

                  {message.type === 'user' && (
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                      <PersonIcon />
                    </Avatar>
                  )}
                </Box>
              </Box>
            ))}
            
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                    <BotIcon />
                  </Avatar>
                  <Paper sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={16} />
                      <Typography variant="body2">Generating...</Typography>
                      <Button size="small" onClick={handleStop}>Stop</Button>
                    </Box>
                  </Paper>
                </Box>
              </Box>
            )}
          </Box>
        ) : (
          <Box className="empty-state">
            <div className="empty-state-icon">💬</div>
            <Typography className="empty-state-title">
              Start a conversation
            </Typography>
            <Typography className="empty-state-description">
              Ask me anything about your research notes. I'll use your saved content to provide relevant answers.
            </Typography>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input */}
      <Card>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              variant="outlined"
              placeholder="Ask me about your notes..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              size="small"
            />
            <Button
              variant="contained"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              sx={{ minWidth: 48, px: 2 }}
            >
              <SendIcon />
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Press Enter to send, Shift+Enter for new line
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Chat; 