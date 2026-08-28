import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  onToggleTheme?: () => void;
  onFocusSearch?: () => void;
  onSetViewGrid?: () => void;
  onSetViewList?: () => void;
  onSetViewMagazine?: () => void;
  onCloseModal?: () => void;
  onRefresh?: () => void;
}

export function useKeyboardShortcuts({
  onToggleTheme,
  onFocusSearch,
  onSetViewGrid,
  onSetViewList,
  onSetViewMagazine,
  onCloseModal,
  onRefresh,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input, textarea or contenteditable
      const target = e.target as HTMLElement;
      const isInput = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable || 
        target.classList.contains('ProseMirror');

      // Escape key always triggers (e.g. closes modals or blurs search)
      if (e.key === 'Escape') {
        if (isInput) {
          target.blur();
        }
        onCloseModal?.();
        return;
      }

      // Quick Search shortcut: '/' or 'Cmd/Ctrl + K'
      if ((e.key === '/' && !isInput) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        onFocusSearch?.();
        const searchInput = document.querySelector('#header-search input') as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // Ignore remaining shortcuts if user is currently typing
      if (isInput) return;

      // Theme toggle: 't' or 'T'
      if (e.key === 't' || e.key === 'T') {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          onToggleTheme?.();
        }
      }

      // View modes: 1 = Grid, 2 = Magazine, 3 = List
      if (e.key === '1') {
        onSetViewGrid?.();
      } else if (e.key === '2') {
        onSetViewMagazine?.();
      } else if (e.key === '3') {
        onSetViewList?.();
      }

      // Refresh shortcut: 'r' (without modifier)
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        onRefresh?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleTheme, onFocusSearch, onSetViewGrid, onSetViewList, onSetViewMagazine, onCloseModal, onRefresh]);
}
