'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  Loader2,
  X,
  Smartphone,
  Wifi,
  Shield,
  Clock,
  ImageIcon,
  Video,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type UploadStep =
  | 'idle'
  | 'converting-video'
  | 'creating'
  | 'uploading-image'
  | 'uploading-video'
  | 'generating-nft'
  | 'uploading-nft'
  | 'completed';

interface StepConfig {
  label: string;
  description: string;
  icon: React.ReactNode;
  estimatedTime: string;
}

const STEPS_CONFIG: Record<Exclude<UploadStep, 'idle'>, StepConfig> = {
  'converting-video': {
    label: 'Convirtiendo video',
    description: 'Optimizando formato del video...',
    icon: <RefreshCw className="h-4 w-4" />,
    estimatedTime: '~30 seg',
  },
  creating: {
    label: 'Preparando postal',
    description: 'Registrando tu postal...',
    icon: <Sparkles className="h-4 w-4" />,
    estimatedTime: '~5 seg',
  },
  'uploading-image': {
    label: 'Subiendo imagen',
    description: 'Enviando imagen al servidor...',
    icon: <ImageIcon className="h-4 w-4" />,
    estimatedTime: '~10 seg',
  },
  'uploading-video': {
    label: 'Subiendo video',
    description: 'Enviando video al servidor...',
    icon: <Video className="h-4 w-4" />,
    estimatedTime: '~1-3 min',
  },
  'generating-nft': {
    label: 'Generando experiencia de realidad aumentada',
    description: 'Compilando tracking de imagen...',
    icon: <Sparkles className="h-4 w-4" />,
    estimatedTime: '~30 seg',
  },
  'uploading-nft': {
    label: 'Finalizando',
    description: 'Subiendo datos de realidad aumentada...',
    icon: <Shield className="h-4 w-4" />,
    estimatedTime: '~5 seg',
  },
  completed: {
    label: '¡Postal creada!',
    description: 'Tu postal de realidad aumentada está lista',
    icon: <CheckCircle className="h-4 w-4" />,
    estimatedTime: '',
  },
};

const ORDERED_STEPS: Exclude<UploadStep, 'idle'>[] = [
  'converting-video',
  'creating',
  'uploading-image',
  'uploading-video',
  'generating-nft',
  'completed',
];

// Steps that may be skipped (e.g., conversion only happens for non-mp4)
const SKIPPABLE_STEPS = new Set(['converting-video', 'uploading-nft']);

interface UploadProgressOverlayProps {
  currentStep: UploadStep;
  overallProgress: number;
  uploadProgress: number;
  compilationProgress: number;
  conversionPercent: number;
  videoSizeMB: number;
  canCancel: boolean;
  isCancelling: boolean;
  onCancel: () => void;
  hasConversion: boolean;
}

export function UploadProgressOverlay({
  currentStep,
  overallProgress,
  uploadProgress,
  compilationProgress,
  conversionPercent,
  videoSizeMB,
  canCancel,
  isCancelling,
  onCancel,
  hasConversion,
}: UploadProgressOverlayProps) {
  // Prevent page close/refresh during upload
  useEffect(() => {
    if (currentStep === 'idle') return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (currentStep !== 'completed') {
        e.preventDefault();
        e.returnValue = 'Tu postal se está creando. ¿Seguro que quieres salir?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentStep]);

  // Estimate total time based on video size
  const getEstimatedTotalTime = useCallback(() => {
    if (videoSizeMB > 150) return '3-5 minutos';
    if (videoSizeMB > 50) return '1-3 minutos';
    return '1-2 minutos';
  }, [videoSizeMB]);

  // Get sub-progress for the current step
  const getStepSubProgress = useCallback(
    (step: Exclude<UploadStep, 'idle'>): number | null => {
      if (step !== currentStep) return null;
      switch (step) {
        case 'converting-video':
          return conversionPercent;
        case 'uploading-image':
        case 'uploading-video':
          return uploadProgress;
        case 'generating-nft':
          return compilationProgress;
        default:
          return null;
      }
    },
    [currentStep, conversionPercent, uploadProgress, compilationProgress]
  );

  // Determine step status
  const getStepStatus = useCallback(
    (step: Exclude<UploadStep, 'idle'>): 'pending' | 'active' | 'completed' | 'skipped' => {
      const currentIdx = ORDERED_STEPS.indexOf(currentStep as Exclude<UploadStep, 'idle'>);
      const stepIdx = ORDERED_STEPS.indexOf(step);

      if (step === 'completed' && currentStep === 'completed') return 'completed';
      if (step === 'completed') return 'pending';

      // Skip conversion step if not needed
      if (!hasConversion && step === 'converting-video') return 'skipped';

      if (stepIdx < currentIdx) return 'completed';
      if (stepIdx === currentIdx) return 'active';
      return 'pending';
    },
    [currentStep, hasConversion]
  );

  // Filter visible steps (exclude skipped ones from display)
  const visibleSteps = ORDERED_STEPS.filter((step) => {
    if (!hasConversion && step === 'converting-video') return false;
    if (step === 'uploading-nft') return false; // Merged into generating-nft visually
    return true;
  });

  if (currentStep === 'idle') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-9999 flex items-center justify-center bg-background/95 backdrop-blur-sm"
      >
        <div className="w-full max-w-md mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
            className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-foreground">
                  {currentStep === 'completed' ? '¡Listo!' : 'Creando tu postal de realidad aumentada'}
                </h2>
                {canCancel && currentStep !== 'completed' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onCancel}
                    disabled={isCancelling}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    {isCancelling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              {currentStep !== 'completed' && (
                <p className="text-sm text-muted-foreground">
                  Tiempo estimado: <span className="font-medium">{getEstimatedTotalTime()}</span>
                </p>
              )}
            </div>

            {/* Main progress bar */}
            <div className="px-6 pb-4">
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${overallProgress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className={`h-full rounded-full transition-colors duration-300 ${
                    currentStep === 'completed'
                      ? 'bg-emerald-500'
                      : 'bg-linear-to-r from-primary to-primary/80'
                  }`}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-muted-foreground">Progreso general</span>
                <span className="text-xs font-semibold text-foreground">
                  {Math.round(overallProgress)}%
                </span>
              </div>
            </div>

            {/* Steps list */}
            <div className="px-6 pb-2">
              <div className="space-y-1">
                {visibleSteps.map((step, index) => {
                  const config = STEPS_CONFIG[step];
                  const status = getStepStatus(step);
                  const subProgress = getStepSubProgress(step);

                  if (status === 'skipped') return null;

                  return (
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all duration-300 ${
                        status === 'active'
                          ? 'bg-primary/10 border border-primary/20'
                          : status === 'completed'
                            ? 'opacity-60'
                            : 'opacity-40'
                      }`}
                    >
                      {/* Step icon */}
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-all duration-300 ${
                          status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-500'
                            : status === 'active'
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {status === 'completed' ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </motion.div>
                        ) : status === 'active' ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                          >
                            <Loader2 className="h-4 w-4" />
                          </motion.div>
                        ) : (
                          config.icon
                        )}
                      </div>

                      {/* Step info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-sm font-medium truncate ${
                              status === 'active' ? 'text-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            {config.label}
                          </span>
                          {status === 'active' && subProgress !== null && (
                            <span className="text-xs font-semibold text-primary ml-2">
                              {Math.round(subProgress)}%
                            </span>
                          )}
                          {status === 'pending' && config.estimatedTime && (
                            <span className="text-xs text-muted-foreground/60 ml-2 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {config.estimatedTime}
                            </span>
                          )}
                        </div>
                        {status === 'active' && (
                          <>
                            <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                            {subProgress !== null && (
                              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${subProgress}%` }}
                                  transition={{ duration: 0.3, ease: 'easeOut' }}
                                  className="h-full rounded-full bg-primary"
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Warning / Completed message */}
            <div className="px-6 pb-6 pt-2">
              {currentStep === 'completed' ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 0.2 }}
                  >
                    <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                  </motion.div>
                  <div>
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      ¡Tu postal de realidad aumentada está lista!
                    </p>
                    <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                      Redirigiendo al panel...
                    </p>
                  </div>
                </motion.div>
              ) : (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <Smartphone className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      No cierres esta pantalla
                    </p>
                    <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-0.5">
                      Mantén la app abierta y con conexión a internet hasta que se complete el proceso.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
