import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizePhone, internalEmailForPhone, validatePassword } from "../src/lib/auth/phone";

const read = (p: string) => readFileSync(p, "utf8");
const auth = read("src/lib/auth.ts");
const ui = read("components/auth/AuthStudio.tsx");
const css = read("components/auth/auth-studio.css");
const otp = read("src/lib/auth/sms-otp.ts");
const request = read("app/api/auth/otp/request/route.ts");
const signup = read("app/api/auth/register/route.ts");
const reset = read("app/api/auth/password/reset/route.ts");
const page = read("app/login/page.tsx");
const schema = read("prisma/schema.prisma");
const instagram = read("prisma/schema.prisma");

assert.equal(normalizePhone("۰۹۱۲ ۳۴۵ ۶۷۸۹"), "+989123456789");
assert.equal(normalizePhone("00989123456789"), "+989123456789");
assert.equal(normalizePhone("+98 912 345 6789"), "+989123456789");
assert.equal(normalizePhone("+49 151 12345678"), "+4915112345678");
assert.equal(normalizePhone("1234"), null);
assert.equal(internalEmailForPhone("+989123456789"), "phone-989123456789@accounts.daira.invalid");
assert.equal(validatePassword("Secure1234"), true);
assert.equal(validatePassword("short1"), false);
assert.equal(validatePassword("withoutnumbers"), false);
for (const field of ["firstName", "lastName", "phone", "password", "confirmPassword"]) {
  assert.ok(ui.includes(field), "Signup must accept " + field);
}
assert.ok(auth.includes('id: "sms"') && auth.includes('consumeOtp(user.id, phone, "login"'));
assert.ok(auth.includes("normalizePhone(rawIdentifier)"), "Password login should accept mobile");
assert.ok(ui.includes('signIn("credentials"') && ui.includes('signIn("sms"'));
assert.ok(ui.includes('postJson("/api/auth/password/reset"') && ui.includes('postJson("/api/auth/register"'));
assert.ok(ui.includes('postJson("/api/auth/otp/request"'));
assert.ok(page.includes("AuthStudio") && !page.includes("bg-gray-100"));
assert.match(css,/\.da-auth-showcase/);
assert.match(css,/@media\(max-width:760px\)/);
assert.match(css,/prefers-reduced-motion:reduce/);
assert.ok(schema.includes("firstName") && schema.includes("lastName"));
assert.ok(schema.includes("model AuthSmsChallenge") && schema.includes("model AuthSignupAttempt"));
assert.ok(instagram.includes("model InstagramAccount") && instagram.includes("  userId             String"));
assert.ok(otp.includes('createHmac("sha256"') && otp.includes("randomInt(0, 1_000_000)"));
assert.ok(otp.includes("MAX_ATTEMPTS = 5") && otp.includes("consumedAt: now"));
assert.ok(otp.includes("OTP_LIFETIME_SECONDS = 120"));
assert.ok(otp.includes('if (!provider) throw new Error("SMS_NOT_CONFIGURED")'));
assert.ok(request.includes("providerConfigured:false") && request.includes("isSmsReady()") && request.includes("status:503"));
assert.ok(signup.includes("bcrypt.hash(password, 12)") && signup.includes("authSignupAttempt"));
assert.ok(reset.includes('consumeOtp(users[0].id,phone,"reset"'));
assert.ok(!read("src/lib/sms/provider.ts").includes("console.log"), "SMS code must never be logged");
console.log("DAIRA AUTH STUDIO PASS: RTL design, mobile signup and recovery, password login, one-time SMS security");
