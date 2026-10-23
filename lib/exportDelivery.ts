export type DeliveryResult = "downloaded" | "shared" | "cancelled";

interface DeliveryEnv {
  nav?: Navigator;
  doc?: Document;
}

type ShareNavigator = Navigator & { standalone?: boolean };

/** iOS standalone PWAs ignore the anchor `download` attribute, so share instead. */
function isIosStandalone(nav: ShareNavigator): boolean {
  return /iPad|iPhone|iPod/.test(nav.userAgent) && nav.standalone === true;
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
        throw err;
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
  // Revoke on the next tick so the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return "downloaded";
}
