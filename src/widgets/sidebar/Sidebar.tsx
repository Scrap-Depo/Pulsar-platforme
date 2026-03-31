import { Copy, GripVertical, MessageCircleMore, BarChart3, Cloud, Plus, Trash2 } from 'lucide-react';
import { Session, SessionSlide } from '../../shared/types/common';
import Button from '../../shared/ui/Button';

type SidebarProps = {
  appTitle: string;
  session: Session;
  currentSlide: SessionSlide | null;
  liveSlide: SessionSlide | null;
  onCurrentSlideChange: (slideId: string) => void;
  onCreateSlide: () => void;
  onDuplicateSlide: (slideId: string) => void;
  onRemoveSlide: (slideId: string) => void;
  onReorderSlides: (draggedSlideId: string, targetSlideId: string) => void;
};

export default function Sidebar({
  appTitle,
  session,
  currentSlide,
  liveSlide,
  onCurrentSlideChange,
  onCreateSlide,
  onDuplicateSlide,
  onRemoveSlide,
  onReorderSlides,
}: SidebarProps) {
  function getVisualizationLabel(slide: SessionSlide) {
    switch (slide.type) {
      case 'multiple-choice':
        return (
          {
            bar: 'столбцы',
            pie: 'круг',
            donut: 'кольцо',
          }[slide.visualization]
        );
      case 'open-answers':
        return (
          {
            cards: 'карточки',
            bubbles: 'пузыри',
            wall: 'стена',
          }[slide.visualization]
        );
      case 'pulse':
        return (
          {
            scale: 'шкала',
            bars: 'столбцы',
            line: 'линия',
          }[slide.visualization]
        );
      case 'word-cloud':
        return (
          {
            cloud: 'облако',
            bubbles: 'пузыри',
            constellation: 'созвездие',
          }[slide.visualization]
        );
      default:
        return '';
    }
  }

  function getSlideTypeLabel(slide: SessionSlide) {
    switch (slide.type) {
      case 'multiple-choice':
        return 'Голосование';
      case 'open-answers':
        return 'Открытые ответы';
      case 'pulse':
        return 'Пульс';
      case 'word-cloud':
        return 'Облако слов';
      default:
        return '';
    }
  }

  function getSlidePreview(slide: SessionSlide) {
    switch (slide.type) {
      case 'multiple-choice':
        return `${slide.options.length} вариантов · ${getVisualizationLabel(slide)}`;
      case 'open-answers':
        return `${slide.allowLikes ? 'с лайками' : 'без лайков'} · ${getVisualizationLabel(slide)}`;
      case 'pulse':
        return `${slide.minLabel} -> ${slide.maxLabel} · ${getVisualizationLabel(slide)}`;
      case 'word-cloud':
        return `${slide.useAI ? 'с нормализацией' : 'без нормализации'} · ${getVisualizationLabel(slide)}`;
      default:
        return '';
    }
  }

  function renderSlideThumbnail(slide: SessionSlide) {
    if (slide.type === 'multiple-choice') {
      if (slide.visualization === 'pie') {
        return (
          <div className="slide-thumb slide-thumb-pie">
            <div className="slide-thumb-pie-disk" />
          </div>
        );
      }

      if (slide.visualization === 'donut') {
        return (
          <div className="slide-thumb slide-thumb-pie">
            <div className="slide-thumb-donut-disk" />
          </div>
        );
      }

      return (
        <div className="slide-thumb slide-thumb-bars">
          <span style={{ height: 22 }} />
          <span style={{ height: 36 }} />
          <span style={{ height: 18 }} />
          <span style={{ height: 30 }} />
        </div>
      );
    }

    if (slide.type === 'open-answers') {
      if (slide.visualization === 'bubbles') {
        return (
          <div className="slide-thumb slide-thumb-bubbles">
            <span className="bubble bubble-lg" />
            <span className="bubble bubble-md" />
            <span className="bubble bubble-sm" />
          </div>
        );
      }

      if (slide.visualization === 'wall') {
        return (
          <div className="slide-thumb slide-thumb-wall">
            <span />
            <span />
            <span />
            <span />
          </div>
        );
      }

      return (
        <div className="slide-thumb slide-thumb-cards">
          <span />
          <span />
          <span />
        </div>
      );
    }

    if (slide.type === 'pulse') {
      if (slide.visualization === 'line') {
        return (
          <div className="slide-thumb slide-thumb-line">
            <svg viewBox="0 0 100 52" className="slide-thumb-svg" aria-hidden="true">
              <polyline points="6,40 28,32 50,18 72,24 94,12" />
            </svg>
          </div>
        );
      }

      if (slide.visualization === 'bars') {
        return (
          <div className="slide-thumb slide-thumb-bars">
            <span style={{ height: 18 }} />
            <span style={{ height: 26 }} />
            <span style={{ height: 34 }} />
            <span style={{ height: 24 }} />
          </div>
        );
      }

      return (
        <div className="slide-thumb slide-thumb-scale">
          <div className="slide-thumb-scale-track" />
          <div className="slide-thumb-scale-dot" />
        </div>
      );
    }

    if (slide.visualization === 'bubbles') {
      return (
        <div className="slide-thumb slide-thumb-bubbles">
          <span className="bubble bubble-lg" />
          <span className="bubble bubble-md" />
          <span className="bubble bubble-sm" />
        </div>
      );
    }

    if (slide.visualization === 'constellation') {
      return (
        <div className="slide-thumb slide-thumb-line">
          <svg viewBox="0 0 100 52" className="slide-thumb-svg" aria-hidden="true">
            <polyline points="10,34 26,20 46,28 64,14 88,22" />
            <circle cx="10" cy="34" r="3" />
            <circle cx="26" cy="20" r="3" />
            <circle cx="46" cy="28" r="3" />
            <circle cx="64" cy="14" r="3" />
            <circle cx="88" cy="22" r="3" />
          </svg>
        </div>
      );
    }

    return (
      <div className="slide-thumb slide-thumb-cloud">
        <span className="cloud cloud-lg">идеи</span>
        <span className="cloud cloud-md">команда</span>
        <span className="cloud cloud-sm">фокус</span>
      </div>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <p className="muted" style={{ margin: 0 }}>Сценарий сессии</p>
        <h2 style={{ margin: '6px 0 0', fontSize: 'calc(22px + 6px * var(--sidebar-scale, 1))' }}>{appTitle}</h2>
        <p className="muted" style={{ margin: '8px 0 0' }}>
          {liveSlide ? `В эфире: ${liveSlide.title}` : 'Эфир пока пуст'}
        </p>
        <p className="muted" style={{ margin: '8px 0 0' }}>
          Код входа: {session.joinCode}
        </p>
      </div>

      <div>
        <p className="muted" style={{ margin: '0 0 12px' }}>Слайды</p>
        <div className="section-stack">
          {session.slides.map((slide, index) => {
            const icon =
              slide.type === 'multiple-choice' ? <BarChart3 size={16} /> :
              slide.type === 'open-answers' ? <MessageCircleMore size={16} /> :
              slide.type === 'pulse' ? <BarChart3 size={16} /> :
              <Cloud size={16} />;
            const isCurrent = currentSlide?.id === slide.id;
            const isLive = liveSlide?.id === slide.id;

            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => onCurrentSlideChange(slide.id)}
                className={`sidebar-slide-card ${isCurrent ? 'sidebar-slide-card-active' : ''}`}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/slide-id', slide.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const draggedSlideId = event.dataTransfer.getData('text/slide-id');

                  if (draggedSlideId) {
                    onReorderSlides(draggedSlideId, slide.id);
                  }
                }}
              >
                <span className="sidebar-slide-thumb">{renderSlideThumbnail(slide)}</span>
                <span className="sidebar-slide-copy">
                  <span className="sidebar-slide-topline">
                    <span className="sidebar-slide-index">{index + 1}</span>
                    <span className="sidebar-slide-grip"><GripVertical size={14} /></span>
                    <span className="sidebar-slide-type">{icon}{getSlideTypeLabel(slide)}</span>
                  </span>
                  <strong className="sidebar-slide-title">{slide.title}</strong>
                  <span className="sidebar-slide-preview">{getSlidePreview(slide)}</span>
                  <span className="sidebar-slide-flags">
                    {isCurrent && <span className="admin-flag admin-flag-edit">Редактируется</span>}
                    {isLive && <span className="admin-flag admin-flag-live">В эфире</span>}
                  </span>
                  <span className="sidebar-slide-actions">
                    <button
                      type="button"
                      className="sidebar-slide-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDuplicateSlide(slide.id);
                      }}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      className="sidebar-slide-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveSlide(slide.id);
                      }}
                      disabled={session.slides.length <= 1}
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 14 }}>
          <Button icon={<Plus size={16} />} onClick={onCreateSlide} style={{ width: '100%', justifyContent: 'center' }}>
            Новый слайд
          </Button>
        </div>
      </div>
    </aside>
  );
}
