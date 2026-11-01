/** Normalize Persian/Arabic keyboard numerals without changing stored credentials. */
export function asciiDigits(input: string): string {
  return input.replace(/[\u06f0-\u06f9\u0660-\u0669]/g, digit => {
    const code = digit.charCodeAt(0);
    return String.fromCharCode(48 + (code >= 0x06f0 ? code - 0x06f0 : code - 0x0660));
  });
}

/** Canonical E.164 identifier. Iranian local 09... numbers are first-class. */
export function normalizePhone(input: string): string | null {
  let value = asciiDigits(input).trim().replace(/[\s()\-]/g, "");
  if (value.startsWith("00")) value = "+" + value.slice(2);
  if (/^09\d{9}$/.test(value)) value = "+98" + value.slice(1);
  else if (/^9\d{9}$/.test(value)) value = "+98" + value;
  else if (/^989\d{9}$/.test(value)) value = "+" + value;
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : null;
}

export function validatePassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 8 && password.length <= 128 &&
    /[A-Za-z\u0600-\u06ff]/.test(password) && /\d/.test(asciiDigits(password));
}

export function internalEmailForPhone(phone: string): string {
  // This identifier fills a legacy required email column, is never presented
  // as a contact address, and is never used for message delivery.
  return "phone-" + phone.slice(1) + "@accounts.daira.invalid";
}
