import { Injectable } from '@nestjs/common';
import { IUserRepository } from '../../application/ports/user.repository.interface';
import { User, UserStatus, UserProps } from '../../domain/aggregates/user.aggregate';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { Email } from '../../domain/value-objects/email.value-object';
import { PasswordHash } from '../../domain/value-objects/password-hash.value-object';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email.value,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        passwordHash: user.passwordHash.value,
        status: user.status,
        updatedAt: user.updatedAt,
      },
      create: {
        id: user.id,
        email: user.email.value,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        passwordHash: user.passwordHash.value,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({ where: { id } });
    if (!raw) return null;
    return this.mapToDomain(raw);
  }

  async findByEmail(email: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({ where: { email } });
    if (!raw) return null;
    return this.mapToDomain(raw);
  }

  async findByUsername(username: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({ where: { username } });
    if (!raw) return null;
    return this.mapToDomain(raw);
  }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapToDomain(raw: any): User {
    const props: UserProps = {
      id: raw.id,
      email: Email.create(raw.email),
      username: raw.username,
      firstName: raw.firstName,
      lastName: raw.lastName,
      passwordHash: PasswordHash.fromHash(raw.passwordHash),
      status: raw.status as UserStatus,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
    return User.load(props);
  }
}
