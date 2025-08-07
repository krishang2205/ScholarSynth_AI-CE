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

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
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
      // First, search for relevant notes
      const searchResponse = await chrome.runtime.sendMessage({
        type: 'SEARCH_NOTES',
        data: { query: input.trim(), limit: 5 }
      });

      let context: string[] = [];
      if (searchResponse.results) {
        context = searchResponse.results.map((result: any) => 
          `Title: ${result.note.title}\nSummary: ${result.note.summary}\nContent: ${result.note.content}`
        );
      }

      // Get AI answer using RAG
      const answerResponse = await chrome.runtime.sendMessage({
        type: 'ANSWER_QUERY',
        data: { 
          query: input.trim(), 
          context: context 
        }
      });

      if (answerResponse.answer) {
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          userId: 'temp-user', // Will be set by storage service
          type: 'assistant',
          content: answerResponse.answer,
          timestamp: new Date(),
          relatedNotes: searchResponse.results?.map((r: any) => r.note.id) || []
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Save messages to storage
        try {
          await chrome.runtime.sendMessage({
            type: 'SAVE_CHAT_MESSAGE',
            data: { message: userMessage }
          });
          console.log('User message saved successfully');
          
          await chrome.runtime.sendMessage({
            type: 'SAVE_CHAT_MESSAGE',
            data: { message: assistantMessage }
          });
          console.log('Assistant message saved successfully');
        } catch (saveError) {
          console.error('Error saving chat messages:', saveError);
        }
      } else {
        throw new Error('No answer received');
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        userId: 'temp-user', // Will be set by storage service
        type: 'assistant',
        content: 'Sorry, I encountered an error while processing your question. Please try again.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
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
                      <Typography variant="body2">Thinking...</Typography>
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