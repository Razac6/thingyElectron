import React, { useEffect, useState, useRef } from 'react';
import './Chat.css';
import Box from '@mui/material/Box';
import {
  Alert,
  IconButton,
  List,
  Skeleton,
  Typography,
  Avatar,
  Button,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import { useNavigate } from 'react-router-dom';
import { useTimer } from '../../context/TimerContext';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function Chat() {
  const navigate = useNavigate();
  const { tasks, insights } = useTimer();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // AI Engine State
  const [llamaReady, setLlamaStatus] = useState(false);
  const [aiEngine, setAiEngine] = useState('local');
  const [initProgress, setInitProgress] = useState({ progress: 0, status: '' });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      const initChat = async () => {
          const userStr = localStorage.getItem('userId');
          const userId = userStr ? JSON.parse(userStr) : 1;

          // 1. Get Settings
          const settings = await window.electron.database.getAllSettings();
          const engine = settings.aiEngine || 'local';
          setAiEngine(engine);

          // 2. Fetch Llama Status
          const status = await window.electron.ai.getLlamaStatus();
          
          // Trigger Llama init ONLY if engine is local
          if (engine === 'local' && !status.ready && !status.isInitializing) {
              window.electron.ai.initLlama();
          }
          setLlamaStatus(status.ready);

          // 3. Fetch Chat History
          const history = await window.electron.ai.getHistory(userId);
          setMessages(history);
      };
      initChat();

      // Listen for initialization progress
      const progressHandler = (data: { progress: number, status: string }) => {
          setInitProgress({ progress: data.progress, status: data.status });
          if (data.status === 'Model gotowy!') setLlamaStatus(true);
      };
      window.electron.ai.onProgress(progressHandler);

      // Listen for streaming chunks
      window.electron.ai.onDelta((chunk: string) => {
          if (typeof chunk !== 'string') return;
          setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant') {
                  // Create a new array with updated last message
                  const updated = [...prev];
                  updated[updated.length - 1] = { 
                      ...last, 
                      content: last.content + chunk 
                  };
                  return updated;
              }
              // If no assistant message exists yet, create one
              return [...prev, { role: 'assistant', content: chunk }];
          });
      });
  }, []);

  // Force scroll to bottom on every message change
  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTo({
              top: scrollRef.current.scrollHeight,
              behavior: 'smooth'
          });
      }
  }, [messages, isLoading]);

  const handleSubmit = async (event?: any) => {
    if (event) event.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    if (aiEngine === 'local' && !llamaReady) {
        setError("Lokalne AI nie jest jeszcze gotowe.");
        return;
    }

    const userStr = localStorage.getItem('userId');
    const userId = userStr ? JSON.parse(userStr) : 1;
    const userPrompt = inputValue.trim();

    // 1. Clear input and show user message immediately
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userPrompt }]);
    await window.electron.ai.saveMessage(userId, 'user', userPrompt); 

    setIsLoading(true);
    setError(null);

    try {
      const context = {
          unfinishedTasks: tasks.filter(t => t.status !== 'Completed').map(t => t.title),
          currentInsights: insights,
          time: new Date().toLocaleTimeString()
      };

      const finalResponse = await window.electron.ai.askLlama(userPrompt, context);
      
      if (finalResponse.startsWith('Error:')) {
          setError(finalResponse);
      } else {
          // If Gemini was used, onDelta never fired, so we must add the message manually now
          if (aiEngine === 'gemini') {
              setMessages(prev => [...prev, { role: 'assistant', content: finalResponse }]);
          }
          await window.electron.ai.saveMessage(userId, 'assistant', finalResponse);
      }
    } catch (err: any) {
      console.error(err);
      setError(`AI failed to respond: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const clearChat = async () => {
      if (confirm("Clear history?")) {
          try {
              const userStr = localStorage.getItem('userId');
              const userId = userStr ? JSON.parse(userStr) : 1;
              setIsLoading(true); // Temporarily block to avoid race conditions
              await window.electron.ai.clearHistory(userId);
              setMessages([]);
              setError(null);
          } catch (e) {
              console.error("Failed to clear chat", e);
          } finally {
              setIsLoading(false);
              // Small delay to ensure render is done before focus
              setTimeout(() => inputRef.current?.focus(), 100);
          }
      }
  };

  // Button disabled logic: only block if loading OR (using local AND not ready)
  const isSendDisabled = isLoading || !inputValue.trim() || (aiEngine === 'local' && !llamaReady);

  return (
    <Box className="chat-container">
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
              <IconButton onClick={() => navigate('/')} size="small"><ArrowBackIcon /></IconButton>
              <Typography variant="h5" fontWeight="300">
                  Thingy {aiEngine === 'gemini' ? 'Cloud AI' : 'Local AI'}
              </Typography>
          </Box>
          <Button variant="text" color="inherit" onClick={clearChat} size="small" sx={{ opacity: 0.6 }}>
              Clear History
          </Button>
      </Box>

      {/* Progress ONLY for local */}
      {aiEngine === 'local' && !llamaReady && (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'rgba(33, 158, 188, 0.05)', borderRadius: 2, border: '1px solid rgba(33, 158, 188, 0.2)' }}>
              <Typography variant="caption" color="primary" fontWeight="bold" display="block">
                  {initProgress.status || "Inicjalizacja mózgu AI..."}
              </Typography>
              <LinearProgress variant="determinate" value={initProgress.progress} sx={{ height: 4, borderRadius: 2, mt: 1 }} />
          </Box>
      )}

      {/* Messages Area */}
      <Box className="messages-area" ref={scrollRef}>
          {messages.length === 0 && (
              <Box textAlign="center" py={10} color="text.secondary" sx={{ opacity: 0.5 }}>
                  <SmartToyIcon sx={{ fontSize: 48, mb: 1 }} />
                  <Typography variant="h6" fontWeight="300">
                      {aiEngine === 'gemini' ? 'Gemini 1.5 jest gotowy.' : 'Jak mogę Ci dzisiaj pomóc?'}
                  </Typography>
              </Box>
          )}
          
          {messages.map((msg, idx) => (
              <Box key={idx} className={`message-wrapper ${msg.role}`}>
                  <Avatar className="chat-avatar" sx={{ bgcolor: msg.role === 'user' ? '#023047' : '#219ebc' }}>
                      {msg.role === 'user' ? <PersonIcon fontSize="small" /> : <SmartToyIcon fontSize="small" />}
                  </Avatar>
                  <Box className="message-bubble">
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {msg.content}
                      </Typography>
                  </Box>
              </Box>
          ))}
          
          {isLoading && !messages[messages.length-1]?.content && (
              <Box className="message-wrapper assistant">
                  <Avatar className="chat-avatar" sx={{ bgcolor: '#219ebc' }}><SmartToyIcon fontSize="small" /></Avatar>
                  <Box className="message-bubble">
                      <Skeleton width={100} height={20} />
                  </Box>
              </Box>
          )}
          {error && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{error}</Alert>}
      </Box>

      {/* Input Area */}
      <Box component="form" onSubmit={handleSubmit} className="input-container">
          <input 
            ref={inputRef}
            className="chat-input"
            placeholder={aiEngine === 'gemini' || llamaReady ? "Napisz do Thingy..." : "AI się ładuje..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLoading || (aiEngine === 'local' && !llamaReady)}
          />
          <IconButton 
            className="send-button"
            type="submit" 
            disabled={isSendDisabled}
          >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : <SendIcon sx={{ fontSize: 20 }} />}
          </IconButton>
      </Box>
    </Box>
  );
}