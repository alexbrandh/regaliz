'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ImageOff, FileSearch, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { api, type AdminPostcard, type PostcardListResponse } from '@/lib/admin/api';
import { StatusTabs, type StatusFilter } from '@/components/admin/postcards/StatusTabs';
import { PostcardsFilters, type ViewMode, type SortKey } from '@/components/admin/postcards/PostcardsFilters';
import { PostcardsTable } from '@/components/admin/postcards/PostcardsTable';
import { PostcardsGrid } from '@/components/admin/postcards/PostcardsGrid';
import { PreviewModal } from '@/components/admin/postcards/PreviewModal';
import { EditMediaModal } from '@/components/admin/postcards/EditMediaModal';
import { ConfirmDialog } from '@/components/admin/postcards/ConfirmDialog';
import { Pagination } from '@/components/admin/postcards/Pagination';
import { EmptyState } from '@/components/admin/common/EmptyState';
import { TableSkeleton, GridSkeleton } from '@/components/admin/common/Skeleton';

export default function PostalesPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const userIdFilter = searchParams.get('userId') || undefined;
  const [data, setData] = useState<PostcardListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [sortBy, setSortBy] = useState<SortKey>('created_at');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [previewPostcard, setPreviewPostcard] = useState<AdminPostcard | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'video' | null>(null);
  const [editPostcard, setEditPostcard] = useState<AdminPostcard | null>(null);
  const [editType, setEditType] = useState<'image' | 'video' | null>(null);
  const [deletePostcard, setDeletePostcard] = useState<AdminPostcard | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    const res = await api.listPostcards({
      page,
      limit,
      status,
      search: search.trim() || undefined,
      sortBy,
      sortDir: sortBy === 'title' ? 'asc' : 'desc',
      userId: userIdFilter,
    });
    if (res.success && res.data) setData(res.data);
    else if (res.error) toast({ title: 'Error al cargar', description: res.error, variant: 'destructive' });

    setLoading(false);
    setRefreshing(false);
  }, [page, limit, status, search, sortBy, userIdFilter, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [status, search, sortBy, limit]);

  const copyToClipboard = useCallback((p: AdminPostcard) => {
    const cleanText = p.arLink.replace(/\s+/g, '').trim();
    void navigator.clipboard.writeText(cleanText);
    toast({ title: 'Enlace copiado', description: 'El enlace AR se copió al portapapeles.' });
  }, [toast]);

  const handleDownload = useCallback(async (p: AdminPostcard, kind: 'image' | 'video') => {
    const url = kind === 'image' ? p.image_url : p.video_url;
    const filename = `${p.title}-${kind === 'image' ? 'imagen.jpg' : 'video.mp4'}`;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch {
      window.open(url, '_blank');
    }
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletePostcard) return;
    setDeleting(true);
    const res = await api.deletePostcard(deletePostcard.id);
    setDeleting(false);
    if (res.success) {
      toast({ title: 'Postal eliminada' });
      setDeletePostcard(null);
      fetchData(true);
    } else {
      toast({ title: 'No se pudo eliminar', description: res.error, variant: 'destructive' });
    }
  }, [deletePostcard, toast, fetchData]);

  const postcards = data?.postcards ?? [];
  const stats = data?.stats;
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Postales</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona todas las postales AR creadas por tus clientes
          </p>
        </div>
        {userIdFilter && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/postales')}
          >
            <X className="size-4" />
            Quitar filtro de usuario
          </Button>
        )}
      </header>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 pt-2">
          <StatusTabs
            value={status}
            onChange={setStatus}
            counts={{
              total: stats?.total ?? 0,
              ready: stats?.ready ?? 0,
              processing: stats?.processing ?? 0,
              error: stats?.error ?? 0,
              needsBetterImage: stats?.needsBetterImage ?? 0,
            }}
          />
        </div>

        <div className="p-4 sm:p-6 border-b">
          <PostcardsFilters
            search={search}
            onSearchChange={setSearch}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            onRefresh={() => fetchData(true)}
            refreshing={refreshing}
          />
        </div>

        <div className="px-0 sm:px-0">
          {loading ? (
            viewMode === 'table' ? (
              <TableSkeleton />
            ) : (
              <div className="p-4">
                <GridSkeleton />
              </div>
            )
          ) : postcards.length === 0 ? (
            <EmptyState
              icon={search || status !== 'all' ? FileSearch : ImageOff}
              title={search || status !== 'all' ? 'Sin resultados' : 'Aún no hay postales'}
              description={
                search || status !== 'all'
                  ? 'Prueba con otros filtros o limpia la búsqueda'
                  : 'Cuando un cliente cree su primera postal AR aparecerá aquí'
              }
              action={
                search || status !== 'all'
                  ? {
                    label: 'Limpiar filtros',
                    onClick: () => {
                      setSearch('');
                      setStatus('all');
                    },
                  }
                  : undefined
              }
            />
          ) : viewMode === 'table' ? (
            <PostcardsTable
              postcards={postcards}
              onPreviewImage={p => { setPreviewPostcard(p); setPreviewType('image'); }}
              onPreviewVideo={p => { setPreviewPostcard(p); setPreviewType('video'); }}
              onEditImage={p => { setEditPostcard(p); setEditType('image'); }}
              onEditVideo={p => { setEditPostcard(p); setEditType('video'); }}
              onCopyLink={copyToClipboard}
              onDownload={handleDownload}
              onDelete={p => setDeletePostcard(p)}
            />
          ) : (
            <div className="p-4">
              <PostcardsGrid
                postcards={postcards}
                onPreviewImage={p => { setPreviewPostcard(p); setPreviewType('image'); }}
                onPreviewVideo={p => { setPreviewPostcard(p); setPreviewType('video'); }}
                onEditImage={p => { setEditPostcard(p); setEditType('image'); }}
                onEditVideo={p => { setEditPostcard(p); setEditType('video'); }}
                onCopyLink={copyToClipboard}
                onDownload={handleDownload}
                onDelete={p => setDeletePostcard(p)}
              />
            </div>
          )}
        </div>

        {meta && meta.total > 0 && (
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={meta.limit}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        )}
      </div>

      <PreviewModal
        postcard={previewPostcard}
        type={previewType}
        onClose={() => { setPreviewPostcard(null); setPreviewType(null); }}
        onDownload={handleDownload}
      />

      <EditMediaModal
        postcard={editPostcard}
        type={editType}
        onClose={() => { setEditPostcard(null); setEditType(null); }}
        onSaved={() => fetchData(true)}
      />

      <ConfirmDialog
        open={!!deletePostcard}
        onOpenChange={v => !v && setDeletePostcard(null)}
        title="¿Eliminar postal?"
        description={
          deletePostcard
            ? `Se eliminará "${deletePostcard.title}" junto con la imagen y el video. Esta acción no se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
