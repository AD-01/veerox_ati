import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DeleteUserCommand } from '../commands/delete-user.command';
import { IUserRepository, USER_REPOSITORY } from '../ports/user.repository.interface';
import { TokenService } from '../../infrastructure/auth/token.service';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';

@CommandHandler(DeleteUserCommand)
export class DeleteUserHandler implements ICommandHandler<DeleteUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: IAuditRepository,
    private readonly tokenService: TokenService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: DeleteUserCommand): Promise<void> {
    const { userId, actorId } = command;

    if (userId === actorId) {
      throw new ForbiddenException('A user cannot delete themselves');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const previousStatus = user.status;
    user.delete();

    await this.userRepository.save(user);

    await this.auditRepository.log({
      actorId,
      targetUserId: userId,
      action: 'DeleteUser',
      previousState: JSON.stringify({ status: previousStatus }),
      newState: JSON.stringify({ status: user.status }),
    });

    for (const event of user.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    user.commit();

    await this.tokenService.revokeAllSessionsForUser(userId);
  }
}
