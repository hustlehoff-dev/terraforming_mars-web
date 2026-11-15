<template>
  <Teleport to="body">
    <!-- A dialog so it opens above other game windows (e.g. Played Cards). Closed by a click outside the panel or Escape. -->
    <dialog v-if="card" ref="dialog" class="mission-card-zoom" :aria-label="$t(card.name)"
      @cancel.prevent="closeCardZoom()" @click="closeCardZoom()">
      <div class="mission-card-zoom__layout">
        <div class="mission-card-zoom__card">
          <Card :key="card.name" :card="card" art autoTall />
        </div>
        <!-- About the card: what it is, where it comes from, who has it, and the deck. -->
        <aside v-if="info" class="mission-card-zoom__info" @click.stop>
          <p class="mission-card-zoom__kind">{{ $t(info.typeLabel) }}<template v-if="info.expansion"> · {{ info.expansion }}</template><template v-if="info.number"> · #{{ info.number }}</template></p>
          <h2>{{ $t(card.name) }}</h2>

          <section v-if="info.lore" class="mission-card-zoom__lore">
            <h3 v-i18n>Background</h3>
            <p>{{ info.lore }}</p>
          </section>

          <dl class="mission-card-zoom__facts">
            <template v-if="info.cost !== undefined">
              <dt v-i18n>Cost</dt>
              <dd v-html="renderIcons(info.cost + ' :r:mc:')"></dd>
            </template>
            <template v-if="info.tags.length">
              <dt v-i18n>Tags</dt>
              <dd class="mission-card-zoom__tags">
                <img v-for="(tag, index) in info.tags" :key="index" :src="'assets/tags/' + tag + '.png'" :alt="$t(tag)" :title="$t(tag)">
              </dd>
            </template>
            <template v-if="info.points">
              <dt v-i18n>Victory points</dt>
              <dd>{{ info.points }}</dd>
            </template>
            <template v-if="info.owner">
              <dt v-i18n>Played by</dt>
              <dd><span class="mission-card-zoom__owner" :class="'player_bg_color_' + info.owner.color">{{ info.owner.name }}</span></dd>
            </template>
            <template v-if="info.resources !== undefined">
              <dt v-i18n>Resources on the card</dt>
              <dd>{{ info.resources }}</dd>
            </template>
          </dl>

          <section v-if="info.text.length" class="mission-card-zoom__text">
            <h3 v-i18n>What it does</h3>
            <p v-for="(line, index) in info.text" :key="index">{{ line }}</p>
          </section>

          <section v-if="deck" class="mission-card-zoom__deck">
            <h3 v-i18n>Project deck</h3>
            <p>{{ $t('Cards left in the deck') }}: <b>{{ deck.left }}</b> · {{ $t('Discard pile') }}: <b>{{ deck.discarded }}</b></p>
          </section>

          <button type="button" class="mission-card-zoom__close" @click="closeCardZoom()" v-i18n>Close</button>
        </aside>
      </div>
      <p class="mission-card-zoom__hint" v-i18n>Click anywhere to close</p>
    </dialog>
  </Teleport>
</template>

<script setup lang="ts">
import {computed, nextTick, ref, watch} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {closeCardZoom, zoomedCard} from './cardZoom';
import {getCard} from '@/client/cards/ClientCardManifest';
import {MODULE_NAMES} from '@/common/cards/GameModule';
import {CardType} from '@/common/cards/CardType';
import {translateText} from '@/client/directives/i18n';
import {renderIcons} from '@/client/markdown/markdown';
import {ViewModel} from '@/common/models/PlayerModel';
// @ts-ignore - original background texts per card (tools/card-art/generate.py --lore)
import cardLoreJson from '@/client/cards/cardLore.json';

const props = defineProps<{playerView?: ViewModel}>();

const card = computed(() => zoomedCard.value);
const dialog = ref<HTMLDialogElement>();
const lore = cardLoreJson as Record<string, string>;

const TYPE_LABELS: Partial<Record<CardType, string>> = {
  [CardType.AUTOMATED]: 'Automated card',
  [CardType.ACTIVE]: 'Active card',
  [CardType.EVENT]: 'Event card',
  [CardType.PRELUDE]: 'Prelude',
  [CardType.CORPORATION]: 'Corporation',
  [CardType.CEO]: 'CEO',
  [CardType.STANDARD_PROJECT]: 'Standard project',
  [CardType.STANDARD_ACTION]: 'Standard action',
};

/** The sentences printed on the card (its description and the text beside its effects). */
function cardText(node: unknown, out: Array<string>): void {
  if (typeof node === 'string') {
    if (node.trim().length > 3) {
      out.push(node.trim());
    }
  } else if (Array.isArray(node)) {
    node.forEach((child) => cardText(child, out));
  } else if (node !== null && typeof node === 'object') {
    const value = node as {rows?: unknown, text?: unknown};
    cardText(value.rows, out);
    cardText(value.text, out);
  }
}

const info = computed(() => {
  const shown = card.value;
  const known = shown ? getCard(shown.name) : undefined;
  if (shown === undefined || known === undefined) {
    return undefined;
  }
  const text: Array<string> = [];
  const description = known.metadata.description;
  cardText(typeof description === 'string' ? description : description?.text, text);
  cardText(known.metadata.renderData, text);
  const owner = props.playerView?.players.find((player) => player.tableau.some((model) => model.name === shown.name));
  const vp = known.victoryPoints;
  return {
    typeLabel: TYPE_LABELS[known.type] ?? known.type,
    expansion: MODULE_NAMES[known.module],
    number: known.metadata.cardNumber,
    lore: lore[shown.name],
    cost: known.cost,
    tags: known.tags,
    points: typeof vp === 'number' ? (vp > 0 ? `+${vp}` : String(vp)) : vp !== undefined ? translateText('Depends on the game (see the card)') : undefined,
    owner: owner ? {name: owner.name, color: owner.color} : undefined,
    resources: known.resourceType !== undefined && owner ? shown.resources ?? 0 : undefined,
    text: Array.from(new Set(text.map((line) => translateText(line)))),
  };
});

const deck = computed(() => {
  const game = props.playerView?.game;
  return game === undefined ? undefined : {left: game.deckSize, discarded: game.discardPileSize};
});

watch(card, async (shown) => {
  if (shown === undefined) {
    return;
  }
  await nextTick();
  const element = dialog.value;
  if (element && !element.open) {
    try {
      element.showModal();
    } catch {
      element.setAttribute('open', '');
    }
  }
});
</script>

<style lang="less">
dialog.mission-card-zoom {
  position: fixed;
  inset: 0;
  display: grid;
  width: 100vw;
  max-width: none;
  height: 100dvh;
  max-height: none;
  margin: 0;
  padding: 16px;
  place-content: center;
  justify-items: center;
  gap: 12px;
  overflow: auto;
  border: 0;
  background: #02060acc;
  cursor: zoom-out;

  &::backdrop {
    background: transparent;
  }
}

.mission-card-zoom__layout {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 28px;
}

.mission-card-zoom__card {
  filter: drop-shadow(0 20px 40px #000) drop-shadow(0 0 22px #e2c27f55);

  > .card-container {
    margin: 0;
    zoom: 1.2;

    @media (min-height: 700px) {
      zoom: 1.5;
    }

    @media (min-height: 860px) {
      zoom: 1.8;
    }

    @media (min-height: 1100px) {
      zoom: 2.2;
    }

    @media (max-width: 560px) {
      zoom: 1.3;
    }
  }
}

.mission-card-zoom__info {
  display: grid;
  width: min(380px, calc(100vw - 32px));
  max-height: calc(100dvh - 64px);
  gap: 12px;
  overflow: auto;
  padding: 18px 20px;
  border: 1px solid #e2c27f;
  border-radius: 14px;
  background: linear-gradient(#152330f5, #0b131bf5);
  box-shadow: 0 16px 40px #000c;
  color: #eef6f8;
  cursor: auto;
  font-family: Ubuntu, Arial, sans-serif;

  h2 {
    margin: 0;
    color: #fff3c4;
    font-size: 1.5rem;
    line-height: 1.2;
  }

  h3 {
    margin: 0 0 4px;
    color: #e2c27f;
    font-size: 0.8rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  p {
    margin: 0 0 4px;
    color: #cfe0e6;
    line-height: 1.45;
  }
}

.mission-card-zoom__kind {
  color: #9fb8c2 !important;
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.mission-card-zoom__lore p {
  color: #e6dcc6 !important;
  font-style: italic;
}

.mission-card-zoom__facts {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 6px 14px;
  margin: 0;

  dt {
    color: #9fb8c2;
    font-size: 0.85rem;
  }

  dd {
    margin: 0;
    font-weight: 700;
  }
}

.mission-card-zoom__tags {
  display: flex;
  gap: 4px;

  img {
    width: 26px;
    height: 26px;
  }
}

.mission-card-zoom__owner {
  padding: 2px 8px;
  border-radius: 6px;
  color: #fff;
  text-shadow: 0 1px 2px #000;
}

.mission-card-zoom__close {
  justify-self: end;
  padding: 7px 16px;
  border: 1px solid #6f8c98;
  border-radius: 9px;
  background: linear-gradient(#1c2f3f, #0b141c);
  color: #eef6f8;
  font: inherit;
  font-weight: 700;
  cursor: pointer;

  &:hover {
    border-color: #b4ffeb;
  }
}

.mission-card-zoom__hint {
  margin: 0;
  color: #cfe0e6;
  font-size: 0.85rem;
  text-shadow: 0 1px 3px #000;
}

@media (prefers-reduced-motion: no-preference) {
  .mission-card-zoom__layout {
    animation: mission-card-zoom-in 180ms ease-out both;
  }

  @keyframes mission-card-zoom-in {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: none; }
  }
}
</style>
