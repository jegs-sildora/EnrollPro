import { Badge } from '@/shared/ui/badge';
import { STATUS_CONFIG } from '../constants';

export function StatusBadge({ status }: { status: string }) {
	const { label, className } = STATUS_CONFIG[status] ?? {
		label: status,
		className: 'bg-muted text-muted-foreground border-muted-foreground',
	};
	return (
		<Badge
			variant='outline'
			className={className}
			aria-label={`Status: ${label}`}
		>
			{label}
		</Badge>
	);
}
