'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MainLayout } from '@/components/layout/MainLayout';
import { PostcardCard } from '@/components/PostcardCard';
import { DashboardStats } from '@/components/DashboardStats';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { Plus, Camera, Search, Filter, RefreshCw, XCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePostcards } from '@/hooks/usePostcards';
import { ProcessingStatus } from '@/types/database';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const { postcards, loading, error, deletePostcard, fetchPostcards, refreshAllPostcards } = usePostcards();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProcessingStatus | 'all'>('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle visibility change for refresh when navigating back
  useEffect(() => {
    let visibilityTimeout: NodeJS.Timeout;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (visibilityTimeout) {
          clearTimeout(visibilityTimeout);
        }
        visibilityTimeout = setTimeout(() => {
          if (isLoaded && user && !loading) {
            fetchPostcards(false);
          }
        }, 2000);
      }
    };

    if (isLoaded && user) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityTimeout) {
        clearTimeout(visibilityTimeout);
      }
    };
  }, [isLoaded, user]);

  const handleDelete = async (postcardId: string) => {
    try {
      setIsDeleting(true);
      await deletePostcard(postcardId);
      setConfirmOpen(false);
      setPendingDeleteId(null);
    } catch {
      // Error handling is done in the hook
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedPostcard = useMemo(() => {
    if (!pendingDeleteId || !Array.isArray(postcards)) return null;
    return postcards.find(p => p.id === pendingDeleteId) || null;
  }, [pendingDeleteId, postcards]);

  const filteredPostcards = useMemo(() => {
    if (!Array.isArray(postcards)) {
      return [];
    }
    return postcards.filter(postcard => {
      const matchesSearch = postcard.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (postcard.description && postcard.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || postcard.processing_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [postcards, searchTerm, statusFilter]);

  const handleNavigateToPostcard = useCallback((id: string) => {
    window.location.href = `/dashboard/postcard/${id}`;
  }, []);

  if (loading) {
    return (
      <MainLayout>
        <DashboardSkeleton />
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-linear-to-b from-muted/30 to-background">
          <div className="container mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">Algo salió mal</h2>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => fetchPostcards(false)}>
                  Intentar de nuevo
                </Button>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <TooltipProvider>
      <MainLayout>
        <div className="min-h-screen bg-linear-to-b from-muted/30 to-background">
          <div className="container mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 lg:py-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Mis Postales Regaliz</h1>
                <p className="text-muted-foreground mt-1.5 text-sm md:text-base">
                  {!Array.isArray(postcards) || postcards.length === 0 
                    ? 'Crea tu primera postal de realidad aumentada para comenzar'
                    : `${postcards.length} postal${postcards.length === 1 ? '' : 'es'}`
                  }
                </p>
              </div>
              <Link href="/dashboard/new">
                <Button size="lg" className="w-full sm:w-auto bg-linear-to-r from-primary to-ring hover:from-primary/90 hover:to-ring/90 text-white shadow-md hover:shadow-lg transition-all">
                  <Plus className="mr-2 h-5 w-5" />
                  Crear Nueva Postal
                </Button>
              </Link>
            </div>

            {/* Statistics Cards */}
            <DashboardStats postcards={postcards} />

            {/* Search and Filters */}
            {Array.isArray(postcards) && postcards.length > 0 && (
              <div className="bg-card rounded-2xl border border-border p-4 mb-6 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-muted-foreground/70 h-4 w-4" />
                    <Input
                      placeholder="Buscar postales por título o descripción..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-muted/50 border-border focus:border-primary focus:ring-primary"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground/70" />
                      <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ProcessingStatus | 'all')}>
                        <SelectTrigger className="w-[180px] bg-muted/50 border-border">
                          <SelectValue placeholder="Filtrar por estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los estados</SelectItem>
                          <SelectItem value="ready">Listas</SelectItem>
                          <SelectItem value="processing">Procesando</SelectItem>
                          <SelectItem value="error">Con errores</SelectItem>
                          <SelectItem value="needs_better_image">Necesita mejor imagen</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refreshAllPostcards()}
                          disabled={loading}
                          className="flex items-center gap-2 border-border hover:bg-muted hover:border-border"
                        >
                          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                          <span className="hidden sm:inline">Actualizar</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Actualizar datos desde la base de datos</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            )}

            {/* Results Info */}
            {Array.isArray(postcards) && postcards.length > 0 && (
              <div className="mb-5">
                <p className="text-sm text-muted-foreground font-medium">
                  {filteredPostcards.length === postcards.length 
                    ? `Mostrando ${filteredPostcards.length} postal${filteredPostcards.length === 1 ? '' : 'es'}`
                    : `Mostrando ${filteredPostcards.length} de ${postcards.length} postales`
                  }
                </p>
              </div>
            )}

            {/* Empty State */}
            {!Array.isArray(postcards) || postcards.length === 0 ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center max-w-md">
                  <div className="mx-auto w-24 h-24 bg-linear-to-br from-primary/20 to-ring/20 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <Camera className="h-12 w-12 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-4">Aún no hay postales</h2>
                  <p className="text-muted-foreground mb-6">
                    Crea tu primera postal de realidad aumentada subiendo una foto y video.
                    Comparte experiencias mágicas que cobran vida a través de cualquier cámara.
                  </p>
                  <Link href="/dashboard/new">
                    <Button size="lg" className="bg-linear-to-r from-primary to-ring hover:from-primary/90 hover:to-ring/90 text-white shadow-md">
                      <Plus className="mr-2 h-5 w-5" />
                      Crear Tu Primera Postal
                    </Button>
                  </Link>
                </div>
              </div>
            ) : filteredPostcards.length === 0 ? (
              /* No Results State */
              <div className="flex items-center justify-center min-h-[300px]">
                <div className="text-center max-w-md">
                  <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-muted-foreground/70" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No se encontraron postales</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm || statusFilter !== 'all'
                      ? 'Intenta ajustar tus filtros de búsqueda.'
                      : 'No tienes postales que coincidan con los criterios.'
                    }
                  </p>
                  {(searchTerm || statusFilter !== 'all') && (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setSearchTerm('');
                        setStatusFilter('all');
                      }}
                      className="border-border hover:bg-muted"
                    >
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              /* Postcards Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                {filteredPostcards.map((postcard) => (
                  <PostcardCard
                    key={postcard.id}
                    postcard={postcard}
                    onDelete={(id) => {
                      setPendingDeleteId(id);
                      setConfirmOpen(true);
                    }}
                    onNavigate={handleNavigateToPostcard}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={confirmOpen} onOpenChange={(open) => { if (!open && !isDeleting) { setConfirmOpen(open); setPendingDeleteId(null); } }}>
          <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Eliminar postal</DialogTitle>
              <DialogDescription>
                {selectedPostcard ? (
                  selectedPostcard.is_activated && selectedPostcard.fulfillment_type === 'physical' ? (
                    <span className="text-red-600 font-medium">
                      ⚠️ Esta postal tiene una orden física activa. No se puede eliminar mientras esté en proceso de envío. Si necesitas cancelarla, contáctanos.
                    </span>
                  ) : (
                    <>¿Seguro que deseas eliminar &quot;{selectedPostcard.title}&quot;? Esta acción no se puede deshacer.</>
                  )
                ) : (
                  <>¿Seguro que deseas eliminar esta postal? Esta acción no se puede deshacer.</>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => { if (!isDeleting) { setConfirmOpen(false); setPendingDeleteId(null); } }}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => { if (pendingDeleteId) { handleDelete(pendingDeleteId); } }}
                disabled={
                  !pendingDeleteId ||
                  isDeleting ||
                  (selectedPostcard?.is_activated === true && selectedPostcard?.fulfillment_type === 'physical')
                }
              >
                {isDeleting ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </MainLayout>
    </TooltipProvider>
  );
}
