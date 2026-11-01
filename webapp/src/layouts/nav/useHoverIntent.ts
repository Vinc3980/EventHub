import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseHoverIntentOptions {
  openDelayMs?: number;
  closeDelayMs?: number;
}

export function useHoverIntent(options: UseHoverIntentOptions = {}) {
  const { openDelayMs = 120, closeDelayMs = 250 } = options;
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [pinnedMenu, setPinnedMenu] = useState<string | null>(null);

  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openMenuRef = useRef<string | null>(null);
  openMenuRef.current = openMenu;

  const pinnedMenuRef = useRef<string | null>(null);
  pinnedMenuRef.current = pinnedMenu;

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeAll = useCallback(() => {
    clearTimers();
    setOpenMenu(null);
    setPinnedMenu(null);
  }, [clearTimers]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const onPointerEnterItem = useCallback(
    (id: string, pointerType?: string) => {
      if (pointerType === 'touch') return;

      // Entering any item cancels pending close
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }

      const current = openMenuRef.current;
      if (current === id) return;

      if (current !== null) {
        // Any menu is already open -> switch immediately!
        if (openTimerRef.current) {
          clearTimeout(openTimerRef.current);
          openTimerRef.current = null;
        }
        // Unpin previous menu when switching to another via hover
        setPinnedMenu(null);
        setOpenMenu(id);
      } else {
        // Idle -> open after openDelayMs (120ms)
        if (openTimerRef.current) clearTimeout(openTimerRef.current);
        openTimerRef.current = setTimeout(() => {
          setOpenMenu(id);
          openTimerRef.current = null;
        }, openDelayMs);
      }
    },
    [openDelayMs],
  );

  const onPointerLeaveItem = useCallback(
    (id: string, pointerType?: string) => {
      if (pointerType === 'touch') return;

      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
      }

      // If this menu is pinned, hover-leave does NOT close it!
      if (pinnedMenuRef.current === id) return;

      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        if (pinnedMenuRef.current === id) return;
        setOpenMenu((prev) => (prev === id ? null : prev));
        closeTimerRef.current = null;
      }, closeDelayMs);
    },
    [closeDelayMs],
  );

  const onPointerEnterPanel = useCallback((_id: string, pointerType?: string) => {
    if (pointerType === 'touch') return;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const onTriggerClick = useCallback((id: string) => {
    clearTimers();
    const currentOpen = openMenuRef.current;
    const currentPinned = pinnedMenuRef.current;

    if (currentOpen !== id) {
      // Opening by click -> open and pin
      setOpenMenu(id);
      setPinnedMenu(id);
    } else {
      // Already open:
      if (currentPinned === id) {
        // Second click unpins and closes
        setPinnedMenu(null);
        setOpenMenu(null);
      } else {
        // Opened by hover -> click pins it!
        setPinnedMenu(id);
      }
    }
  }, [clearTimers]);

  const onOpenChange = useCallback((id: string, next: boolean) => {
    if (next) {
      setOpenMenu(id);
    } else {
      // ID-aware close: only close if this menu is the currently open one and not pinned
      if (pinnedMenuRef.current === id) return;
      setOpenMenu((prev) => (prev === id ? null : prev));
    }
  }, []);

  const onPointerLeaveNav = useCallback(
    (pointerType?: string) => {
      if (pointerType === 'touch') return;
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
      }
      const current = openMenuRef.current;
      if (!current) return;
      if (pinnedMenuRef.current === current) return;

      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        if (pinnedMenuRef.current === current) return;
        setOpenMenu((prev) => (prev === current ? null : prev));
        closeTimerRef.current = null;
      }, closeDelayMs);
    },
    [closeDelayMs],
  );

  return {
    openMenu,
    pinnedMenu,
    isPinned: (id: string) => pinnedMenu === id,
    onPointerEnterItem,
    onPointerLeaveItem,
    onPointerLeaveNav,
    onPointerEnterPanel,
    onTriggerClick,
    onOpenChange,
    closeAll,
    setOpenMenu,
    setPinnedMenu,
  };
}
