import type { Metadata } from 'next';
import { MainLayout } from '@/components/layout/MainLayout';

export const metadata: Metadata = {
  title: 'Política de Privacidad | Regaliz',
  description: 'Política de privacidad de Regaliz: qué datos recopilamos, cómo los usamos y tus derechos.',
};

export default function PrivacyPage() {
  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-4xl font-bold text-foreground mb-2">Política de Privacidad</h1>
        <p className="text-sm text-muted-foreground mb-10">Última actualización: 15 de mayo de 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-foreground/90">
          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">1. Quiénes somos</h2>
            <p>
              Regaliz es una plataforma para crear postales en realidad aumentada que combinan
              una imagen y un video. El responsable del tratamiento es el equipo de Regaliz. Para
              cualquier consulta puedes escribirnos a <a className="text-primary underline" href="mailto:hola@regaliz.com.co">hola@regaliz.com.co</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">2. Qué datos recopilamos</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Cuenta:</strong> nombre, correo electrónico y avatar (gestionados por Clerk).</li>
              <li><strong>Contenido subido:</strong> las imágenes y videos que tú decides cargar para crear tus postales.</li>
              <li><strong>Datos técnicos:</strong> dirección IP, tipo de dispositivo y navegador, registros de error.</li>
              <li><strong>Uso:</strong> número de visualizaciones de realidad aumentada de tus postales (de forma agregada).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">3. Cómo usamos tus datos</h2>
            <p>Utilizamos tus datos exclusivamente para:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Permitirte crear, almacenar y compartir tus postales de realidad aumentada.</li>
              <li>Garantizar la seguridad y el correcto funcionamiento del servicio.</li>
              <li>Cumplir obligaciones legales.</li>
            </ul>
            <p>No vendemos tus datos a terceros ni los usamos para publicidad.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">4. Encargados y proveedores</h2>
            <p>Para prestar el servicio nos apoyamos en:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Vercel</strong> (hosting y CDN).</li>
              <li><strong>Supabase</strong> (base de datos y almacenamiento de archivos).</li>
              <li><strong>Clerk</strong> (autenticación de usuarios).</li>
            </ul>
            <p>Estos proveedores tratan los datos siguiendo sus propias políticas y contratos de encargo.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">5. Conservación</h2>
            <p>
              Conservamos tus datos mientras tu cuenta esté activa. Puedes solicitar la eliminación
              completa en cualquier momento escribiendo a <a className="text-primary underline" href="mailto:hola@regaliz.com.co">hola@regaliz.com.co</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">6. Tus derechos</h2>
            <p>Tienes derecho a acceder, rectificar, suprimir, limitar y oponerte al tratamiento
              de tus datos, así como a la portabilidad. Para ejercerlos, escríbenos al correo indicado.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">7. Cookies</h2>
            <p>Usamos cookies estrictamente necesarias para el funcionamiento de la sesión (Clerk)
              y para recordar tus preferencias (tema claro/oscuro). No usamos cookies de marketing
              ni de seguimiento de terceros.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-3">8. Cambios</h2>
            <p>Si actualizamos esta política, publicaremos la nueva versión en esta misma página
              con la fecha actualizada.</p>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
