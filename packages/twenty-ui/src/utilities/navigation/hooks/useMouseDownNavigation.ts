'use client';

// SOURCING: next/navigation (Next.js App Router), replacing react-router-dom's
// useNavigate. The behavior is upstream's, unchanged: modifier-clicks fall
// through to the browser, MOUSE_DOWN navigates on press, CLICK navigates on
// click, and a regular click always preventDefaults so the anchor and the hook
// cannot both navigate.

import { isNavigationModifierPressed } from '@ui/utilities/navigation/isNavigationModifierPressed';
import { type TriggerEventType } from '@ui/utilities/navigation/types/trigger-event.type';
import { type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { isDefined } from '@ui/utilities/utils/isDefined';

type UseMouseDownNavigationProps = {
  to?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  onBeforeNavigation?: () => void;
  triggerEvent?: TriggerEventType;
  stopPropagation?: boolean;
};

export const useMouseDownNavigation = ({
  to,
  onClick,
  disabled = false,
  onBeforeNavigation,
  triggerEvent = 'MOUSE_DOWN',
}: UseMouseDownNavigationProps) => {
  const router = useRouter();

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (disabled) return;

    // For modifier keys, let the default browser behavior handle it
    if (isNavigationModifierPressed(event)) {
      onBeforeNavigation?.();
      if (isDefined(onClick) && !isDefined(to)) {
        onClick(event);
      }
      // Don't prevent default for modifier keys to allow browser navigation
      return;
    }

    if (triggerEvent === 'CLICK') {
      onBeforeNavigation?.();
      if (isDefined(onClick)) {
        onClick(event);
      } else if (isDefined(to)) {
        router.push(to);
      }
    }

    // For regular clicks, prevent default to avoid double navigation
    event.preventDefault();
  };

  const handleMouseDown = (event: MouseEvent<HTMLElement>) => {
    if (disabled || triggerEvent === 'CLICK') return;

    if (isNavigationModifierPressed(event)) {
      return;
    }

    onBeforeNavigation?.();

    if (isDefined(onClick)) {
      onClick(event);
    } else if (isDefined(to)) {
      router.push(to);
    }
  };

  return {
    onClick: handleClick,
    onMouseDown: handleMouseDown,
  };
};
