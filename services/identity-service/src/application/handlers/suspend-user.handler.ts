import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SuspendUserCommand } from '../commands/suspend-user.command';
import { IUserRepository, USER_REPOSITORY } from '../ports/user.repository.interface';
import { TokenService } from '../../infrastructure/auth/token.service';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';

@CommandHandler(SuspendUserCommand)
export class SuspendUserHandler implements ICommandHandler<SuspendUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: IAuditRepository,
    private readonly tokenService: TokenService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: SuspendUserCommand): Promise<void> {
    const { userId, actorId, reason } = command;

    if (userId === actorId) {
      throw new ForbiddenException('A user cannot suspend themselves');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const previousStatus = user.status;
    user.suspend();

    await this.userRepository.save(user);

    await this.auditRepository.log({
      actorId,
      targetUserId: userId,
      action: 'SuspendUser',
      previousState: JSON.stringify({ status: previousStatus }),
      newState: JSON.stringify({ status: user.status }),
      reason,
    });

    for (const event of user.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    user.commit();

    await this.tokenService.revokeAllSessionsForUser(userId);
  }
}
