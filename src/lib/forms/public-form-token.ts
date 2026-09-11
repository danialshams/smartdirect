import { jwtVerify, SignJWT } from "jose";

const FORM_TOKEN_EXPIRATION = "30d";

export type PublicFormTokenPayload = {
  formId: string;

  instagramAccountId: string;

  instagramUserId: string;

  recipientId: string;
};

function getSecret(): Uint8Array {
  const secret =
    process.env.SMARTDIRECT_FORM_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim();

  if (!secret) {
    throw new Error("SMARTDIRECT_FORM_SECRET or NEXTAUTH_SECRET is required");
  }

  return new TextEncoder().encode(secret);
}

export async function createPublicFormToken(
  payload: PublicFormTokenPayload,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({
      alg: "HS256",
      typ: "JWT",
    })
    .setIssuedAt()
    .setExpirationTime(FORM_TOKEN_EXPIRATION)
    .sign(getSecret());
}

export async function verifyPublicFormToken(
  token: string,
): Promise<PublicFormTokenPayload> {
  const result = await jwtVerify(token, getSecret(), {
    algorithms: ["HS256"],
  });

  const payload = result.payload;

  if (
    typeof payload.formId !== "string" ||
    typeof payload.instagramAccountId !== "string" ||
    typeof payload.instagramUserId !== "string" ||
    typeof payload.recipientId !== "string"
  ) {
    throw new Error("Invalid form token payload");
  }

  return {
    formId: payload.formId,

    instagramAccountId: payload.instagramAccountId,

    instagramUserId: payload.instagramUserId,

    recipientId: payload.recipientId,
  };
}
