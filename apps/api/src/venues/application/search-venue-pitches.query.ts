import { Injectable } from '@nestjs/common';
import { PitchType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface VenuePitchItem {
  venueId: string;
  venueName: string;
  venueAddressText: string | null;
  venueMapsUrl: string | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
  venuePitchId: string;
  venuePitchName: string;
  pitchType: string;
  price: number | null;
}

export interface SearchVenuePitchesInput {
  pitchType: string;
}

@Injectable()
export class SearchVenuePitchesQuery {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: SearchVenuePitchesInput): Promise<VenuePitchItem[]> {
    const rows = await this.prisma.client.venuePitch.findMany({
      where: {
        pitchType: input.pitchType as PitchType,
        isActive: true,
        venue: { isActive: true },
      },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            addressText: true,
            mapsUrl: true,
            latitude: true,
            longitude: true,
          },
        },
      },
      orderBy: [{ venue: { name: 'asc' } }, { name: 'asc' }],
    });

    return rows.map((p) => ({
      venueId: p.venue.id,
      venueName: p.venue.name,
      venueAddressText: p.venue.addressText,
      venueMapsUrl: p.venue.mapsUrl,
      venueLatitude: p.venue.latitude,
      venueLongitude: p.venue.longitude,
      venuePitchId: p.id,
      venuePitchName: p.name,
      pitchType: p.pitchType,
      price: p.price,
    }));
  }
}
