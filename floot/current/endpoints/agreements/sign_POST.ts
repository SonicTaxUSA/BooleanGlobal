import { schema, OutputType } from "./sign_POST.schema";
import { db } from "../../helpers/db";
import { requireUser, errorResponse, NotFoundError, ForbiddenError } from "../../helpers/apiAuth";
import { writeAuditEvent } from "../../helpers/auditLog";
import { computeCancellationDeadline } from "../../helpers/agreementTemplate";
import { CONSENT_TEXT } from "../../helpers/consentText";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const user = await requireUser(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const h = request.headers;
    const ipAddress = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = h.get("user-agent") ?? null;

    const result = await db.transaction().execute(async (trx) => {
      const agreement = await trx
        .selectFrom("agreements")
        .selectAll()
        .where("id", "=", input.agreementId)
        .executeTakeFirst();
      if (!agreement) throw new NotFoundError("Agreement not found.");
      if (agreement.status !== "pending") {
        throw new ForbiddenError("This agreement is no longer available for signing.");
      }

      const client = await trx
        .selectFrom("clients")
        .select(["id", "userId"])
        .where("id", "=", agreement.clientId)
        .executeTakeFirst();
      if (!client || client.userId !== user.id) {
        throw new ForbiddenError("Not permitted.");
      }
      if (agreement.version.includes("placeholder") || agreement.renderedBody.includes("PLACEHOLDER")) {
        throw new ForbiddenError("Signing is unavailable: this agreement has not completed legal review.");
      }
      if (!agreement.disclosureViewedAt) {
        throw new ForbiddenError("You must review the Consumer Credit File Rights disclosure before signing.");
      }

      const signedAt = new Date();
      const cancellationDeadline = computeCancellationDeadline(signedAt);

      await trx
        .insertInto("agreementSignatures")
        .values({
          agreementId: agreement.id,
          signerUserId: user.id,
          consentGiven: true,
          consentText: CONSENT_TEXT,
          signatureType: "typed",
          signatureText: input.signatureText,
          documentHashAtSigning: agreement.documentHash,
          cancellationDeadline,
          ipAddress,
          userAgent,
          signedAt,
        })
        .execute();

      await trx.updateTable("agreements").set({ status: "signed" }).where("id", "=", agreement.id).execute();
      await trx
        .updateTable("clients")
        .set({ lifecycleStatus: "agreement_signed" })
        .where("id", "=", agreement.clientId)
        .execute();

      await writeAuditEvent(trx, {
        clientId: agreement.clientId,
        actorUserId: user.id,
        eventType: "agreement_signed",
        metadata: { agreementId: agreement.id },
      });
      await writeAuditEvent(trx, {
        clientId: agreement.clientId,
        actorUserId: user.id,
        eventType: "cancellation_deadline_generated",
        metadata: { deadline: cancellationDeadline.toISOString() },
      });
      await writeAuditEvent(trx, {
        clientId: agreement.clientId,
        actorUserId: user.id,
        eventType: "lifecycle_changed",
        metadata: { from: "agreement_pending", to: "agreement_signed" },
      });

      return { agreementId: agreement.id, cancellationDeadline };
    });

    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    return errorResponse(error);
  }
}