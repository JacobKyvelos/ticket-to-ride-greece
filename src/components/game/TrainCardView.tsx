import { trainCardImages, type TrainCardImageKey } from '../../assets/trainCardImages';
import type { TrainCardColor } from '../../game/gameTypes';

interface TrainCardViewProps {
  card: TrainCardImageKey;
  label: string;
  count?: number;
  interactive?: boolean;
}

export function formatCardColor(color: TrainCardColor) {
  return color[0].toUpperCase() + color.slice(1);
}

export function TrainCardView({ card, label, count, interactive = false }: TrainCardViewProps) {
  const imageSrc = trainCardImages[card];

  return (
    <span className="train-card-view" data-card-color={card} data-interactive={interactive}>
      {imageSrc ? (
        <img src={imageSrc} alt={label} draggable="false" />
      ) : (
        <span className="train-card-view__fallback">{label}</span>
      )}
      {count !== undefined && <strong className="train-card-view__count">x {count}</strong>}
    </span>
  );
}
