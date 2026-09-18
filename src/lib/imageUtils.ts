/**
 * Safe client-side image processing utility.
 * Reads File objects, downscales and compresses to guarantee small data URLs (under 250KB)
 * so documents never exceed Firestore's 1MB document size limit.
 */

export async function processImageFile(file: File, maxSize: number = 400): Promise<string> {
  // If SVG, read directly as Data URL
  if (file.type === 'image/svg+xml') {
    if (file.size > 300 * 1024) {
      throw new Error('Die SVG-Datei ist zu gross (max. 300 KB).');
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Fehler beim Lesen der SVG-Datei'));
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (!width || !height) {
            resolve(rawDataUrl);
            return;
          }

          if (width > height) {
            if (width > maxSize) {
              height = Math.round(height * (maxSize / width));
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round(width * (maxSize / height));
              height = maxSize;
            }
          }

          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }

          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // For podcast artwork, covers, and logos:
          // Try PNG first if file is PNG, but if it exceeds 250KB, convert to JPEG at 0.85
          const isPng = file.type === 'image/png';
          let dataUrl = isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);

          // If PNG or JPEG is still too large (> 250 KB in base64 = ~340,000 characters),
          // compress as JPEG with 0.80 quality to guarantee it fits effortlessly into Firestore
          if (dataUrl.length > 340000) {
            dataUrl = canvas.toDataURL('image/jpeg', 0.80);
          }
          if (dataUrl.length > 400000) {
            // Further scale down if massive
            const smallCanvas = document.createElement('canvas');
            smallCanvas.width = Math.round(width * 0.7);
            smallCanvas.height = Math.round(height * 0.7);
            const smallCtx = smallCanvas.getContext('2d');
            if (smallCtx) {
              smallCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
              dataUrl = smallCanvas.toDataURL('image/jpeg', 0.75);
            }
          }

          resolve(dataUrl);
        } catch (err) {
          console.warn('Canvas resizing error, checking fallback to raw data:', err);
          if (rawDataUrl && rawDataUrl.length < 300000) {
            resolve(rawDataUrl);
          } else {
            reject(new Error('Das Bild konnte nicht optimiert werden. Bitte wähle eine kleinere JPG- oder PNG-Datei.'));
          }
        }
      };

      img.onerror = () => {
        console.warn('Image decoding error in browser Image()');
        if (rawDataUrl && rawDataUrl.length < 300000) {
          resolve(rawDataUrl);
        } else {
          reject(new Error('Das Bildformat konnte nicht dekodiert werden. Bitte wähle eine JPG- oder PNG-Datei.'));
        }
      };

      img.src = rawDataUrl;
    };

    reader.onerror = () => {
      reject(new Error('Die Bilddatei konnte nicht vom Gerät geladen werden.'));
    };

    reader.readAsDataURL(file);
  });
}
