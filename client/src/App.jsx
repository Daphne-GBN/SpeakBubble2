
import { useState, useEffect, useRef } from 'react';
import './App.css';

const API = 'http://localhost:5000';

function App() {
    const [user, setUser] = useState(
        JSON.parse(localStorage.getItem('user') || 'null')
    );
    const [token, setToken] = useState(localStorage.getItem('token') || '');

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const [rooms, setRooms] = useState([]);
    const [people, setPeople] = useState([]);
    const [selected, setSelected] = useState(null);

    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState('');
    const [typingUser, setTypingUser] = useState('');
const typingTimeoutRef = useRef(null);

    const messagesEndRef = useRef(null);

    // CLEAN UP THE TYPING TIMEOUT WHEN THE COMPONENT UNMOUNTS
    useEffect(() => {
        return () => clearTimeout(typingTimeoutRef.current);
    }, []);

    // LOGIN
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const response = await fetch(`${API}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message);
                return;
            }

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            setToken(data.token);
            setUser(data.user);
        } catch {
            setError('Cannot connect to server.');
        }
    };

    // LOAD ROOMS AND PEOPLE
    useEffect(() => {
        if (!token) return;

        const loadData = async () => {
            try {
                const headers = { Authorization: `Bearer ${token}` };

                const [roomResponse, peopleResponse] = await Promise.all([
                    fetch(`${API}/api/rooms`, { headers }),
                    fetch(`${API}/api/users`, { headers })
                ]);

                if (!roomResponse.ok || !peopleResponse.ok) {
                    throw new Error('Could not load chat data.');
                }

                const roomData = await roomResponse.json();
                const peopleData = await peopleResponse.json();

                setRooms(roomData);
                setPeople(peopleData.filter(p => p.id !== user.id));

                if (roomData.length > 0) {
                    setSelected({
                        type: 'room',
                        id: roomData[0].id,
                        name: roomData[0].name
                    });
                }
            } catch (err) {
                setError(err.message);
            }
        };

        loadData();
    }, [token, user]);

    // LOAD ONLINE STATUS
    useEffect(() => {
        if (!token) return;

        const loadOnlineUsers = async () => {
            try {
                const response = await fetch(`${API}/api/online-users`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (response.ok) {
                    setPeople(await response.json().then(data =>
                        data.filter(p => p.id !== user.id)
                    ));
                }
            } catch {
                console.log('Could not refresh online users.');
            }
        };

        loadOnlineUsers();

        const interval = setInterval(loadOnlineUsers, 5000);

        return () => clearInterval(interval);
    }, [token, user]);

    // LOAD SELECTED CONVERSATION
    useEffect(() => {
        if (!token || !selected) return;

        setMessages([]);
        setError('');

        const url = selected.type === 'room'
            ? `${API}/api/rooms/${selected.id}/messages`
            : `${API}/api/dm/${selected.id}/messages`;

        const loadMessages = async () => {
            try {
                const response = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const data = await response.json();

                if (!response.ok) {
                    setError(data.message || 'Could not load messages.');
                    return;
                }

                setMessages(data.messages);
            } catch {
                setError('Could not load conversation.');
            }
        };

        loadMessages();
    }, [token, selected]);

    // SSE REAL-TIME UPDATES
    useEffect(() => {
        if (!token) return;

        const events = new EventSource(
            `${API}/api/events?token=${encodeURIComponent(token)}`
        );

        events.onmessage = (event) => {
            const incoming = JSON.parse(event.data);

            if (incoming.type === 'new_message') {
                const message = incoming.data;

                if (selected?.type === 'room' &&
                    message.roomId === selected.id) {
                    setMessages(previous =>
                        previous.some(m => m.id === message.id)
                            ? previous
                            : [...previous, message]
                    );
                }
            }

            if (incoming.type === 'new_dm') {
                const message = incoming.data;

                if (selected?.type === 'dm' &&
                    (message.senderId === selected.id ||
                     message.receiverId === selected.id)) {
                    setMessages(previous =>
                        previous.some(m => m.id === message.id)
                            ? previous
                            : [...previous, message]
                    );
                }
            }
            if (incoming.type === 'typing') {
                const typing = incoming.data;

                if (
                    selected?.type === 'room' &&
                    typing.roomId === selected.id &&
                    typing.userId !== user.id
                ) {
                    setTypingUser(
                        typing.isTyping ? `${typing.username} is typing...` : ''
                    );
                }
            }
        };

        events.onerror = () => {
            console.log('SSE disconnected. Reconnecting...');
        };

        return () => events.close();
    }, [token, selected]);

    // CLEAR TYPING INDICATOR WHEN CHANGING CONVERSATIONS
    useEffect(() => {
        setTypingUser('');
    }, [selected]);

    // AUTO SCROLL
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: 'smooth'
        });
    }, [messages]);

    // SEND MESSAGE
    const sendMessage = async (e) => {
        e.preventDefault();

        if (!messageText.trim() || !selected) return;

        const text = messageText.trim();

        const url = selected.type === 'room'
            ? `${API}/api/rooms/${selected.id}/messages`
            : `${API}/api/dm/${selected.id}/messages`;

        setMessageText('');

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ text })
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message);
                setMessageText(text);
                return;
            }

            setMessages(previous =>
                previous.some(m => m.id === data.data.id)
                    ? previous
                    : [...previous, data.data]
            );
        } catch {
            setError('Message could not be sent.');
            setMessageText(text);
        }
    };

    // LOGOUT
    const handleLogout = async () => {
        try {
            await fetch(`${API}/api/logout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch {
            console.log('Logout request failed.');
        }

        localStorage.removeItem('token');
        localStorage.removeItem('user');

        setToken('');
        setUser(null);
        setSelected(null);
        setMessages([]);
    };

    // LOGIN SCREEN
    if (!user) {
        return (
            <div className="login-page">
                <div className="login-card">
                    <h1>SpeakBubble 💬</h1>
                    <p>Connect. Chat. Stay in touch.</p>

                    <form onSubmit={handleLogin}>
                        <input
                            placeholder="Username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                        />

                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />

                        <button type="submit">Login</button>
                    </form>

                    {error && <p className="error">{error}</p>}

                    <div className="test-accounts">
                        <small>Daphne: daphne123</small>
                        <small>Alex: alex123</small>
                    </div>
                </div>
            </div>
        );
    }

    // CHAT DASHBOARD
    return (
        <div className="chat-layout">
            <aside className="sidebar">
                <h2>💬 SpeakBubble</h2>

                <div className="profile">
                    <div className="avatar">
                        {user.username[0].toUpperCase()}
                    </div>
                    <div>
                        <strong>{user.username}</strong>
                        <small>Logged in</small>
                    </div>
                </div>

                <h4>CHAT ROOMS</h4>

                {rooms.map(room => (
                    <button
                        key={room.id}
                        className={
                            selected?.type === 'room' &&
                            selected.id === room.id
                                ? 'room active'
                                : 'room'
                        }
                        onClick={() => setSelected({
                            type: 'room',
                            id: room.id,
                            name: room.name
                        })}
                    >
                        # {room.name}
                    </button>
                ))}

                <h4>PEOPLE</h4>

                {people.map(person => (
                    <button
                        key={person.id}
                        className={
                            selected?.type === 'dm' &&
                            selected.id === person.id
                                ? 'person active'
                                : 'person'
                        }
                        onClick={() => setSelected({
                            type: 'dm',
                            id: person.id,
                            name: person.username
                        })}
                    >
                        <span className={
                            person.online ? 'online-dot' : 'offline-dot'
                        }></span>
                        {person.username}
                        <small>{person.online ? 'Online' : 'Offline'}</small>
                    </button>
                ))}

                <button className="logout" onClick={handleLogout}>
                    Logout
                </button>
            </aside>

            <main className="chat-main">
                <header className="chat-header">
                    <h2>
                        {selected?.type === 'room'
                            ? `# ${selected.name}`
                            : selected?.name || 'Select a conversation'}
                    </h2>

                    <span>
                        {selected?.type === 'room'
                            ? 'Group conversation'
                            : 'Private conversation'}
                    </span>
                </header>

                <section className="messages">
                    {messages.map(message => (
                        <div
                            key={message.id}
                            className={
                                message.senderId === user.id
                                    ? 'message own'
                                    : 'message'
                            }
                        >
                            <strong>{message.sender}</strong>
                            <p>{message.text}</p>
                            <small>
                                {new Date(message.createdAt).toLocaleTimeString()}
                            </small>
                        </div>
                    ))}

                    {typingUser && selected?.type === 'room' && (
                        <p className="typing-indicator">{typingUser}</p>
                    )}

                    <div ref={messagesEndRef}></div>
                </section>

                {error && <p className="error">{error}</p>}

                {selected && (
                    <form className="message-form" onSubmit={sendMessage}>
                        <input
                            placeholder="Type a message..."
                            value={messageText}
                            onChange={e => {
                                const value = e.target.value;
                                setMessageText(value);

                                if (selected?.type !== 'room') return;

                                const currentRoomId = selected.id;

                                // Tell other users in this room that we are typing.
                                fetch(`${API}/api/typing`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${token}`
                                    },
                                    body: JSON.stringify({
                                        roomId: currentRoomId,
                                        isTyping: value.length > 0
                                    })
                                }).catch(() => {
                                    console.log('Could not send typing status.');
                                });

                                // Stop the typing indicator after 2 seconds of inactivity.
                                clearTimeout(typingTimeoutRef.current);

                                if (value.length > 0) {
                                    typingTimeoutRef.current = setTimeout(() => {
                                        fetch(`${API}/api/typing`, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${token}`
                                            },
                                            body: JSON.stringify({
                                                roomId: currentRoomId,
                                                isTyping: false
                                            })
                                        }).catch(() => {
                                            console.log('Could not clear typing status.');
                                        });
                                    }, 2000);
                                }
                            }}
                        />
                        <button type="submit">Send</button>
                    </form>
                )}
            </main>
        </div>
    );
}

export default App;
