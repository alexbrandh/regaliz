/**
 * Enhanced error handling and logging utilities
 * Provides detailed error tracking and user-friendly messages
 */

export interface ErrorContext {
  userId?: string;
  postcardId?: string;
  operation: string;
  timestamp: string;
  userAgent?: string;
  ip?: string;
}

export interface DetailedError {
  code: keyof typeof ERROR_MESSAGES;
  message: string;
  userMessage: string;
  context: ErrorContext;
  originalError?: unknown;
  stack?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Error codes and their user-friendly messages
 */
export const ERROR_MESSAGES = {
  // File validation errors
  INVALID_FILE_TYPE: {
    message: 'Tipo de archivo no válido',
    userMessage: 'Por favor, sube solo archivos JPG, PNG o MP4',
    severity: 'medium' as const
  },
  FILE_TOO_LARGE: {
    message: 'Archivo demasiado grande',
    userMessage: 'El archivo es muy grande. Reduce el tamaño e intenta de nuevo',
    severity: 'medium' as const
  },
  IMAGE_TOO_SMALL: {
    message: 'Imagen muy pequeña para realidad aumentada',
    userMessage: 'La imagen debe tener al menos 800x800 píxeles para funcionar bien en realidad aumentada',
    severity: 'medium' as const
  },
  
  // Storage errors
  STORAGE_UPLOAD_FAILED: {
    message: 'Error al subir archivo a storage',
    userMessage: 'Error al subir el archivo. Verifica tu conexión e intenta de nuevo',
    severity: 'high' as const
  },
  STORAGE_DELETE_FAILED: {
    message: 'Error al eliminar archivo de storage',
    userMessage: 'Error al eliminar el archivo. Contacta soporte si persiste',
    severity: 'medium' as const
  },
  SIGNED_URL_FAILED: {
    message: 'Error al generar URL firmada',
    userMessage: 'Error temporal del servidor. Intenta de nuevo en unos momentos',
    severity: 'high' as const
  },
  
  // Database errors
  DATABASE_CONNECTION_FAILED: {
    message: 'Error de conexión a base de datos',
    userMessage: 'Error de conexión. Intenta de nuevo en unos momentos',
    severity: 'critical' as const
  },
  DATABASE_ERROR: {
    message: 'Error de base de datos',
    userMessage: 'Ocurrió un error al acceder a la base de datos',
    severity: 'high' as const
  },
  POSTCARD_NOT_FOUND: {
    message: 'Postal no encontrada',
    userMessage: 'La postal que buscas no existe o fue eliminada',
    severity: 'medium' as const
  },
  ACCESS_DENIED: {
    message: 'Acceso denegado',
    userMessage: 'No tienes permisos para acceder a esta postal',
    severity: 'medium' as const
  },
  
  // NFT generation errors
  NFT_GENERATION_FAILED: {
    message: 'Error al generar descriptores NFT',
    userMessage: 'Error al procesar la imagen para realidad aumentada. Intenta con una imagen diferente',
    severity: 'high' as const
  },
  NFT_PROCESSING_TIMEOUT: {
    message: 'Timeout en generación de NFT',
    userMessage: 'El procesamiento está tomando más tiempo del esperado. Intenta de nuevo',
    severity: 'high' as const
  },
  
  // Authentication errors
  UNAUTHORIZED: {
    message: 'Usuario no autenticado',
    userMessage: 'Debes iniciar sesión para realizar esta acción',
    severity: 'medium' as const
  },
  INVALID_TOKEN: {
    message: 'Token de autenticación inválido',
    userMessage: 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo',
    severity: 'medium' as const
  },
  
  // Generic errors
  INTERNAL_SERVER_ERROR: {
    message: 'Error interno del servidor',
    userMessage: 'Error interno del servidor. Nuestro equipo ha sido notificado',
    severity: 'critical' as const
  },
  NETWORK_ERROR: {
    message: 'Error de red',
    userMessage: 'Error de conexión. Verifica tu internet e intenta de nuevo',
    severity: 'medium' as const
  },
  VALIDATION_ERROR: {
    message: 'Error de validación',
    userMessage: 'Los datos enviados no son válidos',
    severity: 'medium' as const
  }
} as const;

/**
 * Create a detailed error with context
 */
export function createDetailedError(
  code: keyof typeof ERROR_MESSAGES,
  context: ErrorContext,
  originalError?: unknown
): DetailedError {
  const errorInfo = ERROR_MESSAGES[code];
  
  return {
    code,
    message: errorInfo.message,
    userMessage: errorInfo.userMessage,
    context: {
      ...context,
      timestamp: new Date().toISOString()
    },
    originalError,
    stack: originalError instanceof Error ? originalError.stack : undefined,
    severity: errorInfo.severity
  };
}

/**
 * Log error with appropriate level based on severity
 */
export function logError(error: DetailedError): void {
  const logData = {
    code: error.code,
    message: error.message,
    context: error.context,
    severity: error.severity,
    stack: error.stack
  };
  
  switch (error.severity) {
    case 'critical':
      console.error('[CRITICAL ERROR]', logData);
      // En producción, aquí enviarías a un servicio de monitoreo
      break;
    case 'high':
      console.error('[HIGH ERROR]', logData);
      break;
    case 'medium':
      console.warn('[MEDIUM ERROR]', logData);
      break;
    case 'low':
      console.info('[LOW ERROR]', logData);
      break;
  }
}

/**
 * Handle and log error, return user-friendly response
 */
export function handleError(
  error: unknown,
  context: ErrorContext,
  fallbackCode: keyof typeof ERROR_MESSAGES = 'INTERNAL_SERVER_ERROR'
): { error: DetailedError; response: Response } {
  let detailedError: DetailedError;
  
  // Si ya es un DetailedError, usarlo directamente
  if (isDetailedError(error)) {
    detailedError = error;
  } else {
    // Crear DetailedError basado en el tipo de error
    const code = determineErrorCode(error) || fallbackCode;
    detailedError = createDetailedError(code, context, error);
  }
  
  // Log del error
  logError(detailedError);
  
  // Crear respuesta HTTP apropiada
  const statusCode = getHttpStatusCode(detailedError.code);
  const response = new Response(
    JSON.stringify({
      error: {
        code: detailedError.code,
        message: detailedError.userMessage,
        timestamp: detailedError.context.timestamp
      }
    }),
    {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' }
    }
  );
  
  return { error: detailedError, response };
}

/**
 * Check if an object is a DetailedError
 */
function isDetailedError(obj: unknown): obj is DetailedError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'code' in obj &&
    'message' in obj &&
    'userMessage' in obj &&
    'context' in obj &&
    'severity' in obj
  );
}

/**
 * Determine error code based on error type/message
 */
function determineErrorCode(error: unknown): keyof typeof ERROR_MESSAGES | null {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return 'UNAUTHORIZED';
    }
    if (message.includes('not found')) {
      return 'POSTCARD_NOT_FOUND';
    }
    if (message.includes('access denied') || message.includes('forbidden')) {
      return 'ACCESS_DENIED';
    }
    if (message.includes('network') || message.includes('fetch')) {
      return 'NETWORK_ERROR';
    }
    if (message.includes('validation')) {
      return 'VALIDATION_ERROR';
    }
    if (message.includes('storage') || message.includes('upload')) {
      return 'STORAGE_UPLOAD_FAILED';
    }
  }
  
  return null;
}

/**
 * Get appropriate HTTP status code for error
 */
function getHttpStatusCode(code: keyof typeof ERROR_MESSAGES): number {
  switch (code) {
    case 'UNAUTHORIZED':
    case 'INVALID_TOKEN':
      return 401;
    case 'ACCESS_DENIED':
      return 403;
    case 'POSTCARD_NOT_FOUND':
      return 404;
    case 'INVALID_FILE_TYPE':
    case 'FILE_TOO_LARGE':
    case 'IMAGE_TOO_SMALL':
    case 'VALIDATION_ERROR':
      return 400;
    case 'INTERNAL_SERVER_ERROR':
    case 'DATABASE_CONNECTION_FAILED':
    case 'DATABASE_ERROR':
      return 500;
    case 'STORAGE_UPLOAD_FAILED':
    case 'SIGNED_URL_FAILED':
    case 'NFT_GENERATION_FAILED':
      return 500;
    case 'NFT_PROCESSING_TIMEOUT':
      return 408;
    default:
      return 500;
  }
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  options: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry
  } = options;
  
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts) {
        break;
      }
      
      // Calcular delay con backoff exponencial
      const delay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      );
      
      // Llamar callback de retry si está disponible
      if (onRetry) {
        onRetry(attempt, error);
      } else {
        console.warn(`[RETRY] Attempt ${attempt}/${maxAttempts} failed for ${context.operation}, retrying in ${delay}ms`, error);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Si llegamos aquí, todos los intentos fallaron
  throw lastError;
}