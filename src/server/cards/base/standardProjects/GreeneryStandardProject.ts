import {IPlayer} from '../../../IPlayer';
import {CardName} from '../../../../common/cards/CardName';
import {CardRenderer} from '../../render/CardRenderer';
import {StandardProjectCard} from '../../StandardProjectCard';
import {PlaceGreeneryTile} from '../../../deferredActions/PlaceGreeneryTile';
import {Payment} from '../../../../common/inputs/Payment';
import {Space} from '../../../boards/Space';

export class GreeneryStandardProject extends StandardProjectCard {
  constructor() {
    super({
      name: CardName.GREENERY_STANDARD_PROJECT,
      cost: 23,
      tr: {oxygen: 1},
      metadata: {
        cardNumber: 'SP6',
        renderData: CardRenderer.builder((b) =>
          b.standardProject('Spend 23 M€ to place a greenery tile and raise oxygen 1 step.', (eb) => {
            eb.megacredits(23).startAction.greenery();
          }),
        ),
      },
    });
  }

  public override canPayWith(player: IPlayer) {
    if (player.tableau.has(CardName.SOYLENT_SEEDLING_SYSTEMS)) {
      return {seeds: true};
    } else {
      return {};
    }
  }

  protected override bespokeCanAct(player: IPlayer): boolean {
    // This is pricey because it forces calling canPlayOptions twice.
    if (player.game.board.getAvailableSpacesForGreenery(player, this.canPlayOptions(player)).length === 0) {
      return false;
    }
    return true;
  }

  actionEssence(player: IPlayer): void {
    player.game.defer(new PlaceGreeneryTile(player));
  }

  public placementSpaces(player: IPlayer, cost = this.getAdjustedCost(player)): ReadonlyArray<Space> {
    const board = player.game.board;
    return board.filterSpacesAroundRedCity(board.getAvailableSpacesForGreenery(player, {...this.canPlayOptions(player), cost}));
  }

  public payAndPlace(player: IPlayer, payment: Payment, space: Space): void {
    player.pay(payment);
    this.projectPlayed(player);
    player.defer(() => player.game.addGreenery(player, space));
  }
}
