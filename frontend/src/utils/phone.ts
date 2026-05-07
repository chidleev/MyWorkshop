const PHONE_DIGITS_LENGTH = 11;

export function extractPhoneDigits(raw: string) {
  return raw.replace(/\D/g, "").replace(/^8/, "7").slice(0, PHONE_DIGITS_LENGTH);
}

export function formatPhoneFromDigits(digitsRaw: string) {
  const digits = extractPhoneDigits(digitsRaw);
  if (!digits.length) {
    return "";
  }

  const normalized = digits.startsWith("7") ? digits : `7${digits}`.slice(0, PHONE_DIGITS_LENGTH);
  const code = normalized.slice(1, 4);
  const first = normalized.slice(4, 7);
  const second = normalized.slice(7, 9);
  const third = normalized.slice(9, 11);

  let result = "+7";
  if (code) {
    result += ` (${code}`;
    if (code.length === 3) {
      result += ")";
    }
  }
  if (first) {
    result += ` ${first}`;
  }
  if (second) {
    result += `-${second}`;
  }
  if (third) {
    result += `-${third}`;
  }

  return result;
}

export function normalizePhoneInput(raw: string, previousValue = "", inputType?: string) {
  const previousDigits = extractPhoneDigits(previousValue);
  let nextDigits = extractPhoneDigits(raw);

  if (inputType?.startsWith("delete") && nextDigits === previousDigits && previousDigits.length > 1) {
    nextDigits = previousDigits.slice(0, -1);
  }

  return formatPhoneFromDigits(nextDigits);
}

export function isValidRuPhone(raw: string) {
  const digits = extractPhoneDigits(raw);
  return digits.length === PHONE_DIGITS_LENGTH && digits.startsWith("7");
}
