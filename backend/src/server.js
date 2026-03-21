const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRouter = require('./api/auth');
const suitesRouter = require('./api/suites');
const projectsRouter = require('./api/projects');
const testCasesRouter = require('./api/testcases');
const runsRouter = require('./api/runs');
const reportsRouter = require('./api/reports');
const nlparserRouter = require('./api/nlparser');
const aiRouter = require('./api/ai');
const dataDrivenRouter = require('./api/datadriven');
const recorderRouter = require('./api/recorder');
const { requireAuth } = require('./middleware/authMiddleware');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Ensure directories exist
['evidence', 'reports', 'uploads', 'data'].forEach(dir => {
    const p = path.join(__dirname, '../../', dir);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

app.use(cors({
    origin: [
        'https://api-testing.support247.top',
        'https://testing.support247.top',
        'http://localhost:3000',
        'http://localhost:5173'
    ],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve evidence files (screenshots/videos)
app.use('/evidence', express.static(path.join(__dirname, '../../evidence')));
// Serve reports
app.use('/reports', express.static(path.join(__dirname, '../../reports')));
// Serve frontend build (in production)
const FRONTEND_DIST = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(FRONTEND_DIST)) {
    app.use(express.static(FRONTEND_DIST));
}

// Inject socket.io into routers
runsRouter.setIO(io);
dataDrivenRouter.setIO(io);

// Auth routes (public — no token required)
app.use('/api/auth', authRouter);

// Protected API routes (require auth token)
app.use('/api/projects', requireAuth, projectsRouter);
app.use('/api/test-suites', requireAuth, suitesRouter);
app.use('/api/test-cases', requireAuth, testCasesRouter);
app.use('/api/runs', requireAuth, runsRouter);
app.use('/api/reports', requireAuth, reportsRouter);
app.use('/api/nl-parser', requireAuth, nlparserRouter);
app.use('/api/ai', requireAuth, aiRouter);
app.use('/api/data-sets', requireAuth, dataDrivenRouter);
app.use('/api/recorder', requireAuth, recorderRouter);

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('[Socket] Client connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('[Socket] Client disconnected:', socket.id);
    });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
    const indexPath = path.join(FRONTEND_DIST, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.json({ message: 'Automation Tool Backend Running', version: '1.0.0' });
    }
});

const PORT = process.env.PORT || 8386;
server.listen(PORT, () => {
    console.log(`✅ Automation Tool Backend running at http://localhost:${PORT}`);
});

module.exports = { app, io };
