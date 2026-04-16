import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import { STATUS_CONFIG } from '../constants';

export function StatusBadge({ status, className: extraClassName }: { status: string; className?: string }) {
	const { label, className } = STATUS_CONFIG[status] ?? {
		label: status,
		className: 'bg-muted text-muted-foreground border-muted-foreground',
	};
	return (
		<Badge
			variant='outline'
			className={cn('h-auto py-1 px-3 whitespace-normal text-center leading-tight bg-white', className, extraClassName)}
			aria-label={`Status: ${label}`}
		>
			{label}
		</Badge>
	);
}
