import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './reactbits.css';

type StarBorderProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  color?: string;
  speed?: string;
};

export default function StarBorder({ children, className = '', color = '#77c7ff', speed = '5s', style, ...props }: StarBorderProps) {
  return (
    <button className={`rb-star-border ${className}`} style={style} {...props}>
      <span className="rb-star-bottom" style={{ background: `radial-gradient(circle, ${color}, transparent 11%)`, animationDuration: speed }} />
      <span className="rb-star-top" style={{ background: `radial-gradient(circle, ${color}, transparent 11%)`, animationDuration: speed }} />
      <span className="rb-star-content">{children}</span>
    </button>
  );
}
