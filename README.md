# Ticket to Ride Greece

Local multiplayer Ticket-to-Ride-style Greece prototype built with React, TypeScript, Vite, and a Node/WebSocket server.

## Normal Development

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run server
```

## Docker Development

Requirements:

- Docker Desktop

Start both development containers:

```bash
docker compose up --build
```

Subsequent starts:

```bash
docker compose up
```

Detached mode:

```bash
docker compose up -d
```

Stop:

```bash
docker compose down
```

Logs:

```bash
docker compose logs -f
```

Rebuild after dependency or Dockerfile changes:

```bash
docker compose up --build
```

Access locally:

```text
http://localhost:5173
```

Access from another computer on the same LAN:

```text
http://<HOST_LAN_IP>:5173
```

On Windows, find the host computer's LAN IPv4 address with:

```bash
ipconfig
```

The multiplayer server/WebSocket port is `3001`. The browser client derives the WebSocket hostname from the page hostname, so LAN browsers connect back to `ws://<HOST_LAN_IP>:3001` rather than a Docker-only service name.

Source files are bind-mounted into both containers, so normal code edits should hot reload without rebuilding. Each service uses its own Docker volume for `/app/node_modules`, which keeps Linux container dependencies separate from Windows host dependencies.
