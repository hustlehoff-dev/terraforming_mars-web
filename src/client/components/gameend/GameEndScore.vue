<template>
  <article class="end-score" :class="['end-score--' + player.color, {'end-score--winner': winner}]">
    <header class="end-score__head">
      <span class="end-score__place">{{ place }}</span>
      <div class="end-score__who">
        <strong :class="'player_bg_color_' + player.color" class="end-score__name">{{ player.name }}</strong>
        <small>{{ corporations }}</small>
      </div>
      <div class="end-score__total">
        <b>{{ vp.total }}</b>
        <small v-i18n>VP</small>
      </div>
    </header>
    <p v-if="winner" class="end-score__crown"><span aria-hidden="true">🏆</span> {{ $t('Winner') }}</p>

    <ul class="end-score__rows">
      <li v-for="row in rows" :key="row.key" class="end-score__row">
        <details v-if="row.items.length > 0" class="end-score__details">
          <summary>
            <span class="end-score__label">{{ $t(row.label) }}</span>
            <span class="end-score__why">{{ row.why }}</span>
            <span class="end-score__vp">{{ row.vp }}</span>
          </summary>
          <ul class="end-score__items">
            <li v-for="item in row.items" :key="item.key">
              <button v-if="item.card" type="button" class="end-score__item end-score__item--card" @click="openCard(item.card)">
                <span>{{ item.text }}</span><b>{{ signed(item.vp) }}</b>
              </button>
              <span v-else class="end-score__item"><span>{{ item.text }}</span><b>{{ signed(item.vp) }}</b></span>
            </li>
          </ul>
        </details>
        <div v-else class="end-score__plain">
          <span class="end-score__label">{{ $t(row.label) }}</span>
          <span class="end-score__why">{{ row.why }}</span>
          <span class="end-score__vp">{{ row.vp }}</span>
        </div>
      </li>
    </ul>

    <footer class="end-score__foot">
      <span>{{ player.megacredits }} M€ <small v-i18n>(tiebreaker)</small></span>
      <span>{{ player.actionsTakenThisGame }} {{ $t('actions') }}</span>
    </footer>
  </article>
</template>

<script setup lang="ts">
import {computed} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SpaceModel} from '@/common/models/SpaceModel';
import {CITY_TILES, TileType} from '@/common/TileType';
import {CardType} from '@/common/cards/CardType';
import {getCard} from '@/client/cards/ClientCardManifest';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {zoomCard} from '@/client/components/board/cardZoom';
import {CardModel} from '@/common/models/CardModel';

const props = defineProps<{player: PublicPlayerModel, spaces: ReadonlyArray<SpaceModel>, rank: number, winner: boolean}>();

type Item = {key: string, text: string, vp: number, card?: CardModel};
type Row = {key: string, label: string, why: string, vp: number, items: Array<Item>};

const vp = computed(() => props.player.victoryPointsBreakdown);
const place = computed(() => `${props.rank}.`);
const corporations = computed(() => props.player.tableau
  .filter((card) => getCard(card.name)?.type === CardType.CORPORATION)
  .map((card) => translateText(card.name)).join(' + '));

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function openCard(card: CardModel) {
  zoomCard(card);
}

const rows = computed((): Array<Row> => {
  const b = vp.value;
  const result: Array<Row> = [];
  result.push({key: 'tr', label: 'Terraform Rating', why: $t('1 VP per TR step'), vp: b.terraformRating, items: []});

  const milestones = b.detailsMilestones.map((detail, index) => ({
    key: 'm' + index,
    text: translateText(detail.messageArgs?.[0] ?? ''),
    vp: detail.victoryPoint,
  }));
  result.push({key: 'milestones', label: 'Milestones', why: milestones.map((item) => item.text).join(', ') || $t('none'), vp: b.milestones, items: milestones});

  const awards = b.detailsAwards.map((detail, index) => {
    const [placeName, award, funder] = detail.messageArgs ?? [];
    return {
      key: 'a' + index,
      text: translateTextWithParams('${0} place: ${1} (funded by ${2})', [placeName === '1st' ? '1.' : '2.', translateText(award ?? ''), funder ?? '']),
      vp: detail.victoryPoint,
    };
  });
  result.push({key: 'awards', label: 'Awards', why: b.detailsAwards.map((detail) => translateText(detail.messageArgs?.[1] ?? '')).join(', ') || $t('none'), vp: b.awards, items: awards});

  const greeneries = props.spaces.filter((space) => space.color === props.player.color && space.tileType === TileType.GREENERY).length;
  result.push({key: 'greenery', label: 'Greeneries', why: translateTextWithParams('${0} greenery tile(s), 1 VP each', [String(greeneries)]), vp: b.greenery, items: []});

  const cities = props.spaces.filter((space) => space.color === props.player.color && space.tileType !== undefined && CITY_TILES.has(space.tileType));
  result.push({
    key: 'city',
    label: 'Cities',
    why: translateTextWithParams('${0} city tile(s): 1 VP per adjacent greenery (anyone\'s)', [String(cities.length)]),
    vp: b.city,
    items: cities.map((space) => ({
      key: 'c' + space.id,
      text: translateTextWithParams('City ${0}: ${1} adjacent greenery', [space.a9 ?? space.id, String(space.adjacentGreenery ?? 0)]),
      vp: space.adjacentGreenery ?? 0,
    })),
  });

  const cards = b.detailsCards
    .filter((detail) => detail.victoryPoint !== 0)
    .toSorted((a, c) => c.victoryPoint - a.victoryPoint)
    .map((detail, index) => {
      const card = props.player.tableau.find((model) => model.name === detail.cardName);
      const resources = card?.resources ? ` (${card.resources})` : '';
      return {key: 'k' + index, text: translateText(detail.cardName) + resources, vp: detail.victoryPoint, card};
    });
  result.push({key: 'cards', label: 'Cards and other', why: translateTextWithParams('${0} card(s) with VP', [String(cards.length)]), vp: b.victoryPoints, items: cards});

  const extras: Array<[string, number]> = [
    ['Moon roads', b.moonRoads], ['Moon habitats', b.moonHabitats], ['Moon mines', b.moonMines],
    ['Planetary tracks', b.planetaryTracks], ['Escape Velocity penalty', b.escapeVelocity],
  ];
  for (const [label, value] of extras) {
    if (value !== 0) {
      result.push({key: label, label, why: '', vp: value, items: []});
    }
  }
  return result;
});
</script>

<style lang="less">
.end-score {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid #ead9c6;
  border-radius: 16px;
  background: #fffaf4;
  box-shadow: 0 4px 14px #0000001a;
  color: #2d1d14;

  &--winner {
    border-color: #f2a531;
    box-shadow: 0 0 0 1px #f2a531, 0 6px 20px #f2a53133;
  }
}

.end-score__head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.end-score__place {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: #f1e6da;
  font-size: 1.2rem;
  font-weight: 900;

  .end-score--winner & {
    background: #f2a531;
    color: #fff;
  }
}

.end-score__who {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;

  small {
    overflow: hidden;
    color: #7d6656;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.end-score__name {
  align-self: flex-start;
  padding: 2px 10px;
  border-radius: 8px;
  color: #fff;
  font-size: 1.15rem;
  text-shadow: 0 1px 2px #000;
}

.end-score__total {
  display: flex;
  align-items: baseline;
  gap: 4px;

  b {
    font-size: 2.4rem;
    line-height: 1;
  }

  small {
    color: #7d6656;
    font-weight: 700;
  }
}

.end-score__crown {
  margin: 0;
  color: #c27a12;
  font-weight: 800;
}

.end-score__rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.end-score__plain,
.end-score__details > summary {
  display: grid;
  align-items: center;
  grid-template-columns: 9.5rem 1fr auto;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: #f6ece1;
}

.end-score__details > summary {
  cursor: pointer;
  list-style: none;

  &::-webkit-details-marker {
    display: none;
  }

  &:hover {
    background: #efe0cf;
  }
}

.end-score__details[open] > summary {
  background: #efe0cf;
}

.end-score__label {
  font-weight: 800;
}

.end-score__why {
  overflow: hidden;
  color: #7d6656;
  font-size: 0.85rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.end-score__vp {
  min-width: 2.5rem;
  color: #2d1d14;
  font-size: 1.15rem;
  font-weight: 900;
  text-align: right;
}

.end-score__items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0 4px;
  padding: 0 4px;
  list-style: none;
}

.end-score__item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border: 1px solid #ead9c6;
  border-radius: 999px;
  background: #fff;
  color: #2d1d14;
  font: inherit;
  font-size: 0.85rem;

  b {
    color: #c2561d;
  }

  &--card {
    cursor: pointer;

    &:hover {
      border-color: #e8743b;
    }
  }
}

.end-score__foot {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: #7d6656;
  font-size: 0.85rem;
}

@media (max-width: 520px) {
  .end-score__plain,
  .end-score__details > summary {
    grid-template-columns: 1fr auto;
  }

  .end-score__why {
    grid-column: 1 / -1;
    grid-row: 2;
    white-space: normal;
  }
}
</style>
