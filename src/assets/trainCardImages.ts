import blackTrain from '../../train_cards/black_train.png';
import blueTrain from '../../train_cards/blue_train.png';
import cardBack from '../../train_cards/draw_card_image.png';
import greenTrain from '../../train_cards/green_train.png';
import locomotiveTrain from '../../train_cards/locomotive_train.png';
import orangeTrain from '../../train_cards/orange_train.png';
import pinkTrain from '../../train_cards/pink_train.png';
import redTrain from '../../train_cards/red_train.png';
import ticketImage from '../../train_cards/ticket_image.png';
import whiteTrain from '../../train_cards/white_train.png';
import yellowTrain from '../../train_cards/yellow_train.png';
import type { TrainCardColor } from '../game/gameTypes';

export type TrainCardImageKey = TrainCardColor | 'back' | 'ticket';

export const trainCardImages: Partial<Record<TrainCardImageKey, string>> = {
  red: redTrain,
  blue: blueTrain,
  green: greenTrain,
  yellow: yellowTrain,
  black: blackTrain,
  white: whiteTrain,
  orange: orangeTrain,
  pink: pinkTrain,
  locomotive: locomotiveTrain,
  back: cardBack,
  ticket: ticketImage,
};
