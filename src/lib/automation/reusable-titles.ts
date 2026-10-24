/** Display labels, not stored titles. Never double-prefix previously named assets. */
export function displayReusableAssetTitle(kind: "FORM" | "SHOWCASE", title: string | null | undefined): string {
  const prefix = kind === "FORM" ? "فرم" : "ویترین";
  const clean = (title || "").trim();
  if (!clean) return prefix + " بدون نام";
  return new RegExp("^" + prefix + "(?:\\s|[-—–])").test(clean) ? clean : prefix + " " + clean;
}
