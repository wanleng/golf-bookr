import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField, Button, Typography, Box, CircularProgress } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import styles from '../styles/Chatbot.module.css';
import api from '../services/api';

const formatAIMessage = (message) => {
    return message.split('\n').map((line, i) => {
        if (!line.trim()) return null; // Skip empty lines
        
        if (line.startsWith('►')) {
            return <h3 key={i} className={styles.sectionHeader}>{line}</h3>;
        } else if (line.startsWith('•')) {
            return <span key={i} className={styles.bulletPoint}>{line}</span>;
        } else if (line.startsWith('⛳')) {
            return <h4 key={i} className={styles.courseTitle}>{line}</h4>;
        } else if (line.startsWith('─')) {
            return <hr key={i} className={styles.divider} />;
        } else {
            return <span key={i} className={styles.textLine}>{line}</span>;
        }
    }).filter(Boolean); // Remove null values
};

const Chatbot = () => {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Check authentication
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
        }
    }, [navigate]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setMessages(prev => [...prev, { text: userMessage, isUser: true }]);
        setInput('');
        setLoading(true);

        try {
            // Fix: Simplified endpoint path
            const response = await api.post('/chat', { 
                message: userMessage 
            });
            
            console.log('Chat response:', response.data);
            if (response.data.success) {
                setMessages(prev => [...prev, { 
                    text: response.data.message, 
                    isUser: false 
                }]);
            }
        } catch (error) {
            console.error('Chat error:', error);
            if (error.response?.status === 401) {
                localStorage.removeItem('token');
                navigate('/login');
            } else {
                setMessages(prev => [...prev, { 
                    text: error.response?.data?.message || "Sorry, I'm having trouble connecting right now.", 
                    isUser: false 
                }]);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={styles.container}>
            <Typography variant="h4" gutterBottom>CawFee AI Golf Assistant</Typography>
            
            <div className={styles.chatWindow}>
                {messages.map((message, index) => (
                    <div 
                        key={index} 
                        className={message.isUser ? styles.userMessage : styles.aiMessage}
                    >
                        {message.isUser ? (
                            message.text
                        ) : (
                            <div className={styles.formattedMessage}>
                                {formatAIMessage(message.text)}
                            </div>
                        )}
                    </div>
                ))}
                {loading && (
                    <div className={styles.aiMessage}>
                        <CircularProgress size={20} />
                    </div>
                )}
            </div>

            <Box className={styles.inputContainer}>
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Ask CawFee about golf courses, tee-times, or booking..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={loading}
                />
                <Button
                    variant="contained"
                    endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                >
                    Send
                </Button>
            </Box>
        </div>
    );
};

export default Chatbot;