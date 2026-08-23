import type { Route } from '../types/map';
import type {
  NormalTrainCardColor,
  PaymentOption,
  TrainCardColor,
  TrainCardHand,
} from './gameTypes';

export const NORMAL_TRAIN_CARD_COLORS: NormalTrainCardColor[] = [
  'red',
  'blue',
  'green',
  'yellow',
  'black',
  'white',
  'orange',
  'pink',
];

export const TRAIN_DECK_COMPOSITION: Record<TrainCardColor, number> = {
  red: 12,
  blue: 12,
  green: 12,
  yellow: 12,
  black: 12,
  white: 12,
  orange: 12,
  pink: 12,
  locomotive: 14,
};

export function createEmptyHand(): TrainCardHand {
  return {
    red: 0,
    blue: 0,
    green: 0,
    yellow: 0,
    black: 0,
    white: 0,
    orange: 0,
    pink: 0,
    locomotive: 0,
  };
}

export function createTrainDeck(): TrainCardColor[] {
  return Object.entries(TRAIN_DECK_COMPOSITION).flatMap(([color, count]) =>
    Array.from({ length: count }, () => color as TrainCardColor),
  );
}

export function shuffleCards<T>(cards: T[]) {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function countCards(hand: TrainCardHand) {
  return Object.values(hand).reduce((total, count) => total + count, 0);
}

export function addCardToHand(hand: TrainCardHand, card: TrainCardColor): TrainCardHand {
  return {
    ...hand,
    [card]: hand[card] + 1,
  };
}

interface CardSupply {
  trainDeck: TrainCardColor[];
  trainDiscardPile: TrainCardColor[];
}

export function drawOneCard(supply: CardSupply): CardSupply & { card?: TrainCardColor } {
  let trainDeck = [...supply.trainDeck];
  let trainDiscardPile = [...supply.trainDiscardPile];

  if (trainDeck.length === 0 && trainDiscardPile.length > 0) {
    trainDeck = shuffleCards(trainDiscardPile);
    trainDiscardPile = [];
  }

  const card = trainDeck[0];

  return {
    card,
    trainDeck: card ? trainDeck.slice(1) : trainDeck,
    trainDiscardPile,
  };
}

export function dealCards(
  count: number,
  supply: CardSupply,
): CardSupply & { cards: TrainCardColor[] } {
  let nextSupply = supply;
  const cards: TrainCardColor[] = [];

  for (let index = 0; index < count; index += 1) {
    const result = drawOneCard(nextSupply);

    if (!result.card) {
      return { ...result, cards };
    }

    cards.push(result.card);
    nextSupply = {
      trainDeck: result.trainDeck,
      trainDiscardPile: result.trainDiscardPile,
    };
  }

  return { ...nextSupply, cards };
}

export function maintainFaceUpCards(
  faceUpTrainCards: TrainCardColor[],
  supply: CardSupply,
): CardSupply & { faceUpTrainCards: TrainCardColor[] } {
  let nextFaceUpTrainCards = [...faceUpTrainCards];
  let trainDeck = [...supply.trainDeck];
  let trainDiscardPile = [...supply.trainDiscardPile];

  while (nextFaceUpTrainCards.length < 5) {
    const result = drawOneCard({ trainDeck, trainDiscardPile });

    if (!result.card) {
      break;
    }

    nextFaceUpTrainCards = [...nextFaceUpTrainCards, result.card];
    trainDeck = result.trainDeck;
    trainDiscardPile = result.trainDiscardPile;
  }

  for (let refreshCount = 0; refreshCount < 10; refreshCount += 1) {
    const locomotiveCount = nextFaceUpTrainCards.filter((card) => card === 'locomotive').length;

    if (nextFaceUpTrainCards.length < 5 || locomotiveCount < 3) {
      break;
    }

    trainDiscardPile = [...trainDiscardPile, ...nextFaceUpTrainCards];
    nextFaceUpTrainCards = [];

    const result = dealCards(5, { trainDeck, trainDiscardPile });
    nextFaceUpTrainCards = result.cards;
    trainDeck = result.trainDeck;
    trainDiscardPile = result.trainDiscardPile;
  }

  return {
    faceUpTrainCards: nextFaceUpTrainCards,
    trainDeck,
    trainDiscardPile,
  };
}

export function getLegalPaymentOptions(route: Route, hand: TrainCardHand): PaymentOption[] {
  return getLegalRoutePaymentOptions(route, hand);
}

export function getLegalRoutePaymentOptions(route: Route, hand: TrainCardHand): PaymentOption[] {
  const locomotivesRequired = route.type === 'ferry' ? route.locomotivesRequired ?? 0 : 0;
  const minimumLocomotives = Math.min(locomotivesRequired, route.length);

  if (route.color && route.color !== 'gray') {
    return getPaymentOptionsForColor(route.color, route.length, hand, minimumLocomotives);
  }

  return [
    ...NORMAL_TRAIN_CARD_COLORS.flatMap((color) =>
      getPaymentOptionsForColor(color, route.length, hand, minimumLocomotives),
    ),
    ...(hand.locomotive >= route.length
      ? [{ paymentColor: 'locomotive' as const, normalCards: 0, locomotives: route.length }]
      : []),
  ];
}

function getPaymentOptionsForColor(
  color: NormalTrainCardColor,
  cost: number,
  hand: TrainCardHand,
  minimumLocomotives: number,
): PaymentOption[] {
  const maximumLocomotives = Math.min(cost, hand.locomotive);
  const payments: PaymentOption[] = [];

  for (let locomotives = minimumLocomotives; locomotives <= maximumLocomotives; locomotives += 1) {
    const normalCards = cost - locomotives;

    if (hand[color] >= normalCards) {
      payments.push({ paymentColor: color, normalCards, locomotives });
    }
  }

  return payments;
}

export function drawTunnelRevealCards(
  supply: CardSupply,
  count = 3,
): CardSupply & { revealedCards: TrainCardColor[] } {
  let nextSupply = supply;
  const revealedCards: TrainCardColor[] = [];

  for (let index = 0; index < count; index += 1) {
    const result = drawOneCard(nextSupply);

    if (!result.card) {
      return { ...result, revealedCards };
    }

    revealedCards.push(result.card);
    nextSupply = {
      trainDeck: result.trainDeck,
      trainDiscardPile: result.trainDiscardPile,
    };
  }

  return { ...nextSupply, revealedCards };
}

export function getTunnelExtraCost(
  basePayment: PaymentOption,
  revealedCards: TrainCardColor[],
) {
  return revealedCards.filter((card) => {
    if (card === 'locomotive') {
      return true;
    }

    return basePayment.paymentColor !== 'locomotive' && card === basePayment.paymentColor;
  }).length;
}

export function getLegalTunnelExtraPaymentOptions(
  basePayment: PaymentOption,
  extraCost: number,
  handAfterBasePayment: TrainCardHand,
): PaymentOption[] {
  if (extraCost === 0) {
    return [{ paymentColor: basePayment.paymentColor, normalCards: 0, locomotives: 0 }];
  }

  if (basePayment.paymentColor === 'locomotive') {
    return handAfterBasePayment.locomotive >= extraCost
      ? [{ paymentColor: 'locomotive', normalCards: 0, locomotives: extraCost }]
      : [];
  }

  const normalCards = Math.min(handAfterBasePayment[basePayment.paymentColor], extraCost);
  const locomotives = extraCost - normalCards;

  return normalCards + handAfterBasePayment.locomotive >= extraCost
    ? [{ paymentColor: basePayment.paymentColor, normalCards, locomotives }]
    : [];
}

export function getLegalWildcardPaymentOptions(cost: number, hand: TrainCardHand): PaymentOption[] {
  const locomotives = hand.locomotive;
  const normalOptions = NORMAL_TRAIN_CARD_COLORS.filter(
    (color) => hand[color] + locomotives >= cost,
  ).map((color) => {
    const normalCards = Math.min(hand[color], cost);

    return {
      paymentColor: color,
      normalCards,
      locomotives: cost - normalCards,
    };
  });

  return locomotives >= cost
    ? [...normalOptions, { paymentColor: 'locomotive', normalCards: 0, locomotives: cost }]
    : normalOptions;
}

export function spendTrainCards(hand: TrainCardHand, payment: PaymentOption): TrainCardHand {
  if (payment.paymentColor === 'locomotive') {
    return {
      ...hand,
      locomotive: hand.locomotive - payment.locomotives,
    };
  }

  return {
    ...hand,
    [payment.paymentColor]: hand[payment.paymentColor] - payment.normalCards,
    locomotive: hand.locomotive - payment.locomotives,
  };
}

export function paymentToDiscardPile(payment: PaymentOption): TrainCardColor[] {
  return [
    ...Array.from({ length: payment.normalCards }, () => payment.paymentColor).filter(
      (color): color is NormalTrainCardColor => color !== 'locomotive',
    ),
    ...Array.from({ length: payment.locomotives }, () => 'locomotive' as const),
  ];
}
