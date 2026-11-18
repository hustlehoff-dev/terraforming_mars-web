<template>
  <div ref="hud" class="mission-player-hud">
    <div class="mission-player-hud__controls">
      <div class="mission-player-hud__corporations">
        <button
          v-for="card in corporations"
          :key="card.name"
          type="button"
          :class="{'mission-card-available': actionCards.has(card.name)}"
          :aria-label="$t(card.name)"
          :aria-pressed="inspected === card.name"
          @click="emit('preview', card, ($event.currentTarget as HTMLElement).getBoundingClientRect())">
          <Card :card="card" inert aria-hidden="true" />
          <span class="mission-player-hud__corp-art" aria-hidden="true" inert></span>
          <span v-if="actionCards.has(card.name)" class="mission-player-hud__corp-status" aria-hidden="true">●</span>
        </button>
      </div>
      <ul class="mission-player-hud__stocks" :aria-label="$t('Resources')">
        <li v-for="resource in ALL_RESOURCES" :key="resource" :class="{'mission-player-hud__stock--ready': conversions?.[resource]}"
          :title="conversions?.[resource] ? $t(conversions[resource]!.label) : undefined"
          :role="conversions?.[resource] ? 'button' : undefined" :tabindex="conversions?.[resource] ? 0 : undefined"
          @click="conversions?.[resource] && emit('convert', conversions[resource]!)"
          @keydown.enter="conversions?.[resource] && emit('convert', conversions[resource]!)">
          <ResourceIcon :resource="resource" />
          <strong :key="player[resource]" class="mission-status__value">{{ player[resource] }}</strong>
          <span v-if="resource === 'megacredits'" class="mission-player-hud__production mission-player-hud__production--detailed"
            :aria-label="$t('Terraform rating') + ' ' + formatProduction(player.terraformRating) + ', ' + $t('Production') + ' ' + formatProduction(player.megacreditProduction)"
            :title="$t('Terraform rating') + ' + ' + $t('Production')">({{ formatProduction(player.terraformRating) }} TR {{ formatProduction(player.megacreditProduction) }})</span>
          <span v-if="resource === 'megacredits'" class="mission-player-hud__production mission-player-hud__production--compact"
            :aria-label="$t('Production') + ' ' + formatProduction(productionFor(resource))">({{ formatProduction(productionFor(resource)) }})</span>
          <span v-if="resource !== 'megacredits'" class="mission-player-hud__production" :aria-label="$t('Production') + ' ' + formatProduction(productionFor(resource))">({{ formatProduction(productionFor(resource)) }})</span>
        </li>
      </ul>
      <slot name="afterStocks"></slot>
    </div>
    <MissionHand :cards="cards" :playableCards="playableCards" :inspected="inspected" @preview="(card, origin) => emit('preview', card, origin)" @play="(card, origin) => emit('play', card, origin)" />
  </div>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from 'vue';
import MissionHand from '@/client/components/board/MissionHand.vue';
import Card from '@/client/components/card/Card.vue';
import ResourceIcon from '@/client/components/common/ResourceIcon.vue';
import {getCardsByType} from '@/client/utils/CardUtils';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {ALL_RESOURCES} from '@/common/Resource';
import type {MissionQuickAction} from '@/client/components/board/MissionQuickAction';

const props = defineProps<{
  player: PublicPlayerModel;
  cards: ReadonlyArray<CardModel>;
  playableCards: ReadonlySet<CardName>;
  actionCards: ReadonlySet<CardName>;
  /** Conversions usable now, keyed by the resource they spend (e.g. 8 heat → temperature). */
  conversions?: Partial<Record<string, MissionQuickAction>>;
  inspected?: CardName;
}>();
const emit = defineEmits<{preview: [card: CardModel, origin: DOMRect], play: [card: CardModel, origin: DOMRect], convert: [action: MissionQuickAction]}>();
const hud = ref<HTMLElement>();
let dockObserver: ResizeObserver | undefined;
// The same measured dock boundary positions the camera, scene and return-to-choice button.
function measureMobileDock() {
  const dock = hud.value?.closest<HTMLElement>('.mission-dock');
  if (dock && window.matchMedia?.('(max-width: 760px)').matches) {
    const bottom = Math.max(0, window.innerHeight - dock.getBoundingClientRect().bottom);
    document.documentElement.style.setProperty('--mobile-dock-height', `${Math.ceil(dock.offsetHeight + bottom)}px`);
  } else {
    document.documentElement.style.removeProperty('--mobile-dock-height');
  }
}
onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && hud.value) {
    dockObserver = new ResizeObserver(measureMobileDock);
    dockObserver.observe(hud.value);
  }
  window.addEventListener('resize', measureMobileDock);
  measureMobileDock();
});
onBeforeUnmount(() => {
  dockObserver?.disconnect();
  window.removeEventListener('resize', measureMobileDock);
  document.documentElement.style.removeProperty('--mobile-dock-height');
});
const corporations = computed(() => getCardsByType(props.player.tableau, [CardType.CORPORATION]));

function productionFor(resource: typeof ALL_RESOURCES[number]): number {
  switch (resource) {
  case 'megacredits': return props.player.terraformRating + props.player.megacreditProduction;
  case 'steel': return props.player.steelProduction;
  case 'titanium': return props.player.titaniumProduction;
  case 'plants': return props.player.plantProduction;
  case 'energy': return props.player.energyProduction;
  case 'heat': return props.player.heatProduction;
  }
}

function formatProduction(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}
</script>

<style lang="less">
.mission-player-hud__production--compact {
  display: none;
}

.mission-player-hud__controls {
  display: flex;
  min-width: 0;
  align-items: flex-end;
  gap: inherit;
}

// Desktop dock: the controls and hand share one baseline.
@media (min-width: 761px) {
  body #player-home.mission-cinematic {
    --mission-card-scale: 0.49;
    --dock-height: 222px;

    // One row: corporation, resources, played cards, card actions, then the hand taking the rest.
    .mission-player-hud {
      display: flex;
      align-items: flex-end;
      gap: 8px;

      > * {
        flex: none;
      }

      > .mission-hand {
        flex: 1 1 0;
        min-width: 150px;
      }

      > .mission-player-hud__controls {
        flex: 0 1 auto;
      }
    }

    .mission-player-hud__corporations {
      width: auto;

      &:has(button + button) {
        min-width: calc(240px * var(--hand-scale));
        overflow: auto hidden !important;
      }
    }
    .mission-player-hud__stocks {
      gap: 6px 8px;
      padding: 8px 9px;

      li {
        gap: 4px;
        font-size: 1.22rem;
        line-height: 1.05;
      }

      .mission-player-hud__production {
        font-size: 0.8rem;
      }

      .resource_icon {
        width: 30px;
        height: 30px;
        flex: 0 0 30px;
      }
    }
  }
}

@media (min-width: 761px) and (max-width: 1150px) {
  body #player-home.mission-cinematic {
    --dock-height: 237px;
  }
}

// Resources in two rows of three, styled as tiles; a resource that can be converted now glows.
body #player-home.mission-cinematic {
  .mission-player-hud__stocks {
    grid-template-columns: repeat(3, minmax(0, max-content));
    align-self: end;
    background: linear-gradient(#1c2a35f2, #0c141bf2);
    box-shadow: inset 0 1px 0 #ffffff1c, 0 6px 16px #0009;

    li {
      padding: 4px 8px;
      border: 1px solid #ffffff1f;
      border-radius: 6px;
      background: linear-gradient(#26384599, #0f1a2299);
    }
  }

  .mission-player-hud__stock--ready {
    border-color: #ffd36b !important;
    cursor: pointer;
    animation: mission-stock-ready 1.1s ease-in-out infinite alternate;

    &:hover,
    &:focus-visible {
      outline: 2px solid #fff3c4;
      animation: none;
      background: #5a3d12 !important;
    }
  }

}

@media (max-width: 1150px) {
  body #player-home.mission-cinematic .mission-player-hud {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto;
    gap: 6px;

    > .mission-hand {
      --hand-scale: 0.37;

      grid-column: 1;
      grid-row: 1;
      min-width: 0;
    }

    .mission-player-hud__controls {
      grid-column: 1;
      grid-row: 2;
      min-width: 0;
      align-items: center;

      > * {
        flex: none;
        translate: none;
      }

      .mission-player-hud__corporations {
        --hand-scale: 0.18;

        button {
          width: calc(240px * var(--hand-scale));
          flex-basis: calc(240px * var(--hand-scale));
        }
      }

      .mission-player-hud__stocks {
        height: auto;
        grid-template-columns: repeat(3, max-content);
        gap: 2px;
        padding: 3px;

        li {
          flex-direction: row;
          gap: 3px;
          padding: 2px 3px;
          font-size: 0.86rem;
        }

        .resource_icon {
          width: 19px;
          height: 19px;
          flex-basis: 19px;
        }

        .mission-player-hud__production {
          font-size: 0.66rem;
        }
      }

      .mission-dock__played {
        width: 72px;
        height: 58px;
        gap: 3px;
        font-size: 0.66rem;

        img {
          width: 17px;
          height: 22px;
        }
      }

      .mission-dock__count {
        width: 23px;
        height: 23px;
        font-size: 0.8rem;
      }

      .mission-effects {
        height: 58px;
      }
    }
  }
}

@media (max-width: 760px) {
  body #player-home.mission-cinematic .mission-player-hud {
    > .mission-hand {
      --hand-scale: var(--mobile-hand-scale);
    }

    .mission-player-hud__controls {
      overflow: auto hidden;
      overscroll-behavior-x: contain;
      scrollbar-width: thin;
    }
  }
}

@keyframes mission-stock-ready {
  from { box-shadow: 0 0 2px #ffd36b66; background-color: #2a2412; }
  to { box-shadow: 0 0 14px #ffd36bcc; background-color: #5a3d12; }
}

@media (prefers-reduced-motion: reduce) {
  body #player-home.mission-cinematic .mission-player-hud__stock--ready {
    animation: none;
    box-shadow: 0 0 10px #ffd36bcc;
  }
}

@media (max-width: 760px) {
  body #player-home.mission-cinematic {
    --mobile-hand-scale: 0.31;
    --mobile-dock-bottom: max(8px, env(safe-area-inset-bottom));
    --mission-card-scale: 0.42;
    --dock-height: calc(80px + var(--mobile-dock-bottom));

    &:has(.mission-hand) {
      --dock-height: calc(80px + var(--mobile-dock-bottom) + (352px * var(--mobile-hand-scale) + 39px) * max(1, var(--hand-size, 1)));
    }

    .mission-player-hud__stocks li {
      font-size: 1.05rem;
    }

    .mission-player-hud__stocks .resource_icon {
      width: 26px;
      height: 26px;
      flex-basis: 26px;
    }
  }
}
</style>
