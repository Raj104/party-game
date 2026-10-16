/** Reliable copy for localhost, HTTPS, and HTTP LAN testing (phones / TV).
 * The standard Clipboard API is normally unavailable on insecure HTTP origins.
 * The legacy selection path works in many browsers; manual copy is the last resort.
 */
export type CopyResult = "copied" | "manual" | "cancelled";

export async function copyWithFallback(value: string, label: string): Promise<CopyResult> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return "copied";
    } catch {
      // Permission denied or API blocked: use the fallback below.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.readOnly = true;
  textArea.setAttribute("aria-hidden", "true");
  textArea.style.position = "fixed";
  textArea.style.top = "0";
  textArea.style.left = "-9999px";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  let copied = false;
  try {
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, textArea.value.length);
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    textArea.remove();
  }
  if (copied) return "copied";

  // Some mobile browsers block both copy methods on an HTTP page.
  // Display the exact value so it can still be selected/copied manually.
  try {
    const response = window.prompt(`Copy ${label} manually:`, value);
    return response === null ? "cancelled" : "manual";
  } catch {
    return "cancelled";
  }
}
