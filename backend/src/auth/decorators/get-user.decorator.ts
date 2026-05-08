// src/auth/decorators/get-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Participant } from '@prisma/client';

export const GetUser = createParamDecorator(
  (data: keyof Participant | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: Participant = request.user;
    return data ? user?.[data] : user;
  },
);