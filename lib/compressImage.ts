const MAX_DIMENSION = 1800;
const QUALITY = 0.82;
const MAX_BYTES = 4 * 1024 * 1024;

export async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas toBlob failed"));
            return;
          }
          if (blob.size > MAX_BYTES) {
            // Second pass at lower quality if still too large
            canvas.toBlob(
              (blob2) => {
                resolve(new File([blob2 ?? blob], file.name, { type: "image/jpeg" }));
              },
              "image/jpeg",
              0.6
            );
          } else {
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          }
        },
        "image/jpeg",
        QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
