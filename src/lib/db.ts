import { PrismaClient } from '@prisma/client'
import type { ITXClientDenyList } from '@prisma/client/runtime/library'

// User.password_changed_at ships in prisma/manual_migrations/password_reset_tokens.sql,
// which is not applied to the live database yet. Omitting it globally keeps
// every existing query from reading or returning it — including creates and
// updates, which return every scalar field by default — so the app keeps
// working before that migration runs. The few call sites that need the column
// select it explicitly, which overrides this.
function createClient() {
  return new PrismaClient({ omit: { user: { password_changed_at: true } } })
}

type Client = ReturnType<typeof createClient>

const globalForPrisma = globalThis as unknown as { prisma?: Client }

export const db = globalForPrisma.prisma ?? createClient()

/** The app client, and the client its $transaction callbacks receive. Both
 *  carry the global omit above, so helpers that accept either must use these
 *  types rather than PrismaClient / Prisma.TransactionClient, which describe
 *  a client without it. */
export type AppDbClient = Client
export type AppTransactionClient = Omit<Client, ITXClientDenyList>

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
