// src/auth/auth.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  async validateUser(userId: string) {
   const user = await this.findUserById(userId);
    if (!user) {
      return null; 
    }
    return user;
  }

  private async findUserById(userId: string) {
    const users = [{ id: '1', username: 'admin' }];
    return users.find((user) => user.id === userId);
  }
}
