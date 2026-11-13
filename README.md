# SpeakBubble 💬

**SpeakBubble** is a real-time chat application built with React and Express. It provides a simple interface for group conversations and private one-to-one messaging, with live updates powered by Server-Sent Events (SSE).

## Features

- **User authentication** with login and logout
- **Group chat rooms** — General and Developers
- **Private messaging** between users
- **Real-time message delivery** using Server-Sent Events (SSE)
- **Typing indicators** in group rooms
- **Online/offline status** for users
- **Message history** loaded when opening a conversation
- **Message validation**, including empty-message and length checks
- **Responsive chat interface** with a lavender and deep-navy theme

## Tech Stack

### Frontend
- React
- Vite
- JavaScript
- CSS

### Backend
- Node.js
- Express
- Server-Sent Events (SSE)
- Node.js `crypto` module for password hashing and session tokens

## Project Structure

```text
SpeakBubble2/
├── client/              # React + Vite frontend
│   ├── public/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── ...
│   ├── package.json
│   └── ...
├── server.js            # Express backend and API routes
├── package.json         # Backend dependencies
├── package-lock.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js and npm installed
- Git (to clone the repository)

### 1. Clone the repository

```bash
git clone https://github.com/Daphne-GBN/SpeakBubble2.git
cd SpeakBubble2
```

### 2. Install backend dependencies

From the project root:

```bash
npm install
```

### 3. Install frontend dependencies

```bash
cd client
npm install
```

## Run the Application

Run the backend and frontend in **two separate terminals**.

### Terminal 1 — Backend

From the project root:

```bash
node server.js
```

The Express server starts at:

`http://localhost:5000`

### Terminal 2 — Frontend

From the `client` directory:

```bash
npm run dev
```

Vite displays the local development URL, usually:

`http://localhost:5173`

Open that URL in your browser.

## Demo Accounts

The current development server includes two sample accounts:

| Username | Password |
|---|---|
| Daphne | `daphne123` |
| Alex | `alex123` |

Use two separate browser sessions (for example, a regular window and an incognito window) to test conversations between the accounts.

> **Development note:** These are demonstration credentials for the local sample setup. Do not use them as production credentials.

## API Overview

The Express backend currently exposes routes for:

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/login` | Log in and create a session |
| POST | `/api/logout` | Log out |
| GET | `/api/me` | Get the authenticated user |
| GET | `/api/users` | List users |
| GET | `/api/online-users` | Get online/offline status |
| GET | `/api/rooms` | List chat rooms |
| GET | `/api/rooms/:roomId/messages` | Retrieve room messages |
| POST | `/api/rooms/:roomId/messages` | Send a group message |
| GET | `/api/dm/:userId/messages` | Retrieve a private conversation |
| POST | `/api/dm/:userId/messages` | Send a private message |
| POST | `/api/typing` | Broadcast group-room typing status |
| GET | `/api/events?token=...` | Open the SSE connection |

Protected API routes require the session token in the `Authorization: Bearer <token>` header. The SSE endpoint receives the token as a query parameter because the browser's `EventSource` API does not support custom authorization headers.

### Testing with Postman

You can test the REST API independently of the React interface using [Postman](https://www.postman.com/).

**Base URL**

```text
http://localhost:5000
```

Start the backend before sending requests:

```bash
node server.js
```

#### 1. Log in and obtain a token

- **Method:** `POST`
- **URL:** `http://localhost:5000/api/login`
- **Body:** Select **raw** and **JSON** in Postman.

```json
{
  "username": "Daphne",
  "password": "daphne123"
}
```

A successful response contains a `token`. Copy its value for the authenticated requests below.

#### 2. Set authentication for protected endpoints

In the Postman **Headers** tab, add:

| Key | Value |
|---|---|
| `Authorization` | `Bearer YOUR_TOKEN` |
| `Content-Type` | `application/json` |

Replace `YOUR_TOKEN` with the token returned by the login request. The login endpoint itself does not require this header.

#### 3. Send a group message

- **Method:** `POST`
- **URL:** `http://localhost:5000/api/rooms/1/messages`
- **Body:** raw → JSON

```json
{
  "text": "Hello from Postman!"
}
```

Room ID `1` is the General room; room ID `2` is Developers.

#### 4. Retrieve group messages

- **Method:** `GET`
- **URL:** `http://localhost:5000/api/rooms/1/messages`

Use the same authentication header.

#### 5. Send a private message

- **Method:** `POST`
- **URL:** `http://localhost:5000/api/dm/2/messages`
- **Body:** raw → JSON

```json
{
  "text": "Hey Alex! This is a private message."
}
```

The example sends a message to user ID `2` (Alex) when authenticated as Daphne.

#### 6. Retrieve a private conversation

- **Method:** `GET`
- **URL:** `http://localhost:5000/api/dm/2/messages`

Use the same authentication header.

#### 7. Check validation

To test the empty-message validation, send a group or private message with this body:

```json
{
  "text": ""
}
```

The API should respond with `400 Bad Request` and an explanatory error message. Messages longer than 1000 characters are also rejected.

## Notes and Limitations

- The current setup is intended for local development and demonstration.
- User accounts, sessions, rooms, and messages are stored in server memory. Restarting the backend clears this data and resets the sample messages.
- The typing indicator currently applies to group rooms.
- The frontend CORS configuration currently allows the Vite development origin `http://localhost:5173`.
- This repository does not yet include a production deployment configuration or persistent database.

## Future Improvements

Potential next steps include:
- Persistent storage with a database
- Unread message counts
- Emoji reactions
- Private-chat typing indicators
- Improved session persistence and production security
- Deployment configuration

## Author

**Daphne**  
GitHub: [@Daphne-GBN](https://github.com/Daphne-GBN)

---

Built as a hands-on full-stack project to explore React, Express, authentication, REST APIs, and real-time communication.
