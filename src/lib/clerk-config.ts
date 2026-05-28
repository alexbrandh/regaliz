import type { Appearance } from '@clerk/types';
import type { LocalizationResource } from '@clerk/types';

export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: '#F47B6B',
    colorBackground: '#FAF8F5',
    colorText: '#1a1a1a',
    borderRadius: '12px',
  },
  elements: {
    card: 'shadow-xl border-0',
    headerTitle: 'text-foreground',
    headerSubtitle: 'text-muted-foreground',
    socialButtonsBlockButton: 'border border-border hover:bg-muted',
    formButtonPrimary: 'bg-primary hover:bg-primary/90',
    footerActionLink: 'text-primary hover:text-primary/80',
  },
  layout: {
    socialButtonsPlacement: 'top',
    socialButtonsVariant: 'blockButton',
  },
};

export const clerkLocalization: LocalizationResource = {
  locale: 'es-ES',
  socialButtonsBlockButton: 'Continuar con {{provider|titleize}}',
  dividerText: 'o',
  formFieldLabel__emailAddress: 'Correo electrónico',
  formFieldLabel__password: 'Contraseña',
  formFieldLabel__firstName: 'Nombre',
  formFieldLabel__lastName: 'Apellido',
  formFieldLabel__username: 'Usuario',
  formFieldLabel__confirmPassword: 'Confirmar contraseña',
  formFieldLabel__currentPassword: 'Contraseña actual',
  formFieldLabel__newPassword: 'Nueva contraseña',
  formFieldInputPlaceholder__emailAddress: 'tu@correo.com',
  formFieldInputPlaceholder__password: 'Tu contraseña',
  formFieldAction__forgotPassword: '¿Olvidaste tu contraseña?',
  formButtonPrimary: 'Continuar',
  backButton: 'Atrás',
  signIn: {
    start: {
      title: 'Iniciar sesión en Regaliz',
      subtitle: '¡Bienvenido! Por favor inicia sesión para continuar',
      actionText: '¿No tienes cuenta?',
      actionLink: 'Regístrate',
    },
    password: {
      title: 'Introduce tu contraseña',
      subtitle: 'Para continuar en Regaliz',
      actionLink: 'Usar otro método',
    },
    forgotPassword: {
      title: 'Restablecer contraseña',
      subtitle_email: 'Te enviaremos un enlace por correo',
    },
  },
  signUp: {
    start: {
      title: 'Crear cuenta en Regaliz',
      subtitle: 'Crea tu cuenta para empezar',
      actionText: '¿Ya tienes cuenta?',
      actionLink: 'Inicia sesión',
    },
  },
  userButton: {
    action__signOut: 'Cerrar sesión',
    action__manageAccount: 'Gestionar cuenta',
    action__addAccount: 'Añadir cuenta',
  },
  userProfile: {
    start: {
      headerTitle__account: 'Cuenta',
      headerTitle__security: 'Seguridad',
    },
  },
};
