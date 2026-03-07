import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { VenuePitchesController } from './api/venue-pitches.controller';
import { AdminVenuesController } from './api/admin-venues.controller';
import { SearchVenuePitchesQuery } from './application/search-venue-pitches.query';
import { AdminVenueService } from './application/admin-venue.service';
import { AdminPitchService } from './application/admin-pitch.service';

@Module({
  imports: [PrismaModule],
  controllers: [VenuePitchesController, AdminVenuesController],
  providers: [SearchVenuePitchesQuery, AdminVenueService, AdminPitchService],
})
export class VenuesModule {}
