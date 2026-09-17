import { schema, OutputType } from "./changePassword_POST.schema";
import { db } from "../../helpers/db";
import { requireUser, errorResponse, ForbiddenError } from "../../helpers/apiAuth";
import { generatePasswordHash } from "../../helpers/generatePasswordHash";
import { getServerSessionOrThrow } from "../../helpers/getSetServerSession";
import { compare } from "bcryptjs";
import superjson from "superjson";

// Self-service password change. Requires the CURRENT password — this is the
// only supported way to rotate a credential; no admin-side "set another
// user's password" path exists, by design, so a password is never handled
// by anyone but its owner.
export async function handle(request: Request) {
  try {
    const user = await requireUser(request);
    const currentSession = await getServerSessionOrThrow(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const existing = await db
      .selectFrom("userPasswords")
      .select(["passwordHash"])
      .where("userId", "=", user.id)
      .executeTakeFirst();
    if (!existing) {
      throw new ForbiddenError("No password set for this account.");
    }

    const valid = await compare(input.currentPassword, existing.passwordHash);
    if (!valid) {
      throw new ForbiddenError("Current password is incorrect.");
    }

    const newHash = await generatePasswordHash(input.newPassword);
    await db.transaction().execute(async (trx) => {
      await trx.updateTable("userPasswords").set({ passwordHash: newHash }).where("userId", "=", user.id).execute();
      await trx.insertInto("auditEvents").values({
        actorUserId: user.id,
        eventType: "password_rotated",
        metadata: { method: "self_service" },
      }).execute();
      // Rotating a credential invalidates every OTHER active session for this
      // account — a stolen/shared old session shouldn't survive a password
      // change. The session that just made this request stays valid so the
      // user isn't immediately logged out.
      await trx
        .deleteFrom("sessions")
        .where("userId", "=", user.id)
        .where("id", "!=", currentSession.id)
        .execute();
    });

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    return errorResponse(error);
  }
}