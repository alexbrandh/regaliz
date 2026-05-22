import QRCode from 'qrcode';

export interface QROverlayOptions {
  sizeRatio?: number;
  marginRatio?: number;
  bgPaddingRatio?: number;
  cornerRadiusRatio?: number;
}

const DEFAULTS = {
  sizeRatio: 0.18,
  marginRatio: 0.04,
  bgPaddingRatio: 0.08,
  cornerRadiusRatio: 0.18,
} as const;

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function addQRCodeToImageFile(
  imageFile: File,
  qrUrl: string,
  options?: QROverlayOptions
): Promise<File> {
  const sizeRatio = options?.sizeRatio ?? DEFAULTS.sizeRatio;
  const marginRatio = options?.marginRatio ?? DEFAULTS.marginRatio;
  const bgPaddingRatio = options?.bgPaddingRatio ?? DEFAULTS.bgPaddingRatio;
  const cornerRadiusRatio = options?.cornerRadiusRatio ?? DEFAULTS.cornerRadiusRatio;

  const originalUrl = URL.createObjectURL(imageFile);
  let baseImg: HTMLImageElement;
  try {
    baseImg = await loadImageElement(originalUrl);
  } finally {
    URL.revokeObjectURL(originalUrl);
  }

  const canvas = document.createElement('canvas');
  canvas.width = baseImg.naturalWidth;
  canvas.height = baseImg.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }
  ctx.drawImage(baseImg, 0, 0);

  const minDim = Math.min(canvas.width, canvas.height);
  const qrSize = Math.max(80, Math.round(minDim * sizeRatio));
  const bgPadding = Math.max(6, Math.round(qrSize * bgPaddingRatio));
  const margin = Math.max(8, Math.round(minDim * marginRatio));
  const boxSize = qrSize + bgPadding * 2;

  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: qrSize,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#FFFFFF' },
  });
  const qrImg = await loadImageElement(qrDataUrl);

  const x = canvas.width - margin - boxSize;
  const y = canvas.height - margin - boxSize;
  const radius = Math.round(bgPadding * cornerRadiusRatio * 6);

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
  ctx.shadowBlur = Math.max(4, Math.round(qrSize * 0.05));
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.max(2, Math.round(qrSize * 0.02));
  ctx.fillStyle = '#FFFFFF';
  drawRoundedRect(ctx, x, y, boxSize, boxSize, radius);
  ctx.fill();
  ctx.restore();

  ctx.drawImage(qrImg, x + bgPadding, y + bgPadding, qrSize, qrSize);

  const isJpeg = imageFile.type === 'image/jpeg' || imageFile.type === 'image/jpg';
  const mime = isJpeg ? 'image/jpeg' : 'image/png';
  const quality = isJpeg ? 0.9 : undefined;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to encode image with QR'))),
      mime,
      quality
    );
  });

  return new File([blob], imageFile.name, { type: mime });
}

export function buildArExperienceUrl(postcardId: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/ar/${postcardId}`;
  }
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://regaliz.vercel.app').replace(/\/+$/, '');
  return `${base}/ar/${postcardId}`;
}
