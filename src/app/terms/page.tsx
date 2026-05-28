import type { Metadata } from 'next';
import { MainLayout } from '@/components/layout/MainLayout';

export const metadata: Metadata = {
  title: 'Términos de Servicio | Regaliz',
  description: 'Términos y condiciones de uso de Regaliz, la plataforma de postales en realidad aumentada.',
};

export default function TermsPage() {
  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-4xl font-bold text-foreground mb-2">Términos de Servicio</h1>
        <p className="text-sm text-muted-foreground mb-10">Última actualización: 15 de mayo de 2026</p>

        <div className="space-y-6 text-foreground/90">
          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">1. Aceptación</h2>
            <p>Al usar Regaliz aceptas estos términos. Si no estás de acuerdo, no utilices el servicio.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">2. Descripción del servicio</h2>
            <p>Regaliz permite combinar una imagen y un video para generar una postal de realidad aumentada
              compartible mediante enlace o código QR. El servicio se ofrece tal cual, sin
              garantía de disponibilidad ininterrumpida.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">3. Tu cuenta</h2>
            <p>Eres responsable de mantener la confidencialidad de tus credenciales y de toda
              actividad realizada bajo tu cuenta. Debes ser mayor de 14 años para crear una cuenta.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">4. Contenido del usuario</h2>
            <p>El contenido que subas (imágenes, videos, textos) sigue siendo tuyo. Al subirlo nos
              concedes una licencia limitada para almacenarlo, procesarlo y mostrarlo con el único
              fin de prestarte el servicio.</p>
            <p className="mt-3">Está prohibido subir contenido:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Que infrinja derechos de propiedad intelectual de terceros.</li>
              <li>Que sea ilegal, violento, sexual con menores, discriminatorio o difamatorio.</li>
              <li>Que contenga malware o intente vulnerar la seguridad del servicio.</li>
            </ul>
            <p className="mt-3">Podemos eliminar contenido que infrinja estas reglas y suspender
              cuentas reincidentes sin aviso previo.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">5. Disponibilidad y modificaciones</h2>
            <p>Podemos modificar, suspender o discontinuar funciones del servicio en cualquier momento.
              Avisaremos de cambios materiales a través de la web o por correo cuando proceda.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">6. Limitación de responsabilidad</h2>
            <p>En la máxima medida permitida por la ley, Regaliz no será responsable de daños
              indirectos, lucro cesante o pérdida de datos derivados del uso del servicio.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">7. Cancelación</h2>
            <p>Puedes cerrar tu cuenta cuando quieras. Al hacerlo eliminaremos tus postales y
              datos asociados, salvo aquellos que debamos conservar por obligación legal.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">8. Ley aplicable</h2>
            <p>Estos términos se rigen por la legislación colombiana. Cualquier disputa se
              someterá a los tribunales competentes.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">9. Contacto</h2>
            <p>Para consultas escríbenos a <a className="text-primary underline" href="mailto:hola@regaliz.com.co">hola@regaliz.com.co</a>.</p>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
