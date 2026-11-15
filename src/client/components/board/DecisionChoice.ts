import {getAward, getMilestone} from '@/client/MilestoneAwardManifest';
import {Message} from '@/common/logs/Message';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {Color, ColorWithNeutral} from '@/common/Color';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Units} from '@/common/Units';
import {AwardName} from '@/common/ma/AwardName';
import {MilestoneName} from '@/common/ma/MilestoneName';

export type DecisionChoice = {
  title: string | Message;
  literalTitle?: string;
  icon?: string;
  change?: string;
  selected?: boolean;
  targetColor?: Color;
  secondary?: boolean;
  description?: string;
};

export function milestoneAwardChoice(name: AwardName | MilestoneName, kind?: 'awards' | 'milestones'): DecisionChoice {
  const award = kind !== 'milestones' ? getAward(name as AwardName) : undefined;
  const milestone = kind !== 'awards' ? getMilestone(name as MilestoneName) : undefined;
  return {
    title: name,
    icon: `assets/ma/${name.toLowerCase().replaceAll(' ', '-').replaceAll('.', '')}.png`,
    description: (award ?? milestone)?.description,
  };
}

const resourceIcons: Record<keyof Units, string> = {
  megacredits: 'megacredit',
  steel: 'steel',
  titanium: 'titanium',
  plants: 'plant',
  energy: 'power',
  heat: 'heat',
};

export function decisionResourceIcon(resource: keyof Units): string {
  return `assets/resources/${resourceIcons[resource]}.png`;
}

export function decisionPlayerChoices(
  colors: ReadonlyArray<ColorWithNeutral>,
  players: ReadonlyArray<PublicPlayerModel>,
  selected: ColorWithNeutral | undefined,
): ReadonlyArray<DecisionChoice> {
  return colors.map((color) => ({
    title: color === 'NEUTRAL' ? 'Neutral' : color,
    literalTitle: players.find((player) => player.color === color)?.name,
    icon: 'assets/misc/delegate.png',
    selected: color === selected,
    targetColor: color === 'NEUTRAL' ? undefined : color,
  }));
}

const effects: Record<string, Omit<DecisionChoice, 'title' | 'selected'>> = {
  'Increase temperature': {icon: 'assets/global-parameters/temperature.png', change: '+2 °C'},
  'Increase oxygen': {icon: 'assets/global-parameters/oxygen.png', change: '+1%'},
  'Add an ocean': {icon: 'assets/tiles/ocean.png', change: '+1'},
  'Increase Venus scale': {icon: 'assets/global-parameters/venus.png', change: '+2%'},
  'Remove an unprotected hazard': {icon: 'assets/remove-dust-storms.png'},
  'Increase the Moon habitat rate': {icon: 'assets/moon/card-habitat-rate.png', change: '+1'},
  'Increase the Moon mining rate': {icon: 'assets/moon/card-mining-rate.png', change: '+1'},
  'Increase the Moon logistic rate': {icon: 'assets/moon/card-logistic-rate.png', change: '+1'},
  'Spend 1 science resource here to gain 1 standard resource': {icon: 'assets/resources/wild-std.png', change: '+1'},
  'Spend 1 science resource here to gain 1 resource on ANY CARD WITH A RESOURCE.': {icon: 'assets/resources/card.png', change: '+1'},
  'Remove plants from the neutral opponent': {icon: 'assets/resources/plant.png'},
  'Remove resources from the neutral opponent': {icon: 'assets/resources/wild-std.png'},
  'Block with ${0} fighters.': {icon: 'assets/resources/fighter.png'},
  'Block with corruption': {icon: 'assets/underworld/corruption-block.png'},
  'Do not block': {secondary: true},
  'Do not remove': {secondary: true},
  'Do not remove resource': {secondary: true},
  'Do not steal': {secondary: true},
  'Skip removal': {secondary: true},
  'Skip removing plants': {secondary: true},
};

const inputIcons: Partial<Record<PlayerInputModel['type'], string>> = {
  card: 'assets/resources/card.png',
  projectCard: 'assets/resources/card.png',
  player: 'assets/misc/delegate.png',
  delegate: 'assets/misc/delegate.png',
  resource: 'assets/resources/wild-std.png',
  resources: 'assets/resources/wild-std.png',
  space: 'assets/tags/mars.png',
};

export function decisionChoice(input: PlayerInputModel): DecisionChoice {
  const {title} = input;
  const key = typeof title === 'string' ? title : title.message;
  if (input.type === 'option' && typeof title === 'string' &&
    (getAward(title as AwardName)?.name === title || getMilestone(title as MilestoneName)?.name === title)) {
    return milestoneAwardChoice(title as AwardName | MilestoneName);
  }
  return {title, icon: inputIcons[input.type], ...effects[key], ...resourceEffect(title)};
}

// Target choices carry the actual amount and victim in the formatted server message.
function resourceEffect(title: string | Message): Omit<DecisionChoice, 'title'> | undefined {
  const key = typeof title === 'string' ? title : title.message;
  const match = /^(Remove|Steal) (\$\{\d+\}|\d+) (.+?)(?: from (\$\{\d+\}))?$/.exec(key);
  if (match === null) {
    return undefined;
  }
  const placeholder = (token: string) => {
    const index = /^\$\{(\d+)\}$/.exec(token)?.[1];
    return typeof title === 'string' || index === undefined ? undefined : title.data[Number(index)];
  };
  const [, action, quantity, resourceToken, targetToken] = match;
  const target = targetToken === undefined ? undefined : placeholder(targetToken);
  const amount = Number(placeholder(quantity)?.value ?? quantity);
  const resource = placeholder(resourceToken)?.value ?? resourceToken;
  const unit = resource === 'M€' ? 'megacredits' : Units.keys.find((unit) => unit === resource);
  const icon = resource === 'corruption' ? 'assets/underworld/corruption.png' :
    unit === undefined ? undefined : decisionResourceIcon(unit);
  const targetColor = target?.type === LogMessageDataType.PLAYER ? target.value : undefined;
  if ((!icon && !targetColor) || !Number.isSafeInteger(amount) || amount < 0) {
    return undefined;
  }
  const sign = action === 'Steal' && targetColor === undefined ? '+' : '−';
  return {icon, change: `${sign}${amount}`, targetColor};
}
