export function safeAdminReturnTo(value: string | null | undefined, fallback = "/admin") {
  if (!value || value.length > 300) {
    return fallback;
  }
  if (!/^\/admin(?:$|[/?#])/.test(value)) {
    return fallback;
  }
  if (value.includes("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) {
    return fallback;
  }
  return value;
}
