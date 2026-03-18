# Fuchibol — Implementaciones Futuras / Puntos de Extensión

Puntos de extensión documentados del proyecto. No son parte del MVP pero están planificados o son prerequisitos para escalar.

---

## Realtime (WS) — Escalamiento horizontal (multi-instancia)

### ¿Qué resuelve?

Socket.IO en modo memory (sin adaptador) solo funciona en un único proceso. Los rooms son locales: si el cliente A está conectado a la instancia 1 y la mutación ocurre en la instancia 2, el evento `match.updated` nunca llega al cliente A.

### ¿Cómo funciona Socket.IO sin adaptador?

- `server.to('match:xyz').emit(...)` itera sobre los sockets conectados **en ese proceso**.
- En single-instance (MVP) esto es suficiente.

### Solución: adaptador Redis pub/sub

El adaptador `@socket.io/redis-adapter` usa dos canales Redis (pub y sub) para propagar los eventos entre instancias.

**Instalación**:

```bash
pnpm -C apps/api add @socket.io/redis-adapter
```

**Configuración en `apps/api/src/main.ts`** (después de `NestFactory.create`):

```typescript
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import IORedis from "ioredis";

class RedisIoAdapter extends IoAdapter {
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  async connectToRedis(url: string): Promise<void> {
    const pubClient = new IORedis(url);
    const subClient = pubClient.duplicate();
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: unknown) {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

// En bootstrap():
const redisUrl = process.env.REDIS_URL;
if (redisUrl) {
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(redisUrl);
  app.useWebSocketAdapter(redisIoAdapter);
}
```

**Variables de entorno esperadas**:
| Variable | Ejemplo | Descripción |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | URL de Redis compartido entre instancias |

**Fallback**: si `REDIS_URL` no está definido, el adaptador no se monta y Socket.IO usa memory (válido para instancia única).

**ioredis ya está instalado** en el proyecto (`ioredis@^5.9.3` en `apps/api/package.json`), por lo que no hay dependencias adicionales más allá del adaptador.

---

Tengo una lista de cambios UX/UI para añadir en diferentes Sprints.
Quiero
Crear y armar equipos tiene que estar en , con un fondo y un menu estilo pes viejo.
Personalizacion del armado de equipos: tiene que ser el core de la pantalla, con avatars, cambio de nombre del equipo.
Chat dentro de esa pantalla abajo de la lista de jugadores.
Poner la fecha/hora al lado del boton confirmar.
