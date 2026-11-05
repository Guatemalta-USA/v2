import QRCode from 'qrcode';
import { createGiveButterWidget } from '../modules/utils';

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

export function openGivebutterModal(widgetId: string) {
    if (document.getElementById('gb-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'gb-modal-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.75); display: flex; align-items: center;
        justify-content: center; z-index: 99999; backdrop-filter: blur(4px);
        padding: 20px; box-sizing: border-box;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        position: relative; background: #ffffff; width: 90%; max-width: 500px;
        max-height: 90vh; overflow-y: auto;
        padding: 24px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close modal');
    closeBtn.style.cssText = `
        position: absolute; top: 12px; right: 16px; background: none;
        border: none; font-size: 28px; cursor: pointer; color: #6b7280; line-height: 1; z-index: 1;
    `;

    const closeModal = () => {
        window.removeEventListener("keydown", handleKeyDown);
        document.body.classList.remove("noScroll");
        if (document.body.contains(overlay)) {
            overlay.remove();
        }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
            closeModal();
            return;
        }

        if (event.key === "Tab") {
            const focusableElements = modalContent.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), givebutter-widget'
            );
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (event.shiftKey) {
                if (document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement.focus();
                }
            }
        }
    };

    window.addEventListener("keydown", handleKeyDown);

    closeBtn.onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

    const liveWidget = createGiveButterWidget(widgetId, "button");

    modalContent.appendChild(closeBtn);
    modalContent.appendChild(liveWidget);
    overlay.appendChild(modalContent);

    document.body.classList.add("noScroll");
    document.body.appendChild(overlay);

    const gb = (window as any).Givebutter;
    if (gb && typeof gb.init === 'function') {
        gb.init();
    }

    closeBtn.focus();
}