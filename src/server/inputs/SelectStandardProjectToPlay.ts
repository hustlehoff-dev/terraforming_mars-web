import {Payment} from '../../common/inputs/Payment';
import {IStandardProjectCard} from '../cards/IStandardProjectCard';
import {IPlayer} from '../IPlayer';
import {SelectProjectCardToPlayResponse} from '../../common/inputs/InputResponse';
import {CardName} from '../../common/cards/CardName';
import {InputError} from './InputError';
import {PaymentOptions} from '../../common/inputs/Payment';
import {Config, PlayCardMetadata, SelectCardToPlay} from './SelectCardToPlay';
import {GreeneryStandardProject} from '../cards/base/standardProjects/GreeneryStandardProject';
import {SelectProjectCardToPlayModel} from '../../common/models/PlayerInputModel';
import {SpaceId} from '../../common/Types';
import {Units} from '../../common/Units';

export class SelectStandardProjectToPlay extends SelectCardToPlay<IStandardProjectCard> {
  constructor(
    player: IPlayer,
    cards: ReadonlyArray<IStandardProjectCard>,
    config?: Config) {
    super(player, cards, config);
    this.buttonLabel = config?.buttonLabel ?? 'Play Standard Project';
  }

  public override toModel(player: IPlayer): SelectProjectCardToPlayModel {
    const model = super.toModel(player);
    const project = this.cards.find((card) => card instanceof GreeneryStandardProject);
    if (project) {
      const spaces = project.placementSpaces(player, this.extras.get(project.name)?.overriddenCost);
      if (spaces.length > 0) {
        model.greeneryPlacement = {type: 'space', title: 'Select space for greenery tile', buttonLabel: 'Confirm', spaces: spaces.map(({id}) => id)};
      }
    }
    return model;
  }

  public validate(card: IStandardProjectCard, input: SelectProjectCardToPlayResponse, details: PlayCardMetadata) {
    // The client greys out projects whose canAct is false (via the `enabled` array), but the
    // server must enforce it too: process() never consults `enabled`, and projects whose
    // requirement isn't just the M€ cost (e.g. Collusion spending corruption) would otherwise
    // execute regardless. See https://github.com/terraforming-mars/terraforming-mars/issues/8238.
    //
    // This only matters for menus that offer non-actable projects (the standard projects menu and
    // Established Methods). A discounted play (overriddenCost set, e.g. Standard Technology) is
    // already handed a canAct-filtered list, so re-checking here is redundant and, worse, would
    // re-evaluate affordability at the full undiscounted cost and reject a play the player can
    // afford at the discount. See https://github.com/terraforming-mars/terraforming-mars/issues/8247.
    if (details.overriddenCost === undefined && !card.canAct(this.player)) {
      throw new InputError('You cannot play this standard project');
    }
    const canPayWith = card.canPayWith(this.player);
    const paymentOptions: Partial<PaymentOptions> = {
      heat: this.player.canUseHeatAsMegaCredits,
      steel: canPayWith.steel,
      titanium: canPayWith.titanium,
      lunaTradeFederationTitanium: this.player.canUseTitaniumAsMegacredits,
      seeds: canPayWith.seeds,
      auroraiData: this.player.tableau.has(CardName.AURORAI),
      spireScience: this.player.tableau.has(CardName.SPIRE),
      kuiperAsteroids: canPayWith.kuiperAsteroids ? this.player.tableau.has(CardName.KUIPER_COOPERATIVE) : false,
    };

    const reserveUnits = details.reserveUnits;

    if (!this.player.canSpend(input.payment, reserveUnits)) {
      throw new InputError('You do not have that many resources');
    }
    const amountPaid = this.player.payingAmount(input.payment, paymentOptions);
    const requiredCost = details.overriddenCost ?? card.getAdjustedCost(this.player);
    if (amountPaid < requiredCost) {
      throw new InputError('Did not spend enough to pay for standard project');
    }
    return undefined;
  }

  // Public for tests
  public payAndPlay(card: IStandardProjectCard, payment: Payment, spaceId?: SpaceId) {
    if (spaceId === undefined) {
      card.payAndExecute(this.player, payment);
    } else {
      if (!(card instanceof GreeneryStandardProject)) {
        throw new InputError('This standard project does not accept a sector');
      }
      const space = card.placementSpaces(this.player, this.extras.get(card.name)?.overriddenCost).find(({id}) => id === spaceId);
      const reserveUnits = Units.of({megacredits: payment.megacredits, heat: payment.heat, titanium: payment.titanium});
      if (!space || !this.player.game.board.canAfford(this.player, space, {
        cost: 0, reserveUnits, heat: this.player.canUseHeatAsMegaCredits, lunaTradeFederationTitanium: this.player.canUseTitaniumAsMegacredits,
      })) {
        throw new InputError('Space not available');
      }
      card.payAndPlace(this.player, payment, space);
    }
    this.cb(card);
  }
}
