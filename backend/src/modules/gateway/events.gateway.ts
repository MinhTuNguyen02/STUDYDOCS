import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*', // Vite dev proxy handles this; tighten in production
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Connection lifecycle ──────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as any)?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} — no token, disconnecting`);
        client.disconnect();
        return;
      }

      const secret = this.configService.get<string>('JWT_ACCESS_SECRET', 'dev_access_secret');
      const payload = this.jwtService.verify(token, { secret });
      const accountId = Number(payload.sub);

      // Attach accountId to socket data for later use
      client.data.accountId = accountId;

      // Join personal room
      client.join(`user:${accountId}`);

      // Resolve role and join role-based room (for staff broadcasts)
      const account = await this.prisma.accounts.findUnique({
        where: { account_id: accountId },
        include: { roles: { select: { name: true } } },
      });

      if (account?.roles?.name) {
        const roleName = account.roles.name.toLowerCase();
        client.data.role = roleName;
        client.join(`role:${roleName}`);
        this.logger.log(`Client ${client.id} joined rooms: user:${accountId}, role:${roleName}`);
      } else {
        this.logger.log(`Client ${client.id} joined room: user:${accountId}`);
      }
    } catch (err: any) {
      this.logger.warn(`Client ${client.id} — invalid token: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id} (account: ${client.data?.accountId ?? 'unknown'})`);
  }

  // ── Emit helpers (called by NotificationsService) ─────────────

  /**
   * Send an event to a specific user by account_id.
   */
  sendToUser(accountId: number, event: string, data: any) {
    this.server.to(`user:${accountId}`).emit(event, data);
  }

  /**
   * Send an event to all users with a specific role.
   */
  sendToRole(role: string, event: string, data: any) {
    this.server.to(`role:${role}`).emit(event, data);
  }
}
