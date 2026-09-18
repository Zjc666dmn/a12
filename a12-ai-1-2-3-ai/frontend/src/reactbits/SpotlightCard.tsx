import { type MouseEventHandler, type PropsWithChildren, useRef } from 'react';
import './reactbits.css';

type SpotlightCardProps = PropsWithChildren<{
  className?: string;
  spotlightColor?: string;
}>;

export default function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(110, 174, 255, 0.22)',
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove: MouseEventHandler<HTMLDivElement> = (event) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    cardRef.current.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
    cardRef.current.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
    cardRef.current.style.setProperty('--spotlight-color', spotlightColor);
  };

  return <div ref={cardRef} onMouseMove={handleMouseMove} className={`rb-spotlight-card ${className}`}>{children}</div>;
}
