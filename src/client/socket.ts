import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientGameEvent, ClientMessage, ClientGameView, ServerMessage } from '../../shared/protocol';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

function getSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname || 'localhost';
  const port = import.meta.env.VITE_GAME_SERVER_PORT ?? '3001';

  return `${protocol}//${host}:${port}`;
}

export function useGameSocket() {
  const socketRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [view, setView] = useState<ClientGameView | undefined>();
  const [clientMessage, setClientMessage] = useState('');
  const [eventMessage, setEventMessage] = useState('');
  const [latestGameEvent, setLatestGameEvent] = useState<ClientGameEvent | undefined>();

  useEffect(() => {
    const socket = new WebSocket(getSocketUrl());
    socketRef.current = socket;
    setConnectionStatus('connecting');

    socket.addEventListener('open', () => {
      setConnectionStatus('connected');
    });

    socket.addEventListener('close', () => {
      setConnectionStatus('disconnected');
    });

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data) as ServerMessage;

      if (message.type === 'PLAYER_ASSIGNED') {
        sessionStorage.setItem('greeceRailsPlayerId', message.playerId);
        sessionStorage.setItem('greeceRailsSessionToken', message.sessionToken);
      }

      if (message.type === 'STATE') {
        setView(message.view);
      }

      if (message.type === 'GAME_EVENT') {
        setLatestGameEvent(message.event);
        setEventMessage(message.event.message);
      }

      if (message.type === 'ACTION_REJECTED') {
        setClientMessage(message.message);
      }
    });

    return () => {
      socket.close();
    };
  }, []);

  const send = useCallback((message: ClientMessage) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setClientMessage('Disconnected from game server.');
      return;
    }

    setClientMessage('');
    socketRef.current.send(JSON.stringify(message));
  }, []);

  useEffect(() => {
    if (!eventMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setEventMessage(''), 3200);

    return () => window.clearTimeout(timeoutId);
  }, [eventMessage]);

  return {
    connectionStatus,
    view,
    clientMessage,
    eventMessage,
    latestGameEvent,
    send,
  };
}
