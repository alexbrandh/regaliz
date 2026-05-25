/** Compile a MindAR .mind target in the browser using the public CDN bundle. */
export async function compileMindARInBrowser(
  imageFile: File,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const Compiler = await loadCompiler();

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    const objectUrl = URL.createObjectURL(imageFile);
    i.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(i);
    };
    i.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Error cargando imagen'));
    };
    i.src = objectUrl;
  });

  const canvas = document.createElement('canvas');
  let { width, height } = img;
  const maxSize = 1024;
  if (width > maxSize || height > maxSize) {
    if (width > height) {
      height = Math.round((height * maxSize) / width);
      width = maxSize;
    } else {
      width = Math.round((width * maxSize) / height);
      height = maxSize;
    }
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo obtener canvas context');
  ctx.drawImage(img, 0, 0, width, height);

  const compiler = new Compiler();
  await compiler.compileImageTargets([canvas], (progress: number) => {
    onProgress?.(progress);
  });

  const exportedData = await compiler.exportData();
  return new Blob([exportedData], { type: 'application/octet-stream' });
}

interface MindARCompiler {
  compileImageTargets: (
    canvases: HTMLCanvasElement[],
    onProgress: (progress: number) => void
  ) => Promise<unknown>;
  exportData: () => Promise<ArrayBuffer>;
}

interface MindARCompilerCtor {
  new (): MindARCompiler;
}

declare global {
  interface Window {
    __MindARCompiler?: MindARCompilerCtor;
  }
}

async function loadCompiler(): Promise<MindARCompilerCtor> {
  if (window.__MindARCompiler) return window.__MindARCompiler;

  return new Promise((resolve, reject) => {
    const moduleScript = document.createElement('script');
    moduleScript.type = 'module';
    moduleScript.textContent = `
      import { Compiler } from 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js';
      window.__MindARCompiler = Compiler;
      window.dispatchEvent(new CustomEvent('mindar-compiler-ready'));
    `;
    const timeout = setTimeout(() => {
      moduleScript.remove();
      reject(new Error('Timeout cargando compilador MindAR'));
    }, 30000);

    const handleReady = () => {
      clearTimeout(timeout);
      window.removeEventListener('mindar-compiler-ready', handleReady);
      const C = window.__MindARCompiler;
      if (C) resolve(C);
      else reject(new Error('Compilador MindAR no encontrado'));
    };
    window.addEventListener('mindar-compiler-ready', handleReady);
    document.head.appendChild(moduleScript);
  });
}
