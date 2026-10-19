import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

function safeCallbackUrl(value: FormDataEntryValue | null): string {
    if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
        return "/dashboard";
    }

    try {
        const url = new URL(value, "https://smartdirect.invalid");
        return url.origin === "https://smartdirect.invalid"
            ? `${url.pathname}${url.search}${url.hash}`
            : "/dashboard";
    } catch {
        return "/dashboard";
    }
}

function loginRedirect(request: Request, error: string) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", error);
    return NextResponse.redirect(url, { status: 303 });
}

/**
 * Native form fallback for browsers where the login client component does not
 * hydrate. The normal hydrated path still uses NextAuth's signIn() client API.
 */
export async function POST(request: Request) {
    const requestOrigin = new URL(request.url).origin;
    const origin = request.headers.get("origin");

    // Reject cross-origin form submissions before checking credentials.
    if (!origin || origin !== requestOrigin) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const form = await request.formData();
        const email = form.get("email");
        const password = form.get("password");
        const callbackUrl = safeCallbackUrl(form.get("callbackUrl"));

        if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
            return loginRedirect(request, "CredentialsSignin");
        }

        const user = await prisma.user.findUnique({
            where: { email: email.trim() },
        });

        if (!user?.password || !(await bcrypt.compare(password, user.password))) {
            return loginRedirect(request, "CredentialsSignin");
        }

        const secret = process.env.NEXTAUTH_SECRET;
        if (!secret) {
            return loginRedirect(request, "Configuration");
        }

        const secure = new URL(request.url).protocol === "https:";
        const cookieName = secure
            ? "__Secure-next-auth.session-token"
            : "next-auth.session-token";

        // NextAuth v4 uses the session cookie name as the JWT encryption salt.
        // Omitting this salt creates a token that NextAuth cannot decode.
        const token = await encode({
            secret,
            salt: cookieName,
            maxAge: SESSION_MAX_AGE,
            token: {
                sub: user.id,
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });

        const response = NextResponse.redirect(new URL(callbackUrl, request.url), { status: 303 });
        response.cookies.set(cookieName, token, {
            httpOnly: true,
            secure,
            sameSite: "lax",
            path: "/",
            maxAge: SESSION_MAX_AGE,
        });
        return response;
    } catch {
        return loginRedirect(request, "Default");
    }
}
