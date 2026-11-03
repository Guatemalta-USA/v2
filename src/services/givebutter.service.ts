import QRCode from 'qrcode';

export function initGivebutter(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="givebutter.com"]')) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://widgets.givebutter.com/latest.umd.cjs?acct=${import.meta.env.VITE_GIVEBUTTER_ACCOUNT_ID}`;
    script.async = true;

    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Givebutter script.'));
    
    document.head.appendChild(script);
  });
}

/**
 * Generates a QR Code canvas with a logo centered inside it.
 */
export async function createDonateQRCodeWithLogo(url: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');

    QRCode.toCanvas(canvas, `https://www.guatemaltausa.org/donate?id=${url}`, { errorCorrectionLevel: 'H', width: 300, margin: 1 }, (error) => {
      if (error) return reject(error);

      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Could not get 2D context'));

      const logo = new Image();
      logo.src = "https://raw.githubusercontent.com/Guatemalta-USA/GuatemaltaUSA/refs/heads/main/images/icon-only.png";
      logo.crossOrigin = 'anonymous';

      logo.onload = () => {
        const qrSize = canvas.width;
        const safePercent = Math.min(30) / 100;
        const logoSize = qrSize * safePercent;
        
        const x = (qrSize - logoSize) / 2;
        const y = (qrSize - logoSize) / 2;

        ctx.drawImage(logo, x, y, logoSize, logoSize);

        resolve(canvas);
      };

      logo.onerror = (err) => {
        reject(new Error('Failed to load logo image: ' + err));
      };
    });
  });
}

export async function createQRCodeWithLogo(url: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');

    QRCode.toCanvas(canvas, url, { errorCorrectionLevel: 'H', width: 300, margin: 1 }, (error) => {
      if (error) return reject(error);

      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Could not get 2D context'));

      const logo = new Image();
      logo.src = "https://raw.githubusercontent.com/Guatemalta-USA/GuatemaltaUSA/refs/heads/main/images/icon-only.png";
      logo.crossOrigin = 'anonymous';

      logo.onload = () => {
        const qrSize = canvas.width;
        const safePercent = Math.min(30) / 100;
        const logoSize = qrSize * safePercent;
        
        const x = (qrSize - logoSize) / 2;
        const y = (qrSize - logoSize) / 2;

        ctx.drawImage(logo, x, y, logoSize, logoSize);

        resolve(canvas);
      };

      logo.onerror = (err) => {
        reject(new Error('Failed to load logo image: ' + err));
      };
    });
  });
}