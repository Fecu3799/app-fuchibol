import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AdminVenueService } from '../application/admin-venue.service';
import { AdminPitchService } from '../application/admin-pitch.service';
import { CreateVenueDto, UpdateVenueDto } from './dto/admin-venue.dto';
import { CreatePitchDto, UpdatePitchDto } from './dto/admin-pitch.dto';

@Controller('admin/venues')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminVenuesController {
  constructor(
    private readonly venueService: AdminVenueService,
    private readonly pitchService: AdminPitchService,
  ) {}

  // ── Venues ──

  @Get()
  async listVenues() {
    const items = await this.venueService.listVenues();
    return { items };
  }

  @Post()
  async createVenue(@Body() dto: CreateVenueDto) {
    return this.venueService.createVenue(dto);
  }

  @Patch(':id')
  async updateVenue(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVenueDto,
  ) {
    return this.venueService.updateVenue(id, dto);
  }

  // ── Pitches ──

  @Get(':venueId/pitches')
  async listPitches(@Param('venueId', ParseUUIDPipe) venueId: string) {
    const items = await this.pitchService.listPitches(venueId);
    return { items };
  }

  @Post(':venueId/pitches')
  async createPitch(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Body() dto: CreatePitchDto,
  ) {
    return this.pitchService.createPitch(venueId, dto);
  }

  @Patch(':venueId/pitches/:pitchId')
  async updatePitch(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Param('pitchId', ParseUUIDPipe) pitchId: string,
    @Body() dto: UpdatePitchDto,
  ) {
    return this.pitchService.updatePitch(venueId, pitchId, dto);
  }
}
