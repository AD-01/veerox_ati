import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ActivateUserCommand } from '../commands/activate-user.command';
import { IUserRepository, USER_REPOSITORY } from '../ports/user.repository.interface';
import { IAuditRepository, AUDIT_REPOSITORY } from '../ports/audit.repository.interface';

@CommandHandler(ActivateUserCommand)
export class ActivateUserHandler implements ICommandHandler<ActivateUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: IAuditRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ActivateUserCommand): Promise<void> {
    const { userId, actorId } = command;

    if (userId === actorId) {
      throw new ForbiddenException('Cannot activate yourself');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const previousStatus = user.status;
    user.activate();

    await this.userRepository.save(user);

    await this.auditRepository.log({
      actorId,
      targetUserId: userId,
      action: 'ActivateUser',
      previousState: JSON.stringify({ status: previousStatus }),
      newState: JSON.stringify({ status: user.status }),
    });

    for (const event of user.getUncommittedEvents()) {
      this.eventBus.publish(event);
    }
    user.commit();
  }
}
