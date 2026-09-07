import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetMeQuery } from '../queries/get-me.query';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { AppException } from '@veerox/shared/src/errors/app.exception';

@QueryHandler(GetMeQuery)
export class GetMeHandler implements IQueryHandler<GetMeQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetMeQuery) {
    const user = await this.prisma.user.findUnique({
      where: { id: query.userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppException('USER_NOT_FOUND', 'User not found', 404);
    }

    if (user.status !== 'ACTIVE') {
      throw new AppException('USER_INACTIVE', 'User is not active', 403);
    }

    // Return safe UserResponseDto shape
    return {
      id: user.id,
      email: user.email,
      roles: user.userRoles.map(ur => ur.role.name),
    };
  }
}
