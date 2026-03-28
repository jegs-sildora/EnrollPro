import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog';
import { X } from 'lucide-react';

interface ImageEnlargerProps {
	src: string;
	isOpen: boolean;
	onClose: () => void;
	alt?: string;
}

export function ImageEnlarger({
	src,
	isOpen,
	onClose,
	alt = 'Enlarged photo',
}: ImageEnlargerProps) {
	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => !open && onClose()}>
			<DialogContent className='max-w-[95vw] max-h-[95vh] p-0 border-none bg-transparent shadow-none flex items-center justify-center overflow-hidden outline-none ring-0'>
				<DialogTitle className='sr-only'>{alt}</DialogTitle>

				<button
					onClick={onClose}
					className='absolute right-4 top-4 z-50 rounded-full bg-black/50 p-2 text-white transition-opacity hover:bg-black/70 focus:outline-none'>
					<X className='h-6 w-6' />
					<span className='sr-only'>Close</span>
				</button>

				<div className='relative w-full h-full flex items-center justify-center'>
					<img
						src={src}
						alt={alt}
						className='max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200'
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}
