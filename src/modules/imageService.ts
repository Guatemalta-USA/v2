const WORKER_URL = "https://photo-upload.guatemaltausa.workers.dev";

export interface ResizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 to 1.0
  format?: 'image/webp' | 'image/jpeg' | 'image/png';
}

/**
 * Resizes and compresses an image using modern browser APIs.
 */
export async function resizeImage(
  file: File, 
  options: ResizeOptions = {}
): Promise<Blob> {
  const { 
    maxWidth = 800, 
    maxHeight = 800, 
    quality = 0.85, 
    format = 'image/jpeg' 
  } = options;

  // Use createImageBitmap for optimal performance & lower memory overhead
  const imageBitmap = await createImageBitmap(file);

  let { width, height } = imageBitmap;

  // Calculate new dimensions keeping aspect ratio
  if (width > height) {
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
  } else {
    if (height > maxHeight) {
      width = Math.round((width * maxHeight) / height);
      height = maxHeight;
    }
  }

  // Draw to offscreen/standard canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    imageBitmap.close();
    throw new Error("Failed to acquire 2D context from canvas");
  }

  // Use higher-quality image scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imageBitmap, 0, 0, width, height);

  // Close bitmap to free GPU memory
  imageBitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas compression to Blob failed"));
        }
      },
      format,
      quality
    );
  });
}

/**
 * Uploads an image file or blob to Cloudflare R2 via Worker.
 */
export async function uploadImage(image: Blob | File, customFormat: string = "image/jpeg"): Promise<string> {
  const contentType = image.type || customFormat;

  const response = await fetch(WORKER_URL, {
    method: "POST",
    body: image,
    headers: {
      "Content-Type": contentType,
    },
  });

  if (!response.ok) {
    let errorMessage = "Failed to upload image to Cloudflare R2";
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // Fallback if worker returned plain text or HTML error
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  if (!data.url) {
    throw new Error("Cloudflare Worker response missing expected 'url' field");
  }

  return data.url;
}

/**
 * Deletes an image from Cloudflare R2 by filename or full URL.
 */
export async function deleteImage(photoURL: string): Promise<void> {
  if (!photoURL) return;

  // Extract raw filename if full URL passed
  const filename = photoURL.split("/").pop();

  if (!filename) {
    throw new Error("Could not parse valid filename from URL");
  }

  const response = await fetch(`${WORKER_URL}?filename=${encodeURIComponent(filename)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    let errorMessage = `Failed to delete image: ${filename}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // Fallback
    }
    throw new Error(errorMessage);
  }

  console.log(`Successfully deleted image from R2: ${filename}`);
}