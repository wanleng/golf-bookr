import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './db.js';
import { auth } from './middleware/auth.js';  // Add this import
import authRouter from './routes/auth.js';
import bookingsRouter from './routes/bookings.js';
import chatRouter from './routes/chat.js';
import healthRouter from './routes/health.js';
import profileRouter from './routes/profile.js';
import adminRouter from './routes/admin.js';
import userRouter from './routes/users.js';
import { createServer } from 'http';
import { initWebSocket } from './websocket.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();

app.use(cors({
    origin: [
        'http://localhost:5173', 
    
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization'],
}));

// Debug middleware - log all requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Request headers:', req.headers);
    next();
});

// Add request validation middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Request body:', req.body ? {...req.body, password: '[REDACTED]'} : 'No body');
    next();
});

app.use(express.json());

// Add before API routes
app.use((req, res, next) => {
    console.log('Incoming request:', {
        path: req.path,
        method: req.method,
        body: req.body
    });
    next();
});

// Serve uploaded files
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Make sure this comes before your routes
app.use('/uploads', express.static(uploadsDir));
app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    next();
});

// Health check route (must be before API version routes)
app.get('/health', async (req, res) => {
    try {
        await db.execute('SELECT 1');
        res.json({
            success: true,
            status: 'ok',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({
            success: false,
            status: 'error',
            message: error.message
        });
    }
});

// Base route
app.get('/', (req, res) => {
    res.json({ message: 'Golf Booking API Server' });
});

// API routes with version prefix
const API_PREFIX = '/api/v1';
app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/bookings`, bookingsRouter);
app.use(`${API_PREFIX}/chat`, auth, chatRouter);
app.use(`${API_PREFIX}/profile`, auth, profileRouter);
app.use(`${API_PREFIX}/admin`, auth, adminRouter);
app.use(`${API_PREFIX}/users`, auth, userRouter);

// Add catch-all route for undefined endpoints
app.use('*', (req, res) => {
    console.log('404 - Not Found:', req.originalUrl);
    res.status(404).json({ 
        success: false, 
        message: `Endpoint not found: ${req.originalUrl}` 
    });
});

// Enhanced error handler
app.use((err, req, res, next) => {
    console.error('Error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
    
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ 
        success: false, 
        message: err.message || 'Something broke!',
        code: err.code,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

const server = createServer(app);
initWebSocket(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});