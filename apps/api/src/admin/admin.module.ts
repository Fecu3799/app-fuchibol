import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { MatchRealtimeModule } from '../matches/realtime/match-realtime.module';
import { PushModule } from '../push/push.module';
import { AdminDashboardController } from './api/admin-dashboard.controller';
import { AdminUsersController } from './api/admin-users.controller';
import { AdminMatchesController } from './api/admin-matches.controller';
import { AdminSystemController } from './api/admin-system.controller';
import { GetDashboardQuery } from './application/get-dashboard.query';
import { ListAdminUsersQuery } from './application/list-admin-users.query';
import { GetAdminUserQuery } from './application/get-admin-user.query';
import { BanUserUseCase } from './application/ban-user.use-case';
import { UnbanUserUseCase } from './application/unban-user.use-case';
import { ListAdminMatchesQuery } from './application/list-admin-matches.query';
import { GetAdminMatchQuery } from './application/get-admin-match.query';
import { CancelMatchAdminUseCase } from './application/cancel-match-admin.use-case';
import { DeleteMatchUseCase } from './application/delete-match.use-case';
import { UnlockMatchAdminUseCase } from './application/unlock-match-admin.use-case';
import { GetSystemHealthQuery } from './application/get-system-health.query';
import { MatchNotificationService } from '../matches/application/notifications/match-notification.service';

@Module({
  imports: [PrismaModule, MatchRealtimeModule, PushModule],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminMatchesController,
    AdminSystemController,
  ],
  providers: [
    GetDashboardQuery,
    ListAdminUsersQuery,
    GetAdminUserQuery,
    BanUserUseCase,
    UnbanUserUseCase,
    ListAdminMatchesQuery,
    GetAdminMatchQuery,
    CancelMatchAdminUseCase,
    DeleteMatchUseCase,
    UnlockMatchAdminUseCase,
    GetSystemHealthQuery,
    MatchNotificationService,
  ],
})
export class AdminModule {}
