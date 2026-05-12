const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/live' });

function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
}

function getViewerNames() {
  return [...wss.clients]
    .map(client => client.viewerName)
    .filter(name => typeof name === 'string' && name.length > 0);
}

function sendViewerCount() {
  broadcast({ type: 'viewerCount', count: getViewerNames().length });
}

function sendViewerList() {
  broadcast({ type: 'viewerList', viewers: getViewerNames() });
}

wss.on('connection', ws => {
  ws.viewerName = '';
  console.log('Viewer connected. Total:', wss.clients.size);
  sendViewerCount();
  sendViewerList();

  ws.on('message', message => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'splitUpdate') {
        console.log('Broadcasting split update to', wss.clients.size, 'clients');
        broadcast({ type: 'splitUpdate', result: data.result });
      }
      if (data.type === 'viewerJoin') {
        ws.viewerName = String(data.name || '').trim();
        console.log('Viewer joined as:', ws.viewerName);
        sendViewerCount();
        sendViewerList();
      }
    } catch (err) {
      console.error('Invalid WS message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Viewer disconnected. Total:', wss.clients.size);
    sendViewerCount();
    sendViewerList();
  });
});

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log('WebSocket path: ws://localhost:' + port + '/live');
});
