/**
 * API middleware for robust validation and error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { ValidationResult, ValidationError } from './validation';
import { logger } from './logger';
import { logNetworkError, startRequestMonitoring, endRequestMonitoring } from './debug-utils';

export interface ApiError {
  message: string;
  code: string;
  field?: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  errors?: ValidationError[];
  warnings?: string[];
}

/**
 * Create standardized API response
 */
export function createApiResponse<T>(
  success: boolean,
  data?: T,
  error?: ApiError,
  errors?: ValidationError[],
  warnings?: string[]
): NextResponse<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success,
    ...(data && { data }),
    ...(error && { error }),
    ...(errors && errors.length > 0 && { errors }),
    ...(warnings && warnings.length > 0 && { warnings })
  };

  const status = success ? 200 : (
    error?.code === 'UNAUTHORIZED' ? 401 :
    error?.code === 'FORBIDDEN' ? 403 :
    error?.code === 'NOT_FOUND' || error?.code === 'POSTCARD_NOT_FOUND' ? 404 :
    error?.code === 'RATE_LIMIT_EXCEEDED' ? 429 :
    error?.code === 'ALREADY_PROCESSING' ? 409 :
    error?.code === 'MISSING_IMAGE' || error?.code === 'MISSING_VIDEO' ? 400 :
    error?.code === 'VALIDATION_ERROR' ? 400 :
    500
  );

  return NextResponse.json(response, { status });
}

/**
 * Create error response from validation result
 */
export function createValidationErrorResponse(
  validationResult: ValidationResult
): NextResponse<ApiResponse> {
  return createApiResponse(
    false,
    undefined,
    {
      message: 'Validation failed',
      code: 'VALIDATION_ERROR'
    },
    validationResult.errors,
    validationResult.warnings
  );
}

/**
 * Middleware to validate authentication
 */
export function withAuth<T>(
  handler: (req: NextRequest, userId: string) => Promise<NextResponse<ApiResponse<T>>>
) {
  return async (req: NextRequest): Promise<NextResponse<ApiResponse<T>>> => {
    try {
      const { userId } = await auth();
      
      if (!userId) {
        return createApiResponse(
          false,
          undefined,
          {
            message: 'Authentication required',
            code: 'UNAUTHORIZED'
          }
        ) as unknown as NextResponse<ApiResponse<T>>;
      }

      return await handler(req, userId);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return createApiResponse(
        false,
        undefined,
        {
          message: 'Authentication error',
          code: 'AUTH_ERROR',
          details: process.env.NODE_ENV === 'development' ? error : undefined
        }
      ) as unknown as NextResponse<ApiResponse<T>>;
    }
  };
}

/**
 * Check if error is network-related
 */
function isNetworkError(error: Error): boolean {
  const networkErrorPatterns = [
    'ERR_ABORTED',
    'ERR_NETWORK',
    'ERR_INTERNET_DISCONNECTED',
    'ERR_CONNECTION_REFUSED',
    'ERR_CONNECTION_RESET',
    'ERR_CONNECTION_TIMED_OUT',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'fetch',
    'network',
    'timeout',
    'aborted'
  ];
  
  const errorMessage = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();
  
  return networkErrorPatterns.some(pattern => 
    errorMessage.includes(pattern.toLowerCase()) || 
    errorName.includes(pattern.toLowerCase())
  );
}

/**
 * Check if error is timeout-related
 */
function isTimeoutError(error: Error): boolean {
  const timeoutPatterns = [
    'timeout',
    'ETIMEDOUT',
    'ERR_CONNECTION_TIMED_OUT',
    'Request timed out'
  ];
  
  const errorMessage = error.message.toLowerCase();
  return timeoutPatterns.some(pattern => 
    errorMessage.includes(pattern.toLowerCase())
  );
}

/**
 * Check if error is abort-related
 */
function isAbortError(error: Error): boolean {
  return error.name === 'AbortError' || 
         error.message.includes('ERR_ABORTED') ||
         error.message.includes('aborted');
}

/**
 * Middleware to handle errors gracefully with improved network error detection
 */
export function withErrorHandling<T>(
  handler: (req: NextRequest, ...args: unknown[]) => Promise<NextResponse<ApiResponse<T>>>
) {
  return async (req: NextRequest, ...args: unknown[]): Promise<NextResponse<ApiResponse<T>>> => {
    const startTime = Date.now();
    const requestId = startRequestMonitoring(req.url, req.method);
    
    try {
      logger.info(`[${requestId}] API Request started: ${req.method} ${req.url}`);
      
      const result = await handler(req, ...args);
      
      const duration = Date.now() - startTime;
      logger.info(`[${requestId}] API Request completed in ${duration}ms`);
      
      endRequestMonitoring(requestId, 'success');
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log network error with debugging utilities
      const errorId = logNetworkError(error, {
        url: req.url,
        method: req.method,
        duration
      });
      
      logger.error(`[${requestId}] API Error after ${duration}ms:`, {
        operation: 'api_request',
        metadata: {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          method: req.method,
          url: req.url,
          userAgent: req.headers.get('user-agent'),
          timestamp: new Date().toISOString(),
          errorId
        }
      });
      
      endRequestMonitoring(requestId, 'error', undefined, error instanceof Error ? error.name : 'unknown');
      
      // Handle specific error types
      if (error instanceof Error) {
        // Abort errors (user cancelled request)
        if (isAbortError(error)) {
          logger.info(`[${requestId}] Request aborted by client`);
          return createApiResponse(
            false,
            undefined,
            {
              message: 'Request was cancelled',
              code: 'REQUEST_ABORTED'
            }
          ) as unknown as NextResponse<ApiResponse<T>>;
        }
        
        // Timeout errors
        if (isTimeoutError(error)) {
          logger.warn(`[${requestId}] Request timed out after ${duration}ms`);
          return createApiResponse(
            false,
            undefined,
            {
              message: 'Request timed out. Please try again.',
              code: 'REQUEST_TIMEOUT'
            }
          ) as unknown as NextResponse<ApiResponse<T>>;
        }
        
        // Network errors
        if (isNetworkError(error)) {
          logger.warn(`[${requestId}] Network error detected: ${errorMessage}`);
          return createApiResponse(
            false,
            undefined,
            {
              message: 'Network error occurred. Please check your connection and try again.',
              code: 'NETWORK_ERROR'
            }
          ) as unknown as NextResponse<ApiResponse<T>>;
        }
        
        // Database errors
        if (error.message.includes('invalid input syntax for type uuid')) {
          return createApiResponse(
            false,
            undefined,
            {
              message: 'Invalid ID format',
              code: 'INVALID_ID_FORMAT'
            }
          ) as unknown as NextResponse<ApiResponse<T>>;
        }
        
        // Supabase specific errors
        if (error.message.includes('JWT') || error.message.includes('auth')) {
          logger.warn(`[${requestId}] Authentication error: ${errorMessage}`);
          return createApiResponse(
            false,
            undefined,
            {
              message: 'Authentication failed. Please sign in again.',
              code: 'AUTH_ERROR'
            }
          ) as unknown as NextResponse<ApiResponse<T>>;
        }
        
        // Rate limit errors
        if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
          logger.warn(`[${requestId}] Rate limit exceeded`);
          return createApiResponse(
            false,
            undefined,
            {
              message: 'Too many requests. Please wait a moment and try again.',
              code: 'RATE_LIMIT_EXCEEDED'
            }
          ) as unknown as NextResponse<ApiResponse<T>>;
        }
      }
      
      // Generic error response - show actual error message for debugging
      logger.error(`[${requestId}] Unhandled error: ${errorMessage}`);
      console.error(`[${requestId}] FULL ERROR:`, error);
      return createApiResponse(
        false,
        undefined,
        {
          message: errorMessage || 'An unexpected error occurred. Please try again.',
          code: 'INTERNAL_ERROR',
          details: {
            requestId,
            errorType: error instanceof Error ? error.name : 'Unknown'
          }
        }
      ) as unknown as NextResponse<ApiResponse<T>>;
    }
  };
}

/**
 * Middleware to validate request method
 */
export function withMethodValidation(
  allowedMethods: string[]
) {
  return function<T>(
    handler: (req: NextRequest, ...args: unknown[]) => Promise<NextResponse<ApiResponse<T>>>
  ) {
    return async (req: NextRequest, ...args: unknown[]): Promise<NextResponse<ApiResponse<T>>> => {
      if (!allowedMethods.includes(req.method)) {
        return createApiResponse(
          false,
          undefined,
          {
            message: `Method ${req.method} not allowed`,
            code: 'METHOD_NOT_ALLOWED'
          }
        ) as unknown as NextResponse<ApiResponse<T>>;
      }
      
      return await handler(req, ...args);
    };
  };
}

/**
 * Middleware to validate request body
 */
export function withBodyValidation<T>(
  validator: (body: unknown) => ValidationResult
) {
  return function<U>(
    handler: (req: NextRequest, body: T, ...args: unknown[]) => Promise<NextResponse<ApiResponse<U>>>
  ) {
    return async (req: NextRequest, ...args: unknown[]): Promise<NextResponse<ApiResponse<U>>> => {
      try {
        const body = await req.json();
        const validation = validator(body);
        
        if (!validation.isValid) {
          return createValidationErrorResponse(validation) as unknown as NextResponse<ApiResponse<U>>;
        }
        
        return await handler(req, body, ...args);
      } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
        return createApiResponse(
          false,
          undefined,
          {
            message: 'Invalid JSON in request body',
            code: 'INVALID_JSON'
          }
        ) as unknown as NextResponse<ApiResponse<U>>;
      }
    };
  };
}

/**
 * Middleware to validate URL parameters
 */
export function withParamValidation(
  validator: (params: Record<string, string>) => ValidationResult
) {
  return function<T>(
    handler: (req: NextRequest, params: Record<string, string>, ...args: unknown[]) => Promise<NextResponse<ApiResponse<T>>>
  ) {
    return async (req: NextRequest, context: { params: Record<string, string> }, ...args: unknown[]): Promise<NextResponse<ApiResponse<T>>> => {
      const validation = validator(context.params);
      
      if (!validation.isValid) {
        return createValidationErrorResponse(validation) as unknown as NextResponse<ApiResponse<T>>;
      }
      
      return await handler(req, context.params, ...args);
    };
  };
}

/**
 * Middleware to add timeout to API requests
 */
export function withTimeout(
  timeoutMs: number = 30000 // 30 seconds default
) {
  return function<T>(
    handler: (req: NextRequest, ...args: unknown[]) => Promise<NextResponse<ApiResponse<T>>>
  ) {
    return async (req: NextRequest, ...args: unknown[]): Promise<NextResponse<ApiResponse<T>>> => {
      const requestId = startRequestMonitoring(req.url, req.method);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);
      
      try {
        // Add abort signal to request if it doesn't have one
        // Node.js fetch requires the duplex: 'half' option when sending a request with a streamed body
        // to avoid: "RequestInit: duplex option is required when sending a body".
        // Build a base Request with our AbortSignal (and duplex when body exists), then wrap as NextRequest.
        const baseInit: RequestInit & { duplex?: 'half' } = {
          signal: controller.signal
        };
        if (req.body) {
          baseInit.duplex = 'half';
        }
        const baseRequest = new Request(req as unknown as Request, baseInit);
        const requestWithTimeout = new NextRequest(baseRequest);
        
        const result = await handler(requestWithTimeout, ...args);
        clearTimeout(timeoutId);
        endRequestMonitoring(requestId, 'success');
        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error instanceof Error && (error.name === 'AbortError' || controller.signal.aborted)) {
          logger.warn(`Request timed out after ${timeoutMs}ms`);
          logNetworkError(error, {
            url: req.url,
            method: req.method
          });
          endRequestMonitoring(requestId, 'error', 408, 'timeout');
          return createApiResponse(
            false,
            undefined,
            {
              message: `Request timed out after ${timeoutMs / 1000} seconds. Please try again.`,
              code: 'REQUEST_TIMEOUT'
            }
          ) as unknown as NextResponse<ApiResponse<T>>;
        }
        
        logNetworkError(error as Error, {
          url: req.url,
          method: req.method
        });
        endRequestMonitoring(requestId, 'error', 500, 'timeout_error');
        throw error;
      }
    };
  };
}

/**
 * Rate limiting middleware (simple in-memory implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function withRateLimit(
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
) {
  return function<T>(
    handler: (req: NextRequest, ...args: unknown[]) => Promise<NextResponse<ApiResponse<T>>>
  ) {
    return async (req: NextRequest, ...args: unknown[]): Promise<NextResponse<ApiResponse<T>>> => {
      const clientIp = req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
      
      const now = Date.now();
      const key = `${clientIp}:${req.url}`;
      
      const current = rateLimitMap.get(key);
      
      if (current && now < current.resetTime) {
        if (current.count >= maxRequests) {
          return createApiResponse(
            false,
            undefined,
            {
              message: 'Too many requests',
              code: 'RATE_LIMIT_EXCEEDED'
            }
          ) as unknown as NextResponse<ApiResponse<T>>;
        }
        current.count++;
      } else {
        rateLimitMap.set(key, {
          count: 1,
          resetTime: now + windowMs
        });
      }
      
      return await handler(req, ...args);
    };
  };
}

/**
 * Compose multiple middlewares
 */
type MiddlewareHandler<T> = (req: NextRequest, ...args: unknown[]) => Promise<NextResponse<ApiResponse<T>>>;
type Middleware<T> = (handler: MiddlewareHandler<T>) => MiddlewareHandler<T>;

export function compose<T>(
  ...middlewares: Array<Middleware<T>>
) {
  return (handler: (req: NextRequest, ...args: unknown[]) => Promise<NextResponse<ApiResponse<T>>>) => {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    return middlewares.reduceRight((acc, middleware) => {
      if (typeof middleware !== 'function') {
        throw new Error('Middleware must be a function');
      }
      const result = middleware(acc);
      if (typeof result !== 'function') {
        throw new Error('Middleware must return a function');
      }
      return result;
    }, handler);
  };
}