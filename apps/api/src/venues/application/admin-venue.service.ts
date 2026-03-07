import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type {
  CreateVenueDto,
  UpdateVenueDto,
} from '../api/dto/admin-venue.dto';

export interface VenueAdminItem {
  id: string;
  name: string;
  addressText: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  pitchCount: number;
  createdAt: Date;
}

@Injectable()
export class AdminVenueService {
  constructor(private readonly prisma: PrismaService) {}

  async listVenues(): Promise<VenueAdminItem[]> {
    const venues = await this.prisma.client.venue.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { pitches: true } } },
    });
    return venues.map((v) => ({
      id: v.id,
      name: v.name,
      addressText: v.addressText,
      mapsUrl: v.mapsUrl,
      latitude: v.latitude,
      longitude: v.longitude,
      isActive: v.isActive,
      pitchCount: v._count.pitches,
      createdAt: v.createdAt,
    }));
  }

  async createVenue(dto: CreateVenueDto): Promise<VenueAdminItem> {
    const venue = await this.prisma.client.venue.create({
      data: {
        name: dto.name,
        addressText: dto.addressText,
        mapsUrl: dto.mapsUrl,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
      include: { _count: { select: { pitches: true } } },
    });
    return {
      id: venue.id,
      name: venue.name,
      addressText: venue.addressText,
      mapsUrl: venue.mapsUrl,
      latitude: venue.latitude,
      longitude: venue.longitude,
      isActive: venue.isActive,
      pitchCount: venue._count.pitches,
      createdAt: venue.createdAt,
    };
  }

  async updateVenue(id: string, dto: UpdateVenueDto): Promise<VenueAdminItem> {
    const existing = await this.prisma.client.venue.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Venue not found');

    const venue = await this.prisma.client.venue.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.addressText !== undefined && { addressText: dto.addressText }),
        ...(dto.mapsUrl !== undefined && { mapsUrl: dto.mapsUrl }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { _count: { select: { pitches: true } } },
    });
    return {
      id: venue.id,
      name: venue.name,
      addressText: venue.addressText,
      mapsUrl: venue.mapsUrl,
      latitude: venue.latitude,
      longitude: venue.longitude,
      isActive: venue.isActive,
      pitchCount: venue._count.pitches,
      createdAt: venue.createdAt,
    };
  }
}
