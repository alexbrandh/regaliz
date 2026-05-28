"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Sparkles, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { ArcGallery } from "@/components/ui/arc-gallery";

const memoryImages = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1504567961542-e24d9439a724?w=400&auto=format&fit=crop',
];

function AnimatedHero() {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => ["mágicas", "interactivas", "memorables", "únicas", "increíbles"],
    []
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0);
      } else {
        setTitleNumber(titleNumber + 1);
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <div className="w-full relative overflow-hidden min-h-[85vh] pt-20 md:pt-24">
      {/* Arc Gallery de fotos animadas */}
      <ArcGallery images={memoryImages} />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex gap-8 py-20 lg:py-28 items-center justify-center flex-col">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 backdrop-blur-sm border border-primary/20 text-primary text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              Realidad Aumentada al alcance de todos
            </div>
          </motion.div>

          {/* Main Title */}
          <div className="flex gap-4 flex-col">
            <motion.h1
              className="text-[clamp(2.25rem,9vw,4.75rem)] md:text-7xl max-w-4xl tracking-tighter text-center font-bold leading-[1.05]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <span className="text-foreground">Crea postales de realidad aumentada</span>
              <span className="relative flex w-full justify-center overflow-hidden text-center md:pb-4 md:pt-1">
                &nbsp;
                {titles.map((title, index) => (
                  <motion.span
                    key={index}
                    className="absolute font-bold text-transparent bg-clip-text bg-linear-to-r from-primary to-ring"
                    initial={{ opacity: 0, y: "-100" }}
                    transition={{ type: "spring", stiffness: 50 }}
                    animate={
                      titleNumber === index
                        ? {
                            y: 0,
                            opacity: 1,
                          }
                        : {
                            y: titleNumber > index ? -150 : 150,
                            opacity: 0,
                          }
                    }
                  >
                    {title}
                  </motion.span>
                ))}
              </span>
            </motion.h1>

            <motion.p 
              className="text-lg md:text-xl leading-relaxed tracking-tight text-muted-foreground max-w-2xl text-center mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Transforma tus fotos en experiencias de realidad aumentada. 
              Sube una imagen y un video, y comparte recuerdos que cobran vida 
              cuando se ven a través de la cámara.
            </motion.p>
          </div>

          {/* CTA Buttons */}
          <motion.div 
            className="flex flex-col sm:flex-row gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <SignedOut>
              <SignInButton mode="modal">
                <Button size="lg" className="gap-2 text-lg px-8">
                  <Camera className="w-5 h-5" />
                  Comenzar Gratis
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard/new">
                <Button size="lg" className="gap-2 text-lg px-8">
                  <Camera className="w-5 h-5" />
                  Crear Postal de realidad aumentada
                </Button>
              </Link>
            </SignedIn>
            <Button asChild size="lg" className="gap-2 text-lg px-8" variant="outline">
              <a href="#features">
                <ArrowDown className="w-5 h-5" />
                Cómo funciona
              </a>
            </Button>
          </motion.div>

        </div>
      </div>
    </div>
  );
}

export { AnimatedHero };
