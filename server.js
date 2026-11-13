
const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

const allowedOrigins = [
    'http://localhost:5173',
    process.env.CLIENT_URL
].filter(Boolean);

app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
});

// -------------------- USERS --------------------

function hashPassword(password, username) {
    return crypto.scryptSync(
        password,
        'speakbubble-' + username.toLowerCase(),
        64
    ).toString('hex');
}

const users = [
    {
        id: 1,
        username: 'Daphne',
        passwordHash: hashPassword('daphne123', 'Daphne')
    },
    {
        id: 2,
        username: 'Alex',
        passwordHash: hashPassword('alex123', 'Alex')
    }
];

// -------------------- SESSIONS --------------------

const sessions = new Map();
// Store active SSE connections
const clients = new Map();
// -------------------- CHAT ROOMS --------------------

const rooms = [
    { id: 1, name: 'General' },
    { id: 2, name: 'Developers' }
];

// -------------------- MESSAGES --------------------

let messages = [
    {
        id: 1,
        roomId: 1,
        senderId: 1,
        sender: 'Daphne',
        text: 'Hey everyone! Welcome to SpeakBubble.',
        createdAt: new Date().toISOString(),
        reactions: {}
    },
    {
        id: 2,
        roomId: 1,
        senderId: 2,
        sender: 'Alex',
        text: 'Hey! Happy to be here.',
        createdAt: new Date().toISOString(),
        reactions: {}
    },
    {
        id: 3,
        roomId: 2,
        senderId: 1,
        sender: 'Daphne',
        text: 'Welcome to the Developers room!',
        createdAt: new Date().toISOString(),
        reactions: {}
    }
];

let nextMessageId = 4;
// -------------------- PRIVATE MESSAGES --------------------

let directMessages = [];

let nextDirectMessageId = 1;
// -------------------- HOME ROUTE --------------------

app.get('/', (req, res) => {
    res.send('SpeakBubble Server is running!');
});

// -------------------- GET USERS --------------------

app.get('/api/users', (req, res) => {
    res.json(
        users.map(user => ({
            id: user.id,
            username: user.username
        }))
    );
});

// GET ONLINE USERS
app.get('/api/online-users', authenticate, (req, res) => {
    const onlineUserIds = Array.from(clients.keys());

    res.json(
        users.map(user => ({
            id: user.id,
            username: user.username,
            online: onlineUserIds.includes(user.id)
        }))
    );
});

// -------------------- LOGIN --------------------

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            message: 'Username and password are required'
        });
    }

    const user = users.find(
        u => u.username.toLowerCase() === username.trim().toLowerCase()
    );

    if (!user) {
        return res.status(401).json({
            message: 'Invalid username or password'
        });
    }

    const hashedPassword = hashPassword(password, user.username);

    const passwordMatch = crypto.timingSafeEqual(
        Buffer.from(user.passwordHash, 'hex'),
        Buffer.from(hashedPassword, 'hex')
    );

    if (!passwordMatch) {
        return res.status(401).json({
            message: 'Invalid username or password'
        });
    }

    const token = crypto.randomBytes(32).toString('hex');

    sessions.set(token, user.id);

    res.json({
        message: 'Login successful',
        token: token,
        user: {
            id: user.id,
            username: user.username
        }
    });
});

// -------------------- AUTHENTICATION --------------------

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            message: 'Please login first'
        });
    }

    const token = authHeader.split(' ')[1];
    const userId = sessions.get(token);

    if (!userId) {
        return res.status(401).json({
            message: 'Invalid or expired session'
        });
    }

    req.user = users.find(user => user.id === userId);

    next();
}

// -------------------- GET LOGGED-IN USER --------------------

app.get('/api/me', authenticate, (req, res) => {
    res.json({
        id: req.user.id,
        username: req.user.username
    });
});

// -------------------- LOGOUT --------------------

app.post('/api/logout', authenticate, (req, res) => {
    const token = req.headers.authorization.split(' ')[1];

    sessions.delete(token);

    res.json({
        message: 'Logged out successfully'
    });
});

 // -------------------- SSE CONNECTION --------------------

app.get('/api/events', (req, res) => {
    const token = req.query.token;

    const userId = sessions.get(token);

    if (!userId) {
        return res.status(401).end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.flushHeaders();

    // Send connection confirmation
    res.write(`data: ${JSON.stringify({
        type: 'connected',
        message: 'Connected to SpeakBubble'
    })}\n\n`);

    if (!clients.has(userId)) {
        clients.set(userId, []);
    }

    clients.get(userId).push(res);

    // Remove connection when client disconnects
    req.on('close', () => {
        const userConnections = clients.get(userId) || [];

        clients.set(
            userId,
            userConnections.filter(client => client !== res)
        );

        if (clients.get(userId).length === 0) {
            clients.delete(userId);
        }
    });
});

// -------------------- GET CHAT ROOMS --------------------

app.get('/api/rooms', authenticate, (req, res) => {
    res.json(rooms);
});

// -------------------- GET ROOM MESSAGES --------------------

app.get('/api/rooms/:roomId/messages', authenticate, (req, res) => {
    const roomId = Number(req.params.roomId);

    const room = rooms.find(r => r.id === roomId);

    if (!room) {
        return res.status(404).json({
            message: 'Chat room not found'
        });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const roomMessages = messages.filter(
        message => message.roomId === roomId
    );

    const start = (page - 1) * limit;

    const result = roomMessages.slice(start, start + limit);

    res.json({
        room: room.name,
        page: page,
        totalMessages: roomMessages.length,
        messages: result
    });
});

// -------------------- SEND MESSAGE --------------------

app.post('/api/rooms/:roomId/messages', authenticate, (req, res) => {
    const roomId = Number(req.params.roomId);
    const { text } = req.body;

    const room = rooms.find(r => r.id === roomId);

    if (!room) {
        return res.status(404).json({
            message: 'Chat room not found'
        });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({
            message: 'Message cannot be empty'
        });
    }

    if (text.trim().length > 1000) {
        return res.status(400).json({
            message: 'Message cannot exceed 1000 characters'
        });
    }

    const newMessage = {
        id: nextMessageId++,
        roomId: roomId,
        senderId: req.user.id,
        sender: req.user.username,
        text: text.trim(),
        createdAt: new Date().toISOString(),
        reactions: {}
    };

    messages.push(newMessage);
// Broadcast message to connected users
const eventData = `data: ${JSON.stringify({
    type: 'new_message',
    data: newMessage
})}\n\n`;

clients.forEach((connections) => {
    connections.forEach(client => {
        if (client.writable) {
            client.write(eventData);
        }
    });
});
    res.status(201).json({
        message: 'Message sent successfully',
        data: newMessage
    });
});

 // -------------------- GET PRIVATE MESSAGES --------------------

app.get('/api/dm/:userId/messages', authenticate, (req, res) => {
    const otherUserId = Number(req.params.userId);

    const otherUser = users.find(user => user.id === otherUserId);

    if (!otherUser) {
        return res.status(404).json({
            message: 'User not found'
        });
    }

    if (otherUserId === req.user.id) {
        return res.status(400).json({
            message: 'You cannot message yourself'
        });
    }

    // Only retrieve messages exchanged between these two users
    const conversation = directMessages.filter(message =>
        (message.senderId === req.user.id &&
         message.receiverId === otherUserId) ||
        (message.senderId === otherUserId &&
         message.receiverId === req.user.id)
    );

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const start = Math.max(0, conversation.length - page * limit);
    const end = conversation.length - (page - 1) * limit;

    const result = conversation.slice(start, end);

    res.json({
        conversationWith: otherUser.username,
        page,
        totalMessages: conversation.length,
        messages: result
    });
});

 // -------------------- SEND PRIVATE MESSAGE --------------------

app.post('/api/dm/:userId/messages', authenticate, (req, res) => {
    const receiverId = Number(req.params.userId);
    const { text } = req.body;

    const receiver = users.find(user => user.id === receiverId);

    if (!receiver) {
        return res.status(404).json({
            message: 'User not found'
        });
    }

    if (receiverId === req.user.id) {
        return res.status(400).json({
            message: 'You cannot message yourself'
        });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({
            message: 'Message cannot be empty'
        });
    }

    if (text.trim().length > 1000) {
        return res.status(400).json({
            message: 'Message cannot exceed 1000 characters'
        });
    }

    const newMessage = {
        id: nextDirectMessageId++,
        senderId: req.user.id,
        sender: req.user.username,
        receiverId: receiverId,
        receiver: receiver.username,
        text: text.trim(),
        createdAt: new Date().toISOString()
    };

    directMessages.push(newMessage);

    // Send the private message to both participants
    const eventData = `data: ${JSON.stringify({
        type: 'new_dm',
        data: newMessage
    })}\n\n`;

    [req.user.id, receiverId].forEach(userId => {
        const connections = clients.get(userId) || [];

        connections.forEach(client => {
            if (client.writable) {
                client.write(eventData);
            }
        });
    });

    res.status(201).json({
        message: 'Private message sent successfully',
        data: newMessage
    });
});

// -------------------- TYPING INDICATOR --------------------

app.post('/api/typing', authenticate, (req, res) => {
    const { roomId, isTyping } = req.body;

    const eventData = `data: ${JSON.stringify({
        type: 'typing',
        data: {
            roomId: Number(roomId),
            userId: req.user.id,
            username: req.user.username,
            isTyping: Boolean(isTyping)
        }
    })}\n\n`;

    clients.forEach(connections => {
        connections.forEach(client => {
            if (client.writable) {
                client.write(eventData);
            }
        });
    });

    res.json({ message: 'Typing status sent' });
});

// -------------------- START SERVER --------------------

const server = app.listen(PORT, () => {
    console.log(`SpeakBubble Server running at http://localhost:${PORT}`);
});

server.on('error', (error) => {
    console.error('Server error:', error);
});
