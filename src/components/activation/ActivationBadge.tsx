import { Badge } from '@/components/ui/badge';
import { Truck, CheckCircle2, Clock } from 'lucide-react';

interface ActivationBadgeProps {
  isActivated: boolean;
  fulfillmentType?: 'digital' | 'physical' | null;
}

export function ActivationBadge({ isActivated, fulfillmentType }: ActivationBadgeProps) {
  if (!isActivated) {
    return (
      <Badge className="bg-amber-500 text-white text-xs font-medium px-2.5 py-1 rounded-full">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Sin activar
        </span>
      </Badge>
    );
  }

  if (fulfillmentType === 'physical') {
    return (
      <Badge className="bg-emerald-500 text-white text-xs font-medium px-2.5 py-1 rounded-full">
        <span className="flex items-center gap-1">
          <Truck className="h-3 w-3" />
          Activa · Envío en camino
        </span>
      </Badge>
    );
  }

  return (
    <Badge className="bg-emerald-500 text-white text-xs font-medium px-2.5 py-1 rounded-full">
      <span className="flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Activa
      </span>
    </Badge>
  );
}
