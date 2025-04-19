// src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth/auth.service'; // Make sure to create AuthService for JWT validation

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET, // The secret key used to sign the token
    });
  }

  async validate(payload: any) {
    // The payload will contain the decoded JWT
    return this.authService.validateUser(payload.sub); // Example: Validate the user from DB using the 'sub' (subject) claim
  }
}
