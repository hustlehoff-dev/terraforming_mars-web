<template>
  <nav class="mission-sp" :class="{'mission-sp--open': !collapsed}" :aria-label="$t('Standard Projects')">
    <button type="button" class="mission-sp__title" :aria-expanded="!collapsed" @click="toggle">
      {{ $t('Standard Projects') }} <span aria-hidden="true">{{ collapsed ? '▾' : '▴' }}</span>
    </button>
    <Transition name="mission-sp-slide">
      <div v-if="!collapsed" class="mission-sp__cards">
        <button v-for="project in projects" :key="project.name" type="button" class="mission-sp__item"
          :disabled="project.action === undefined || project.action.disabled"
          :title="project.action === undefined || project.action.disabled ? $t('Not available now') : $t(project.label)"
          @click="project.action && emit('select', project.action)">
          <Card :card="{name: project.name, calculatedCost: project.action?.cost}" class="mission-sp__card" />
          <span class="mission-sp__confirm" aria-hidden="true">{{ $t('Choose') }}</span>
        </button>
      </div>
    </Transition>
  </nav>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue';
import {getCard} from '@/client/cards/ClientCardManifest';
import Card from '@/client/components/card/Card.vue';
import {CardName} from '@/common/cards/CardName';
import {STANDARD_PROJECTS, type MissionQuickAction} from './MissionQuickAction';

/*
 * Standard projects always on screen, under the top bar. Usable ones are lit and open the project
 * like a card from the hand; the rest stay visible but greyed out.
 */
// `allProjects`: every standard project of this game, shown (greyed) also outside the player's turn.
const props = defineProps<{actions: ReadonlyArray<MissionQuickAction>, allProjects?: ReadonlyArray<CardName>}>();
const emit = defineEmits<{select: [action: MissionQuickAction]}>();

const BASE: ReadonlyArray<CardName> = [
  CardName.POWER_PLANT_STANDARD_PROJECT,
  CardName.ASTEROID_STANDARD_PROJECT,
  CardName.AQUIFER_STANDARD_PROJECT,
  CardName.GREENERY_STANDARD_PROJECT,
  CardName.CITY_STANDARD_PROJECT,
];

// Closed by default; the button at the top centre slides the project cards down.
const collapsed = ref(true);
function toggle() {
  collapsed.value = !collapsed.value;
}

const projects = computed(() => {
  const offered = props.actions.filter((action) => action.card !== undefined);
  const names = offered.length > 0 ? offered.map((action) => action.card as CardName) : (props.allProjects?.length ? props.allProjects : BASE);
  return names.map((name) => {
    const action = offered.find((candidate) => candidate.card === name);
    return {
      name,
      action,
      label: action?.label ?? STANDARD_PROJECTS[name]?.label ?? name,
      effects: action?.effects ?? STANDARD_PROJECTS[name]?.effects ?? [],
      cost: action?.cost ?? getCard(name)?.cost ?? '',
    };
  });
});
</script>

<style scoped lang="less">
.mission-sp {
  position: absolute;
  z-index: 11;
  // Under the terraform rating track at the top centre (desktop).
  top: 72px;
  left: 50%;
  display: grid;
  justify-items: center;
  transform: translateX(-50%);
}

.mission-sp__title {
  padding: 7px 18px 6px;
  border: 1px solid #c9a35d;
  border-top: 0;
  border-radius: 0 0 10px 10px;
  background: linear-gradient(#1c2f3f, #0b141c);
  box-shadow: 0 6px 16px #0009;
  color: #f6e2b8;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    outline: none;
    border-color: #ffe2a8;
    color: #fff;
  }
}

.mission-sp__cards {
  display: flex;
  max-width: calc(100vw - 40px);
  gap: 10px;
  overflow-x: auto;
  margin-top: 6px;
  padding: 10px 12px;
  border: 1px solid #c9a35d8c;
  border-radius: 12px;
  background: linear-gradient(#152330f2, #0b131bf2);
  box-shadow: 0 14px 36px #000c;
  scrollbar-width: thin;
}

.mission-sp__item {
  position: relative;
  flex: none;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  transition: translate 140ms ease;

  &:hover:not(:disabled),
  &:focus-visible {
    outline: none;
    translate: 0 -4px;
  }

  &:hover:not(:disabled) .mission-sp__card,
  &:focus-visible .mission-sp__card {
    filter: brightness(0.6);
  }

  &:hover:not(:disabled) .mission-sp__confirm,
  &:focus-visible .mission-sp__confirm {
    opacity: 1;
  }

  &:disabled {
    cursor: not-allowed;
    filter: grayscale(0.85);
    opacity: 0.5;
  }
}

.mission-sp__card {
  margin: 0 !important;
  zoom: 0.85;
  pointer-events: none;
}

.mission-sp__confirm {
  position: absolute;
  z-index: 100;
  top: 50%;
  left: 50%;
  padding: 8px 18px;
  border: 1px solid #e2c27f;
  border-radius: 8px;
  background: linear-gradient(#6a4c18, #33240b);
  box-shadow: 0 0 16px #e2c27f66, 0 6px 16px #000a;
  color: #ffe9bd;
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -50%);
  transition: opacity 120ms ease;
}

.mission-sp-slide-enter-active,
.mission-sp-slide-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.mission-sp-slide-enter-from,
.mission-sp-slide-leave-to {
  opacity: 0;
  transform: translateY(-16px);
}

@media (max-width: 760px) {
  .mission-sp__card {
    zoom: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mission-sp__confirm {
  position: absolute;
  z-index: 100;
  top: 50%;
  left: 50%;
  padding: 8px 18px;
  border: 1px solid #e2c27f;
  border-radius: 8px;
  background: linear-gradient(#6a4c18, #33240b);
  box-shadow: 0 0 16px #e2c27f66, 0 6px 16px #000a;
  color: #ffe9bd;
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -50%);
  transition: opacity 120ms ease;
}

.mission-sp-slide-enter-active,
  .mission-sp-slide-leave-active {
    transition: none;
  }
}

@media (max-width: 760px) {
  .mission-sp {
    top: 0;
  }
}
</style>
