import * as React from 'react';

// Alert Component
export type AlertType = 'info' | 'success' | 'warning' | 'error';
export interface AlertProps { [key: string]: any;
  type?: AlertType;
  title?: string;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
  style?: React.CSSProperties;
}
export const Alert: React.FC<AlertProps> = ({ type = 'info', title, children, className, onClose, style }) => (
  <div className={`alert alert-${type} ${className || ''}`} style={style}>
    {title && <h4>{title}</h4>}
    <div>{children}</div>
    {onClose && <button onClick={onClose}>x</button>}
  </div>
);

// Badge Component
export interface BadgeProps { [key: string]: any;
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'destructive' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'brand';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}
export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', size = 'md', dot, className }) => (
  <span className={`badge badge-${variant} badge-${size} ${className || ''}`}>{dot && <span className="dot" />}{children}</span>
);

export const Card: React.FC<any> = ({ children, className, style }) => (
  <div className={`card ${className || ''}`} style={style}>{children}</div>
);
export const CardHeader: React.FC<any> = ({ children, className, style }) => (
  <div className={`card-header ${className || ''}`} style={style}>{children}</div>
);
export const CardTitle: React.FC<any> = ({ children, className, style }) => (
  <h3 className={`card-title ${className || ''}`} style={style}>{children}</h3>
);
export const CardContent: React.FC<any> = ({ children, className, style }) => (
  <div className={`card-content ${className || ''}`} style={style}>{children}</div>
);
export const CardFooter: React.FC<any> = ({ children, className, style }) => (
  <div className={`card-footer ${className || ''}`} style={style}>{children}</div>
);

// Button Component
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}
export const Button: React.FC<ButtonProps> = ({ variant = 'default', size = 'md', isLoading, className, children, ...props }) => (
  <button className={`btn btn-${variant} btn-${size} ${className || ''}`} {...props}>{children}</button>
);

// Skeleton Component
export const Skeleton: React.FC<any> = ({ className, width, height, style }) => (
  <div className={`skeleton ${className || ''}`} style={{ width, height, ...style }} />
);

// Gauge Component
export const Gauge: React.FC<any> = ({ value, max = 100, className }) => (
  <div className={`gauge ${className || ''}`}>
    <div className="gauge-fill" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
  </div>
);

// Progress Component
export const Progress: React.FC<any> = ({ value, className }) => (
  <div className={`w-full bg-gray-200 rounded-full h-2.5 ${className || ''}`}>
    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%` }}></div>
  </div>
);

export const Modal: React.FC<any> = ({ isOpen, children, title, footer }) => (
  isOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div className="bg-white p-4 rounded">
      {title && <h2>{title}</h2>}
      {children}
      {footer && <div>{footer}</div>}
    </div>
  </div> : null
);

export const Spinner: React.FC<any> = ({ className }) => (
  <div className={`animate-spin rounded-full border-b-2 border-primary ${className || ''}`} style={{ width: '24px', height: '24px' }}></div>
);

export const CardDescription: React.FC<any> = ({ children, className }) => (
  <p className={`text-sm text-gray-500 ${className || ''}`}>{children}</p>
);

export interface DropdownItemProps { [key: string]: any;
  id: string;
  label?: string | React.ReactNode;
  sublabel?: string | React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
}

export const Dropdown: React.FC<any> = ({ trigger, items }) => (
  <div className="dropdown">
    <div className="dropdown-trigger">{trigger}</div>
    <div className="dropdown-menu">
      {items.map((item: DropdownItemProps) => (
        <div key={item.id} className="dropdown-item" onClick={item.onClick}>
          {item.label} {item.badge && <span className="dropdown-badge">{item.badge}</span>}
        </div>
      ))}
    </div>
  </div>
);

export type DropdownItem = DropdownItemProps;

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  leftIcon?: React.ReactNode;
}
export const Input: React.FC<InputProps> = ({ error, label, className, leftIcon, ...props }) => (
  <div className={`input-group ${className || ''}`}>
    {label && <label>{label}</label>}
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {leftIcon}
      <input className="input" {...props} />
    </div>
    {error && <span className="input-error">{error}</span>}
  </div>
);

export const Avatar: React.FC<any> = ({ src, fallback, className }) => (
  <div className={`avatar ${className || ''}`}>
    {src ? <img src={src} alt="Avatar" /> : <span>{fallback}</span>}
  </div>
);
