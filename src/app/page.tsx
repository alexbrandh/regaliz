'use client';

import { Camera, Share2, Zap, ArrowRight } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ScrollPhoneHero } from '@/components/hero/ScrollPhoneHero';
import { motion } from 'framer-motion';

const steps = [
  {
    number: "01",
    icon: Camera,
    title: "Sube tu Contenido",
    description: "Elige una foto como objetivo AR y sube un video que se reproducirá cuando se escanee la foto.",
    color: "blue",
    gradient: "from-primary to-ring"
  },
  {
    number: "02",
    icon: Zap,
    title: "Procesamiento IA",
    description: "Nuestra IA genera automáticamente marcadores de seguimiento AR desde tu foto para un reconocimiento perfecto.",
    color: "emerald",
    gradient: "from-ring to-chart-5"
  },
  {
    number: "03",
    icon: Share2,
    title: "Comparte y Experimenta",
    description: "Comparte el enlace de tu postal AR. Cualquiera puede apuntar su cámara a la foto para ver tu video cobrar vida.",
    color: "violet",
    gradient: "from-chart-3 to-chart-2"
  }
];

export default function Home() {
  return (
    <MainLayout>
      <div className="min-h-screen">

        {/* Animated Hero Section */}
        <ScrollPhoneHero />

        {/* Features Section */}
        <section id="features" className="relative py-24 overflow-hidden">
          
          <div className="container mx-auto px-4">
            {/* Section Header */}
            <motion.div
              className="text-center mb-20"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="inline-block px-4 py-1.5 mb-6 text-sm font-semibold text-primary bg-primary/10 rounded-full">
                Simple y Poderoso
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                Cómo Funciona
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Crea experiencias AR impresionantes en solo <span className="text-primary font-semibold">3 pasos simples</span>
              </p>
            </motion.div>
            
            {/* Steps Grid */}
            <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {steps.map((step, index) => (
                <motion.div
                  key={step.number}
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  className="group relative"
                >
                  {/* Card */}
                  <div className="relative h-full bg-card/50 backdrop-blur-sm rounded-3xl p-8 shadow-lg shadow-border/30 border border-border/50 hover:shadow-xl hover:bg-card/70 transition-all duration-300 hover:-translate-y-1">
                    {/* Step Number */}
                    <div className="absolute -top-4 -right-4 w-14 h-14 bg-linear-to-br from-foreground to-muted-foreground rounded-2xl flex items-center justify-center shadow-lg">
                      <span className="text-white font-bold text-lg">{step.number}</span>
                    </div>
                    
                    {/* Icon */}
                    <div className={`w-16 h-16 mb-6 rounded-2xl bg-linear-to-br ${step.gradient} flex items-center justify-center shadow-lg`}>
                      <step.icon className="w-8 h-8 text-white" />
                    </div>
                    
                    {/* Content */}
                    <h3 className="text-xl font-bold text-foreground mb-3">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                  
                  {/* Arrow connector - OUTSIDE card for proper z-index */}
                  {index < steps.length - 1 && (
                    <div className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 translate-x-full z-100">
                      <ArrowRight className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  )
}