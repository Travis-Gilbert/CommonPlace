'use client';

// SOURCING: fork of ibelick/motion-primitives dock (motion-primitives.com/docs/dock).
// Mode: fork (not vendor; not an npm package). Corrections per
// SPEC-COMMONPLACE-CHAT-SHELL-1.2 SH5:
// 1. Import from motion/react (HANDOFF-CANON).
// 2. DEFAULT_MAGNIFICATION 44 against a 36px base (sidebar cannot absorb 80).
// 3. Drop DOCK_HEIGHT / derived maxHeight; panelHeight alone sizes the row.
// 4. Re-token surfaces to register tokens (no upstream gray/neutral palette classes).
// 5. cloneElement for width/isHovered replaced with DockItemContext.

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
  type SpringOptions,
} from 'motion/react';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

const DEFAULT_MAGNIFICATION = 44;
const DEFAULT_DISTANCE = 100;
const DEFAULT_PANEL_HEIGHT = 36;
const BASE_ITEM = 36;

export type DockProps = {
  children: ReactNode;
  className?: string;
  distance?: number;
  panelHeight?: number;
  magnification?: number;
  spring?: SpringOptions;
};

export type DockItemProps = {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  'aria-label'?: string;
  'aria-current'?: boolean | 'page' | 'step' | 'location' | 'date' | 'time';
};

export type DockLabelProps = {
  className?: string;
  children: ReactNode;
};

export type DockIconProps = {
  className?: string;
  children: ReactNode;
};

type DockContextValue = {
  mouseX: MotionValue<number>;
  spring: SpringOptions;
  magnification: number;
  distance: number;
};

type DockItemContextValue = {
  width: MotionValue<number>;
  isHovered: MotionValue<number>;
};

const DockContext = createContext<DockContextValue | undefined>(undefined);
const DockItemContext = createContext<DockItemContextValue | undefined>(undefined);

function useDock(): DockContextValue {
  const context = useContext(DockContext);
  if (!context) throw new Error('useDock must be used within Dock');
  return context;
}

function useDockItem(): DockItemContextValue {
  const context = useContext(DockItemContext);
  if (!context) throw new Error('useDockItem must be used within DockItem');
  return context;
}

function Dock({
  children,
  className,
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
  panelHeight = DEFAULT_PANEL_HEIGHT,
}: DockProps) {
  const mouseX = useMotionValue(Infinity);

  return (
    <DockContext.Provider value={{ mouseX, spring, magnification, distance }}>
      <div
        className="flex w-full items-end overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        <div
          onMouseMove={({ pageX }) => {
            mouseX.set(pageX);
          }}
          onMouseLeave={() => {
            mouseX.set(Infinity);
          }}
          className={cn(
            'mx-auto flex w-fit gap-1 rounded-[var(--radius-control)] border border-ij-seam bg-ij-raised px-2',
            className,
          )}
          style={{ height: panelHeight }}
          role="toolbar"
          aria-label="Surface dock"
        >
          {children}
        </div>
      </div>
    </DockContext.Provider>
  );
}

function DockItem({
  children,
  className,
  onClick,
  'aria-label': ariaLabel,
  'aria-current': ariaCurrent,
}: DockItemProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { distance, magnification, mouseX, spring } = useDock();
  const isHovered = useMotionValue(0);

  const mouseDistance = useTransform(mouseX, (val) => {
    const domRect = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - domRect.x - domRect.width / 2;
  });

  const widthTransform = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [BASE_ITEM, magnification, BASE_ITEM],
  );
  const width = useSpring(widthTransform, spring);

  return (
    <DockItemContext.Provider value={{ width, isHovered }}>
      <motion.div
        ref={ref}
        style={{ width }}
        onHoverStart={() => isHovered.set(1)}
        onHoverEnd={() => isHovered.set(0)}
        onFocus={() => isHovered.set(1)}
        onBlur={() => isHovered.set(0)}
        className={cn('relative inline-flex items-center justify-center', className)}
        tabIndex={0}
        role="button"
        aria-label={ariaLabel}
        aria-current={ariaCurrent}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick?.();
          }
        }}
      >
        {children}
      </motion.div>
    </DockItemContext.Provider>
  );
}

function DockLabel({ children, className }: DockLabelProps) {
  const { isHovered } = useDockItem();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = isHovered.on('change', (latest) => {
      setIsVisible(latest === 1);
    });
    return () => unsubscribe();
  }, [isHovered]);

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: -8 }}
          exit={{ opacity: 0, y: 0 }}
          transition={{ duration: 0.16 }}
          className={cn(
            'absolute -top-6 left-1/2 w-fit whitespace-pre rounded-[var(--radius-control)] border border-ij-seam bg-ij-raised px-2 py-0.5 text-ij-ink',
            className,
          )}
          role="tooltip"
          style={{ x: '-50%', fontSize: 'var(--ij-composer-meta-font-size)' }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function DockIcon({ children, className }: DockIconProps) {
  const { width } = useDockItem();
  const widthTransform = useTransform(width, (val) => val / 2);

  return (
    <motion.div
      style={{ width: widthTransform }}
      className={cn('flex items-center justify-center text-ij-ink', className)}
    >
      {children}
    </motion.div>
  );
}

export { Dock, DockIcon, DockItem, DockLabel, useDock };
