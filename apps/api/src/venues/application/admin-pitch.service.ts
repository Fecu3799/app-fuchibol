import { Injectable, NotFoundException } from '@nestjs/common';
import { PitchType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type {
  CreatePitchDto,
  UpdatePitchDto,
} from '../api/dto/admin-pitch.dto';

export interface PitchAdminItem {
  id: string;
  venueId: string;
  name: string;
  pitchType: string;
  price: number | null;
  isActive: boolean;
  createdAt: Date;
}

@Injectable()
export class AdminPitchService {
  constructor(private readonly prisma: PrismaService) {}

  async listPitches(venueId: string): Promise<PitchAdminItem[]> {
    const venue = await this.prisma.client.venue.findUnique({
      where: { id: venueId },
    });
    if (!venue) throw new NotFoundException('Venue not found');

    const pitches = await this.prisma.client.venuePitch.findMany({
      where: { venueId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return pitches.map((p) => ({
      id: p.id,
      venueId: p.venueId,
      name: p.name,
      pitchType: p.pitchType,
      price: p.price,
      isActive: p.isActive,
      createdAt: p.createdAt,
    }));
  }

  async createPitch(
    venueId: string,
    dto: CreatePitchDto,
  ): Promise<PitchAdminItem> {
    const venue = await this.prisma.client.venue.findUnique({
      where: { id: venueId },
    });
    if (!venue) throw new NotFoundException('Venue not found');

    const pitch = await this.prisma.client.venuePitch.create({
      data: {
        venueId,
        name: dto.name,
        pitchType: dto.pitchType as PitchType,
        price: dto.price,
      },
    });
    return {
      id: pitch.id,
      venueId: pitch.venueId,
      name: pitch.name,
      pitchType: pitch.pitchType,
      price: pitch.price,
      isActive: pitch.isActive,
      createdAt: pitch.createdAt,
    };
  }

  async updatePitch(
    venueId: string,
    pitchId: string,
    dto: UpdatePitchDto,
  ): Promise<PitchAdminItem> {
    const pitch = await this.prisma.client.venuePitch.findUnique({
      where: { id: pitchId },
    });
    if (!pitch || pitch.venueId !== venueId)
      throw new NotFoundException('Pitch not found');

    const updated = await this.prisma.client.venuePitch.update({
      where: { id: pitchId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.pitchType !== undefined && {
          pitchType: dto.pitchType as PitchType,
        }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    return {
      id: updated.id,
      venueId: updated.venueId,
      name: updated.name,
      pitchType: updated.pitchType,
      price: updated.price,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    };
  }
}
