import { CSSProperties, ReactNode } from 'react';
import Sidebar from '../sidebar/Sidebar';
import LiquidBackground from '../../shared/ui/LiquidBackground';
import { Session, SessionSlide } from '../../shared/types/common';
import { usePanelResize } from '../../shared/hooks/usePanelResize';

type AdminShellProps = {
  appTitle: string;
  children: ReactNode;
  session: Session;
  currentSlide: SessionSlide | null;
  liveSlide: SessionSlide | null;
  onCurrentSlideChange: (slideId: string) => void;
  onCreateSlide: () => void;
  onDuplicateSlide: (slideId: string) => void;
  onRemoveSlide: (slideId: string) => void;
  onReorderSlides: (draggedSlideId: string, targetSlideId: string) => void;
};

export default function AdminShell({
  appTitle,
  children,
  session,
  currentSlide,
  liveSlide,
  onCurrentSlideChange,
  onCreateSlide,
  onDuplicateSlide,
  onRemoveSlide,
  onReorderSlides,
}: AdminShellProps) {
  const { panelWidth, setPanelWidth } = usePanelResize(330);
  const minSidebarWidth = 260;
  const maxSidebarWidth = 430;
  const clampedWidth = Math.min(Math.max(panelWidth, minSidebarWidth), maxSidebarWidth);
  const sidebarScale = (clampedWidth - minSidebarWidth) / (maxSidebarWidth - minSidebarWidth);

  function startResize(clientX: number, startWidth: number) {
    function handleMove(moveEvent: MouseEvent) {
      const nextWidth = startWidth + (moveEvent.clientX - clientX);
      setPanelWidth(Math.min(Math.max(nextWidth, minSidebarWidth), maxSidebarWidth));
    }

    function handleUp() {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    }

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }

  return (
    <div className="page-shell">
      <LiquidBackground />
      <div
        className="page-content grid-layout"
        style={
          {
            '--sidebar-width': `${clampedWidth}px`,
            '--sidebar-scale': sidebarScale.toString(),
          } as CSSProperties
        }
      >
        <div className="sidebar-shell">
          <Sidebar
            appTitle={appTitle}
            session={session}
            currentSlide={currentSlide}
            liveSlide={liveSlide}
            onCurrentSlideChange={onCurrentSlideChange}
            onCreateSlide={onCreateSlide}
            onDuplicateSlide={onDuplicateSlide}
            onRemoveSlide={onRemoveSlide}
            onReorderSlides={onReorderSlides}
          />
        </div>
        <div
          className="sidebar-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Изменить ширину панели слайдов"
          onMouseDown={(event) => {
            event.preventDefault();
            startResize(event.clientX, clampedWidth);
          }}
        />
        <main className="main-area">{children}</main>
      </div>
    </div>
  );
}
