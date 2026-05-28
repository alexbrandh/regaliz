'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Camera, 
  Eye, 
  HelpCircle,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';

export default function HelpPage() {
  const steps = [
    {
      number: "01",
      title: "Sube tu Imagen",
      description: "Selecciona una foto con buen contraste y detalles únicos. Esta imagen será el marcador que activará tu experiencia de realidad aumentada.",
    },
    {
      number: "02",
      title: "Añade tu Video",
      description: "Sube el video que aparecerá flotando sobre la imagen cuando alguien la escanee con su cámara.",
    },
    {
      number: "03",
      title: "Espera el Procesamiento",
      description: "Nuestro sistema procesa automáticamente tu imagen para crear los marcadores de realidad aumentada. Esto toma unos minutos.",
    },
    {
      number: "04",
      title: "Comparte tu Postal",
      description: "Una vez lista, comparte el enlace o código QR. Cualquiera puede ver tu postal de realidad aumentada desde su navegador.",
    }
  ];

  const faqs = [
    {
      question: "¿Qué dispositivos son compatibles?",
      answer: "Regaliz funciona en cualquier dispositivo con cámara y navegador web moderno. Recomendamos usar smartphones para la mejor experiencia de realidad aumentada."
    },
    {
      question: "¿Por qué mi imagen no funciona bien para realidad aumentada?",
      answer: "Las mejores imágenes para realidad aumentada tienen buen contraste, detalles únicos y texturas variadas. Evita imágenes muy lisas, brillantes o con patrones repetitivos."
    },
    {
      question: "¿Cuánto tiempo toma el procesamiento?",
      answer: "El procesamiento típicamente toma entre 2-5 minutos, dependiendo de la complejidad de la imagen y la carga del servidor."
    },
    {
      question: "¿Puedo editar mi postal después de crearla?",
      answer: "Actualmente no es posible editar postales existentes. Puedes eliminar la postal y crear una nueva con los cambios deseados."
    },
    {
      question: "¿Las postales tienen límite de visualizaciones?",
      answer: "No, las postales pueden ser vistas ilimitadas veces. Puedes ver estadísticas básicas en tu dashboard."
    }
  ];

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Centro de Ayuda</h1>
          <p className="text-xl text-muted-foreground mb-6">
            Aprende a crear experiencias de realidad aumentada increíbles con Regaliz
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard/new">
              <Button size="lg">
                <Camera className="mr-2 h-5 w-5" />
                Crear Mi Primera Postal
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline">
                <Eye className="mr-2 h-5 w-5" />
                Ver Mis Postales
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Start Guide - Simplified */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle>Cómo Crear tu Postal de realidad aumentada</CardTitle>
            <CardDescription>
              Sigue estos 4 pasos simples
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {steps.map((step, index) => (
                <div key={index} className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{step.number}</span>
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className="font-semibold text-foreground mb-1">{step.title}</h3>
                    <p className="text-muted-foreground text-sm">{step.description}</p>
                  </div>
                  {index < steps.length - 1 && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground/30 mt-2 hidden sm:block" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Features - Simplified */}
        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          <div className="p-6 rounded-xl bg-card border border-border">
            <h3 className="font-semibold text-foreground mb-2">Sin Apps</h3>
            <p className="text-sm text-muted-foreground">
              Funciona directamente en el navegador. Compatible con iOS y Android.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-card border border-border">
            <h3 className="font-semibold text-foreground mb-2">Fácil de Compartir</h3>
            <p className="text-sm text-muted-foreground">
              Genera códigos QR automáticos y enlaces directos para redes sociales.
            </p>
          </div>
        </div>

        {/* FAQ Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-6 w-6 text-chart-3" />
              Preguntas Frecuentes
            </CardTitle>
            <CardDescription>
              Respuestas a las dudas más comunes sobre Regaliz
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {faqs.map((faq, index) => (
                <div key={index}>
                  <h3 className="font-semibold text-foreground mb-2">{faq.question}</h3>
                  <p className="text-muted-foreground">{faq.answer}</p>
                  {index < faqs.length - 1 && <Separator className="mt-6" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="text-center mt-12 p-8 bg-linear-to-r from-primary/10 to-chart-3/10 rounded-lg">
          <h2 className="text-2xl font-bold text-foreground mb-4">¿Listo para comenzar?</h2>
          <p className="text-muted-foreground mb-6">
            Crea tu primera postal de realidad aumentada y comparte experiencias mágicas que cobran vida
          </p>
          <Link href="/dashboard/new">
            <Button size="lg">
              <Camera className="mr-2 h-5 w-5" />
              Crear Postal de realidad aumentada Ahora
            </Button>
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}