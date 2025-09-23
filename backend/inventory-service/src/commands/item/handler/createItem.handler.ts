import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateItemCommand } from '../createItem.command';

@CommandHandler(CreateItemCommand)
export class CreateUserHandler implements ICommandHandler<CreateItemCommand> {
  constructor() {}

  async execute(command: CreateItemCommand): Promise<{ success: boolean }> {
    // Call the service to handle the business logic
    //await this.itemService.createUser(username, email, password);
    return { success: true };
  }
}
