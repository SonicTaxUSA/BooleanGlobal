import { schema, OutputType } from "./confirmUpload_POST.schema";
import { db } from "../../helpers/db";
import { requireUser, errorResponse, ForbiddenError } from "../../helpers/apiAuth";
import { resolveClientId, canManageDocuments } from "../../helpers/permissions";
import { writeAuditEvent } from "../../helpers/auditLog";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const user = await requireUser(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);
    const clientId = await resolveClientId(user, input.clientId);

    if (user.role !== "user" && !(await canManageDocuments(user, clientId))) {
      throw new ForbiddenError("Not permitted to manage documents for this client.");
    }

    // A client must never attach another client's private storage object.
    const prefix = `clients/${clientId}/`;
    const objectName = input.storageFilename.slice(prefix.length);
    if (!input.storageFilename.startsWith(prefix) || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(objectName)) {
      throw new ForbiddenError("This upload does not belong to this client.");
    }

    const doc = await db.transaction().execute(async (trx) => {
      const row = await trx
        .insertInto("clientDocuments")
        .values({
          clientId,
          uploadedBy: user.id,
          fileName: input.fileName,
          storageFilename: input.storageFilename,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          docType: input.docType ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await writeAuditEvent(trx, {
        clientId,
        actorUserId: user.id,
        eventType: "document_uploaded",
        metadata: { fileName: input.fileName, docType: input.docType ?? null },
      });

      return row;
    });

    return new Response(superjson.stringify(doc satisfies OutputType));
  } catch (error) {
    return errorResponse(error);
  }
}