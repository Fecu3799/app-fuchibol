import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SearchVenuePitchesQuery } from '../application/search-venue-pitches.query';
import { SearchVenuePitchesQueryDto } from './dto/search-venue-pitches-query.dto';

@Controller('venue-pitches')
@UseGuards(JwtAuthGuard)
export class VenuePitchesController {
  constructor(private readonly searchQuery: SearchVenuePitchesQuery) {}

  @Get('search')
  async search(@Query() query: SearchVenuePitchesQueryDto) {
    const items = await this.searchQuery.execute({
      pitchType: query.pitchType,
    });
    return { items };
  }
}
