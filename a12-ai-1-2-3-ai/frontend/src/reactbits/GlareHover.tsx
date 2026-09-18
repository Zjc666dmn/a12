import type { CSSProperties, ReactNode } from 'react';
import './reactbits.css';

type GlareHoverProps = {
  children: ReactNode;
  className?: string;
  glareColor?: string;
  glareOpacity?: number;
  glareAngle?: number;
  glareSize?: number;
  transitionDuration?: number;
};

export default function GlareHover({
  children,
  className = '',
  glareColor = '#ffffff',
  glareOpacity = 0.48,
  glareAngle = -42,
  glareSize = 220,
  transitionDuration = 720,
}: GlareHoverProps) {
  const hex = glareColor.replace('#', '');
  const rgba = /^[0-9A-Fa-f]{6}$/.test(hex)
    ? `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, ${glareOpacity})`
    : glareColor;
  const variables = {
    '--rb-glare-angle': `${glareAngle}deg`,
    '--rb-glare-duration': `${transitionDuration}ms`,
    '--rb-glare-size': `${glareSize}%`,
    '--rb-glare-color': rgba,
  } as CSSProperties;

  return <div className={`rb-glare-hover ${className}`} style={variables}>{children}</div>;
}
