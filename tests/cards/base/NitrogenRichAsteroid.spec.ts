import {expect} from 'chai';
import {NitrogenRichAsteroid} from '../../../src/server/cards/base/NitrogenRichAsteroid';
import {testGame} from '../../TestGame';
import {cast} from '@/common/utils/utils';
import {cardsToModel} from '../../../src/server/models/ModelUtils';

describe('NitrogenRichAsteroid', () => {
  it('Should play', () => {
    const card = new NitrogenRichAsteroid();
    const [game, player] = testGame(2);
    cast(card.play(player), undefined);
    expect(player.terraformRating).to.eq(23);
    expect(game.getTemperature()).to.eq(-28);
    expect(player.production.plants).to.eq(1);
    player.tagsForTest = {plant: 3};
    card.play(player);
    expect(player.terraformRating).to.eq(26);
    expect(game.getTemperature()).to.eq(-26);
    expect(player.production.plants).to.eq(5);
  });

  it('glows in the hand when the 3 plant tags are there', () => {
    const card = new NitrogenRichAsteroid();
    const [, player] = testGame(2);
    const glows = () => cardsToModel(player, [card], {showCalculatedCost: true})[0].strongerEffect;
    expect(glows()).is.undefined;
    player.tagsForTest = {plant: 3};
    expect(glows()).is.true;
  });
});
