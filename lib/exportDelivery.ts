export type DeliveryResult = "downloaded" | "shared" | "cancelled";

interface DeliveryEnv {
  nav?: Navigator;
  doc?: Document;
}

type ShareNavigator = Navigator & { standalone?: boolean };

/** Keep the blob URL alive long enough for slow browsers to start fetching it. */
const REVOKE_DELAY_MS = 60_000;

/**
 * iOS standalone PWAs ignore the anchor `download` attribute, so share instead.
 * iPadOS 13+ reports a Macintosh user agent, so detect it by touch support.
 */
function isIosStandalone(nav: ShareNavigator): boolean {
  const iosUa = /iPad|iPhone|iPod/.test(nav.userAgent);
  const ipadOs = nav.platform === "MacIntel" && nav.maxTouchPoints > 1;
  return (iosUa || ipadOs) && nav.standalone === true;
}

/**
 * Hand a generated file to the user: Web Share on iOS standalone (when file
 * sharing is supported), otherwise a temporary `<a download>` click.
 * Dismissing the share sheet (AbortError) resolves "cancelled", not an error.
 */
export async function deliverFile(
  blob: Blob,
  fileName: string,
  env: DeliveryEnv = {}
): Promise<DeliveryResult> {
  const nav = (env.nav ?? navigator) as ShareNavigator;
  const doc = env.doc ?? document;

  if (isIosStandalone(nav) && nav.share && nav.canShare) {
    const file = new File([blob], fileName, { type: blob.type });
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file] });
        return "shared";
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return "cancelled";
        // Share can fail once transient activation is gone (async work before
        // delivery); fall through to the anchor download instead of erroring.
      }
    }
  }

  if (typeof URL.createObjectURL !== "function") {
    throw new Error("No se pudo iniciar la descarga en este dispositivo.");
  }

  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  return "downloaded";
}
