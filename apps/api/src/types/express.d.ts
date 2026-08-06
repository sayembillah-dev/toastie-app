import type { RequestContext } from '../access/context.guard';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      ctx?: RequestContext;
    }
  }
}
