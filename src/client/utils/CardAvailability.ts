import {CardName} from '@/common/cards/CardName';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Phase} from '@/common/Phase';

export function getCardAvailability(view: PlayerViewModel) {
  const projects = new Set<CardName>();
  const actions = new Set<CardName>();
  if (view.game.phase !== Phase.ACTION || !view.thisPlayer.isActive || view.game.passedPlayers.includes(view.color)) {
    return {projects, actions};
  }

  function collect(input: PlayerInputModel | undefined) {
    if (input === undefined || input.optional) {
      return;
    }
    if (input.type === 'or') {
      input.options.forEach(collect);
    } else if (input.type === 'projectCard' || (input.type === 'card' && input.selectBlueCardAction)) {
      const target = input.type === 'projectCard' ? projects : actions;
      for (const card of input.cards) {
        if (!card.isDisabled) {
          target.add(card.name);
        }
      }
    }
  }

  collect(view.waitingFor);
  return {projects, actions};
}
