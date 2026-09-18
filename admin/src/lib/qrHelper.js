import qrcode from './qrcode-raw.js';

/**
 * Generate an SVG string representing the QR code.
 * @param {string} text - The QR payload (e.g. tableflow://table?token=...)
 * @param {object} options - Configuration options
 * @returns {string} SVG markup string
 */
export function getQRCodeSvg(text, { cellSize = 6, margin = 12, scalable = true } = {}) {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({
      cellSize,
      margin,
      scalable,
    });
  } catch (error) {
    console.error('Failed to generate QR code SVG:', error);
    return '';
  }
}

/**
 * Generate a Data URL (base64 GIF/PNG data URI) for quick image embedding.
 * @param {string} text - The QR payload
 * @param {object} options - Configuration options
 * @returns {string} Data URL string
 */
export function getQRCodeDataUrl(text, { cellSize = 6, margin = 12 } = {}) {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createDataURL(cellSize, margin);
  } catch (error) {
    console.error('Failed to generate QR code Data URL:', error);
    return '';
  }
}

/**
 * Trigger browser download of an SVG QR Code as a PNG image.
 */
export function downloadQRCodeImage(svgString, filename = 'table-qr.png') {
  if (typeof window === 'undefined' || !svgString) return;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) return;

  const viewBox = svgEl.getAttribute('viewBox');
  let width = 600;
  let height = 600;
  if (viewBox) {
    const parts = viewBox.split(/\s+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      width = parts[2] * 4;
      height = parts[3] * 4;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const img = new Image();
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    // Fill white background for print and scan contrast
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);

    const a = document.createElement('a');
    a.download = filename;
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  img.src = url;
}
