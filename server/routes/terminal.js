const express = require('express');
const { Client } = require('ssh2');
const WebSocket = require('ws');
const iconv = require('iconv-lite');
const router = express.Router();

const termSessions = new Map();

function setupTerminalWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    let conn = null;
    let sessionId = null;

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case 'connect':
            const { host, port, username, password, privateKey } = msg;
            conn = new Client();
            sessionId = `${username}@${host}:${port}`;

            conn.on('ready', () => {
              ws.send(JSON.stringify({ type: 'connected', sessionId }));
              conn.shell({ term: 'xterm-256color', cols: msg.cols || 80, rows: msg.rows || 24 }, (err, stream) => {
                if (err) {
                  ws.send(JSON.stringify({ type: 'error', message: err.message }));
                  return;
                }
                stream.on('data', (chunk) => {
                  ws.send(JSON.stringify({ type: 'data', encoding: 'base64', data: chunk.toString('base64') }));
                });
                stream.stderr.on('data', (chunk) => {
                  ws.send(JSON.stringify({ type: 'data', encoding: 'base64', data: chunk.toString('base64') }));
                });
                stream.on('close', () => {
                  ws.send(JSON.stringify({ type: 'closed' }));
                });
                ws.stream = stream;
              });
            });

            conn.on('error', (err) => {
              ws.send(JSON.stringify({ type: 'error', message: err.message }));
            });

            conn.connect({
              host: host || '127.0.0.1',
              port: port || 22,
              username: username || 'root',
              password: password,
              privateKey: privateKey,
              readyTimeout: 10000
            });
            break;

          case 'data':
            if (ws.stream && ws.stream.writable) {
              const encoding = iconv.encodingExists(msg.encoding) ? msg.encoding : 'utf-8';
              ws.stream.write(iconv.encode(msg.data, encoding));
            }
            break;

          case 'resize':
            if (ws.stream && ws.stream.writable) {
              ws.stream.setWindow(msg.rows || 24, msg.cols || 80, 0, 0);
            }
            break;

          case 'disconnect':
            if (conn) {
              conn.end();
              conn = null;
            }
            break;
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: e.message }));
      }
    });

    ws.on('close', () => {
      if (conn) {
        conn.end();
        conn = null;
      }
    });
  });
}

router.post('/test', (req, res) => {
  const { host, port, username, password } = req.body;
  const conn = new Client();
  conn.on('ready', () => {
    conn.end();
    res.json({ success: true });
  });
  conn.on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
  conn.connect({
    host: host || '127.0.0.1',
    port: port || 22,
    username: username || 'root',
    password: password,
    readyTimeout: 5000
  });
});

module.exports = { router, setupTerminalWebSocket };
