/**
 * Robust validation utilities for AR postcard processing
 * Prevents common errors and ensures data integrity
 */

import { createServerClient } from './supabase';
import { createDetailedError, logError, type ErrorContext } from './error-handler';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: string[];
}

/**
 * Validate image file for AR processing
 */
export interface FileValidationOptions {
  maxSizeMB?: number;
  allowedTypes?: string[];
  minDimensions?: { width: number; height: number };
  maxDimensions?: { width: number; height: number };
}

export async function validateImageFileEnhanced(
  file: File,
  options: FileValidationOptions = {},
  context?: ErrorContext
): Promise<ValidationResult> {
  const {
    maxSizeMB = 10,
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
    minDimensions = { width: 800, height: 800 },
    maxDimensions = { width: 4096, height: 4096 }
  } = options;

  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  try {
    // Check if file exists
    if (!file) {
      errors.push({
        field: 'file',
        message: 'No se proporcionó ningún archivo',
        code: 'FILE_REQUIRED'
      });
      return { isValid: false, errors };
    }

    // Validar tipo de archivo
    if (!allowedTypes.includes(file.type)) {
      errors.push({
        field: 'file',
        message: `Tipo de archivo no permitido. Tipos aceptados: ${allowedTypes.join(', ')}`,
        code: 'INVALID_FILE_TYPE'
      });
    }

    // Validar tamaño
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      errors.push({
        field: 'file',
        message: `El archivo excede el tamaño máximo de ${maxSizeMB}MB (actual: ${sizeMB.toFixed(2)}MB)`,
        code: 'FILE_TOO_LARGE'
      });
    }

    // Check minimum file size (avoid empty files)
    if (file.size < 1024) { // 1KB minimum
      errors.push({
        field: 'file',
        message: 'El archivo es demasiado pequeño o está vacío',
        code: 'FILE_TOO_SMALL'
      });
    }

    // Validar dimensiones
    try {
      const dimensions = await getImageDimensions(file);
      
      if (dimensions.width < minDimensions.width || dimensions.height < minDimensions.height) {
        errors.push({
          field: 'file',
          message: `La imagen es muy pequeña. Mínimo: ${minDimensions.width}x${minDimensions.height}px`,
          code: 'IMAGE_TOO_SMALL'
        });
      }
      
      if (dimensions.width > maxDimensions.width || dimensions.height > maxDimensions.height) {
        errors.push({
          field: 'file',
          message: `La imagen es muy grande. Máximo: ${maxDimensions.width}x${maxDimensions.height}px`,
          code: 'IMAGE_TOO_LARGE'
        });
      }
      
      // Advertencia para imágenes de baja resolución
      if (dimensions.width < 1024 || dimensions.height < 1024) {
        warnings.push('La imagen tiene baja resolución. Para mejores resultados de realidad aumentada, usa imágenes de al menos 1024x1024px.');
      }
    } catch (error) {
      const detailedError = createDetailedError(
        'VALIDATION_ERROR',
        context || { operation: 'validateImageFile', timestamp: new Date().toISOString() },
        error instanceof Error ? error : new Error('Error validating image dimensions')
      );
      logError(detailedError);
      
      errors.push({
        field: 'file',
        message: 'No se pudieron validar las dimensiones de la imagen',
        code: 'DIMENSION_CHECK_FAILED'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    const detailedError = createDetailedError(
      'VALIDATION_ERROR',
      context || { operation: 'validateImageFile', timestamp: new Date().toISOString() },
      error instanceof Error ? error : new Error('Unexpected error during image validation')
    );
    logError(detailedError);
    
    return {
      isValid: false,
      errors: [{
        field: 'file',
        message: 'Error inesperado durante la validación de la imagen',
        code: 'VALIDATION_ERROR'
      }]
    };
  }
}

/**
 * Validate video file for AR processing
 */
export interface VideoValidationOptions {
  maxSizeMB?: number;
  allowedTypes?: string[];
  maxDurationSeconds?: number;
  requiresAudio?: boolean;
}

export async function validateVideoFile(
  file: File,
  options: VideoValidationOptions = {},
  context?: ErrorContext
): Promise<ValidationResult> {
  const {
    maxSizeMB = 100,
    allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
    maxDurationSeconds = 300, // 5 minutes
    requiresAudio = false
  } = options;

  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  try {
    // Check if file exists
    if (!file) {
      errors.push({
        field: 'file',
        message: 'No se proporcionó ningún archivo de video',
        code: 'FILE_REQUIRED'
      });
      return { isValid: false, errors };
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
      errors.push({
        field: 'file',
        message: `Tipo de video no permitido. Tipos aceptados: ${allowedTypes.join(', ')}`,
        code: 'INVALID_FILE_TYPE'
      });
    }

    // Check file size
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      errors.push({
        field: 'file',
        message: `El video excede el tamaño máximo de ${maxSizeMB}MB (actual: ${(file.size / (1024 * 1024)).toFixed(2)}MB)`,
        code: 'FILE_TOO_LARGE'
      });
    }

    // Check minimum file size
    const minSize = 10 * 1024; // 10KB
    if (file.size < minSize) {
      errors.push({
        field: 'file',
        message: 'El archivo de video es muy pequeño o está corrupto',
        code: 'FILE_TOO_SMALL'
      });
    }

    // Validate video properties
    try {
      const videoProperties = await getVideoProperties(file);
      
      // Check duration
      if (videoProperties.duration > maxDurationSeconds) {
        errors.push({
          field: 'file',
          message: `El video es muy largo. Máximo: ${maxDurationSeconds} segundos (actual: ${Math.round(videoProperties.duration)} segundos)`,
          code: 'VIDEO_TOO_LONG'
        });
      }
      
      // Check if audio is required
      if (requiresAudio && !videoProperties.hasAudio) {
        errors.push({
          field: 'file',
          message: 'El video debe contener audio',
          code: 'AUDIO_REQUIRED'
        });
      }
      
      // Warn about very short videos
      if (videoProperties.duration < 1) {
        warnings.push('El video es muy corto (menos de 1 segundo). Considera usar un video más largo para mejor experiencia de realidad aumentada.');
      }
      
      // Warn about high resolution videos
      if (videoProperties.width > 1920 || videoProperties.height > 1080) {
        warnings.push('Video de alta resolución detectado. Puede afectar el rendimiento en dispositivos móviles.');
      }
    } catch (error) {
      const detailedError = createDetailedError(
        'VALIDATION_ERROR',
        context || { operation: 'validateVideoProperties', timestamp: new Date().toISOString() },
        error instanceof Error ? error : new Error('Error validating video properties')
      );
      logError(detailedError);
      
      warnings.push('No se pudieron validar las propiedades del video. El archivo podría estar corrupto.');
    }

    // Warn about large files (aligned with env max size for frontend)
    const ENV_MAX_FILE_SIZE_MB = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '50');
    const recommendedMaxSize = (Number.isFinite(ENV_MAX_FILE_SIZE_MB) ? ENV_MAX_FILE_SIZE_MB : 50) * 1024 * 1024; // MB -> bytes
    if (file.size > recommendedMaxSize) {
      warnings.push('Los videos grandes pueden tardar más en cargar en la vista de realidad aumentada');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    const detailedError = createDetailedError(
      'VALIDATION_ERROR',
      context || { operation: 'validateVideoFile', timestamp: new Date().toISOString() },
      error instanceof Error ? error : new Error('Unexpected error during video validation')
    );
    logError(detailedError);
    
    return {
      isValid: false,
      errors: [{
        field: 'file',
        message: 'Error inesperado durante la validación del video',
        code: 'VALIDATION_ERROR'
      }]
    };
  }
}

/**
 * Validate postcard data before processing
 */
export interface PostcardValidationOptions {
  maxTitleLength?: number;
  maxNoteLength?: number;
  requireTitle?: boolean;
  allowEmptyNote?: boolean;
}

export async function validatePostcardData(
  data: {
    title?: string;
    note?: string;
    userId: string;
  },
  options: PostcardValidationOptions = {},
  context?: ErrorContext
): Promise<ValidationResult> {
  const {
    maxTitleLength = 100,
    maxNoteLength = 500,
    requireTitle = false,
    allowEmptyNote = true
  } = options;

  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  try {
    // Validate user ID
    if (!data.userId || typeof data.userId !== 'string') {
      errors.push({
        field: 'userId',
        message: 'ID de usuario válido es requerido',
        code: 'MISSING_USER_ID'
      });
    } else {
      // Accept UUID v4 or Clerk-style IDs (e.g., "user_abc123...") since DB column is TEXT
      const userIdValidation = validateUserId(data.userId);
      if (!userIdValidation.isValid) {
        errors.push(...userIdValidation.errors);
      }
    }

    // Validate title
    if (requireTitle && (!data.title || data.title.trim().length === 0)) {
      errors.push({
        field: 'title',
        message: 'El título es requerido',
        code: 'TITLE_REQUIRED'
      });
    }

    if (data.title !== undefined) {
      if (typeof data.title !== 'string') {
        errors.push({
          field: 'title',
          message: 'El título debe ser una cadena de texto',
          code: 'INVALID_TITLE_TYPE'
        });
      } else {
        const trimmedTitle = data.title.trim();
        
        if (trimmedTitle.length > maxTitleLength) {
          errors.push({
            field: 'title',
            message: `El título debe tener ${maxTitleLength} caracteres o menos (actual: ${trimmedTitle.length})`,
            code: 'TITLE_TOO_LONG'
          });
        }
        
        // Check for potentially harmful content
        if (containsSuspiciousContent(trimmedTitle)) {
          errors.push({
            field: 'title',
            message: 'El título contiene contenido no permitido',
            code: 'TITLE_SUSPICIOUS_CONTENT'
          });
        }
        
        // Warn about very short titles
        if (trimmedTitle.length > 0 && trimmedTitle.length < 3) {
          warnings.push('El título es muy corto. Considera usar un título más descriptivo.');
        }
      }
    }

    // Validate note
    if (!allowEmptyNote && data.note !== undefined && data.note.trim().length === 0) {
      errors.push({
        field: 'note',
        message: 'La nota no puede estar vacía',
        code: 'NOTE_EMPTY'
      });
    }

    if (data.note !== undefined) {
      if (typeof data.note !== 'string') {
        errors.push({
          field: 'note',
          message: 'La nota debe ser una cadena de texto',
          code: 'INVALID_NOTE_TYPE'
        });
      } else {
        const trimmedNote = data.note.trim();
        
        if (trimmedNote.length > maxNoteLength) {
          errors.push({
            field: 'note',
            message: `La nota debe tener ${maxNoteLength} caracteres o menos (actual: ${trimmedNote.length})`,
            code: 'NOTE_TOO_LONG'
          });
        }
        
        // Check for potentially harmful content
        if (containsSuspiciousContent(trimmedNote)) {
          errors.push({
            field: 'note',
            message: 'La nota contiene contenido no permitido',
            code: 'NOTE_SUSPICIOUS_CONTENT'
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    const detailedError = createDetailedError(
      'VALIDATION_ERROR',
      context || { operation: 'validatePostcardData', timestamp: new Date().toISOString() },
      error instanceof Error ? error : new Error('Unexpected error during postcard data validation')
    );
    logError(detailedError);
    
    return {
      isValid: false,
      errors: [{
        field: 'validation',
        message: 'Error inesperado durante la validación de datos',
        code: 'VALIDATION_ERROR'
      }]
    };
  }
}

/**
 * Validate NFT descriptors
 */
export function validateNFTDescriptors(descriptors: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!descriptors || typeof descriptors !== 'object') {
    errors.push({
      field: 'descriptors',
      message: 'NFT descriptors must be an object',
      code: 'INVALID_DESCRIPTORS_TYPE'
    });
    return { isValid: false, errors };
  }

  // Check required fields
  const requiredFields = ['descriptorUrl', 'generated', 'timestamp', 'files'];
  for (const field of requiredFields) {
    if (!(field in descriptors)) {
      errors.push({
        field,
        message: `Missing required field: ${field}`,
        code: 'MISSING_REQUIRED_FIELD'
      });
    }
  }

  // Validate files object
  const descriptorsObj = descriptors as Record<string, unknown>;
  if (descriptorsObj.files && typeof descriptorsObj.files === 'object') {
    const filesObj = descriptorsObj.files as Record<string, unknown>;
    const requiredFiles = ['iset', 'fset', 'fset3'];
    for (const file of requiredFiles) {
      if (!(file in filesObj)) {
        errors.push({
          field: `files.${file}`,
          message: `Missing required NFT file: ${file}`,
          code: 'MISSING_NFT_FILE'
        });
      } else if (typeof filesObj[file] !== 'string') {
        errors.push({
          field: `files.${file}`,
          message: `NFT file URL must be a string: ${file}`,
          code: 'INVALID_NFT_FILE_URL'
        });
      }
    }
  } else {
    errors.push({
      field: 'files',
      message: 'NFT files object is required',
      code: 'MISSING_FILES_OBJECT'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate postcard exists and belongs to user
 */
export async function validatePostcardAccess(
  postcardId: string,
  userId: string,
  context?: ErrorContext
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  try {
    // First validate UUID format
    const uuidValidation = validateUUID(postcardId, 'postcardId');
    if (!uuidValidation.isValid) {
      return uuidValidation;
    }

    const supabase = createServerClient();
    
    const { data, error } = await (supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            single: () => Promise<{ data: { id: string; user_id: string } | null; error: Error | null }>;
          };
        };
      };
    })
      .from('postcards')
      .select('id, user_id')
      .eq('id', postcardId)
      .single();

    if (error) {
      const detailedError = createDetailedError(
        'DATABASE_ERROR',
        context || { operation: 'validatePostcardAccess', timestamp: new Date().toISOString() },
        new Error(`Database error: ${error.message}`)
      );
      logError(detailedError);
      
      errors.push({
        field: 'database',
        message: 'Error de base de datos al validar el acceso',
        code: 'DATABASE_ERROR'
      });
    } else if (!data) {
      errors.push({
        field: 'postcardId',
        message: 'Postal no encontrada',
        code: 'POSTCARD_NOT_FOUND'
      });
    } else if (data.user_id !== userId) {
      errors.push({
        field: 'userId',
        message: 'Acceso denegado a esta postal',
        code: 'ACCESS_DENIED'
      });
    }
  } catch (error) {
    const detailedError = createDetailedError(
      'VALIDATION_ERROR',
      context || { operation: 'validatePostcardAccess', timestamp: new Date().toISOString() },
      error instanceof Error ? error : new Error('Unexpected error during access validation')
    );
    logError(detailedError);
    
    errors.push({
      field: 'validation',
      message: 'Error inesperado durante la validación de acceso',
      code: 'VALIDATION_ERROR'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get image dimensions from file
 */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Get video properties from file
 */
interface VideoProperties {
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

// Typed extension for vendor-specific HTMLVideoElement properties
interface HTMLVideoElementWithVendorAudio extends HTMLVideoElement {
  mozHasAudio?: boolean;
  webkitAudioDecodedByteCount?: number;
  audioTracks?: { length: number } | undefined;
}

function getVideoProperties(file: File): Promise<VideoProperties> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      
      // Check for audio tracks using typed vendor-specific properties
      const v = video as HTMLVideoElementWithVendorAudio;
      const hasAudio =
        (typeof v.mozHasAudio === 'boolean' && v.mozHasAudio) ||
        (typeof v.webkitAudioDecodedByteCount === 'number' && v.webkitAudioDecodedByteCount > 0) ||
        (typeof v.audioTracks !== 'undefined' && !!v.audioTracks && v.audioTracks.length > 0);
      
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        hasAudio
      });
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video metadata'));
    };
    
    video.src = url;
  });
}

/**
 * Validate UUID format
 */
export function validateUUID(value: string, fieldName: string = 'id'): ValidationResult {
  const errors: ValidationError[] = [];
  
  // UUID v4 regex pattern
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!value || typeof value !== 'string') {
    errors.push({
      field: fieldName,
      message: `${fieldName} is required and must be a string`,
      code: 'MISSING_UUID'
    });
  } else if (!uuidRegex.test(value)) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be a valid UUID`,
      code: 'INVALID_UUID_FORMAT'
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate userId allowing UUID v4 or Clerk-style IDs (user_*)
 */
export function validateUserId(value: string): ValidationResult {
  const errors: ValidationError[] = [];
  if (!value || typeof value !== 'string') {
    errors.push({
      field: 'userId',
      message: 'userId is required and must be a string',
      code: 'MISSING_USER_ID'
    });
  } else {
    const isUuid = validateUUID(value, 'userId').isValid;
    const isClerkId = /^user_[A-Za-z0-9]+$/.test(value);
    if (!isUuid && !isClerkId) {
      errors.push({
        field: 'userId',
        message: 'userId must be a UUID or a valid Clerk user ID (user_*)',
        code: 'INVALID_USER_ID_FORMAT'
      });
    }
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check for suspicious content in text
 */
function containsSuspiciousContent(text: string): boolean {
  const suspiciousPatterns = [
    // Script tags
    /<script[^>]*>.*?<\/script>/gi,
    // HTML tags that could be harmful
    /<(iframe|object|embed|form|input|button)[^>]*>/gi,
    // JavaScript protocols
    /javascript:/gi,
    // Data URLs that could contain scripts
    /data:text\/html/gi,
    // Common XSS patterns
    /on\w+\s*=/gi, // onclick, onload, etc.
    // SQL injection patterns
    /(union|select|insert|update|delete|drop|create|alter)\s+/gi,
    // Excessive special characters (potential encoding attacks)
    /[<>"'&%]{10,}/g
  ];

  return suspiciousPatterns.some(pattern => pattern.test(text));
}

/**
 * Validate URL accessibility with enhanced security checks
 */
export async function validateUrlAccessibility(
  url: string,
  options: {
    allowedDomains?: string[];
    timeout?: number;
    checkSecurity?: boolean;
  } = {}
): Promise<ValidationResult> {
  const {
    allowedDomains = [],
    timeout = 5000,
    checkSecurity = true
  } = options;
  
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  try {
    // Basic URL format validation
    const urlObj = new URL(url);
    
    // Security checks
    if (checkSecurity) {
      // Check for suspicious protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        errors.push({
          field: 'url',
          message: 'Solo se permiten URLs HTTP y HTTPS',
          code: 'INVALID_PROTOCOL'
        });
      }
      
      // Check for localhost/private IPs in production
      if (process.env.NODE_ENV === 'production') {
        const hostname = urlObj.hostname;
        if (hostname === 'localhost' || 
            hostname.startsWith('127.') || 
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
          errors.push({
            field: 'url',
            message: 'No se permiten URLs locales o privadas',
            code: 'PRIVATE_URL_NOT_ALLOWED'
          });
        }
      }
      
      // Check allowed domains
      if (allowedDomains.length > 0 && !allowedDomains.includes(urlObj.hostname)) {
        errors.push({
          field: 'url',
          message: `Dominio no permitido. Dominios permitidos: ${allowedDomains.join(', ')}`,
          code: 'DOMAIN_NOT_ALLOWED'
        });
      }
    }
    
    // If there are security errors, don't proceed with network check
    if (errors.length > 0) {
      return { isValid: false, errors, warnings };
    }
    
    // Try to fetch the URL with HEAD request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Regaliz-Validator/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        errors.push({
          field: 'url',
          message: `URL no accesible: ${response.status} ${response.statusText}`,
          code: 'URL_NOT_ACCESSIBLE'
        });
      }
      
      // Warn about redirects
      if (response.redirected) {
        warnings.push('La URL fue redirigida. Verifica que sea la URL correcta.');
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        errors.push({
          field: 'url',
          message: 'Tiempo de espera agotado al verificar la URL',
          code: 'URL_TIMEOUT'
        });
      } else {
        errors.push({
          field: 'url',
          message: 'Error de red o URL inválida',
          code: 'NETWORK_ERROR'
        });
      }
    }
  } catch {
    errors.push({
      field: 'url',
      message: 'Formato de URL inválido',
      code: 'INVALID_URL_FORMAT'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}