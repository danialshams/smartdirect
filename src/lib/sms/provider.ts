/** Configurable outbound SMS transport. No network traffic without explicit credentials. */
export type SmsSendRequest = { phone: string; text: string; reference: string };
export type SmsSendReceipt = { reference: string; providerMessageId: string };
export interface SmsProvider {
  sendBatch(messages: SmsSendRequest[]): Promise<SmsSendReceipt[]>;
  getName(): string;
}

type KavenegarResponse = {
  return?: { status?: number; message?: string };
  entries?: Array<{ messageid?: number | string }>;
};

/** Optional provider implementation. The API key is only ever used server-side. */
class KavenegarSmsProvider implements SmsProvider {
  constructor(private readonly apiKey: string, private readonly sender: string) {}
  getName() { return "kavenegar"; }
  async sendBatch(messages: SmsSendRequest[]): Promise<SmsSendReceipt[]> {
    const result: SmsSendReceipt[] = [];
    for (const message of messages) {
      // Kavenegar SMS sending is intended for Iranian mobile numbers.
      if (!/^\+989\d{9}$/.test(message.phone)) throw new Error("SMS_PHONE_UNSUPPORTED");
      const body = new URLSearchParams({
        receptor: "0" + message.phone.slice(3),
        sender: this.sender,
        message: message.text
      });
      const endpoint = "https://api.kavenegar.com/v1/" +
        encodeURIComponent(this.apiKey) + "/sms/send.json";
      const response = await fetch(endpoint, {
        method: "POST", body, cache: "no-store", redirect: "error",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
        signal: AbortSignal.timeout(7_000)
      });
      if (!response.ok) throw new Error("SMS_DELIVERY_FAILED");
      const payload = await response.json() as KavenegarResponse;
      const id = payload.entries?.[0]?.messageid;
      if (payload.return?.status !== 200 || !id) throw new Error("SMS_DELIVERY_FAILED");
      result.push({ reference: message.reference, providerMessageId: String(id) });
    }
    return result;
  }
}

/**
 * Explicit opt-in. Until the operator buys SMS service and sets all three
 * environment variables, authentication stays password-only and no fake
 * "code sent" success is shown to the user.
 */
export function getSmsProvider(): SmsProvider | null {
  if (process.env.SMS_PROVIDER !== "kavenegar") return null;
  const key = process.env.KAVENEGAR_API_KEY?.trim();
  const sender = process.env.KAVENEGAR_SENDER?.trim();
  if (!key || !sender) return null;
  return new KavenegarSmsProvider(key, sender);
}
