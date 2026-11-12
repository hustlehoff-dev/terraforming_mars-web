<template>
  <span
    class="resource_icon"
    :class="['resource_icon--' + resource, {'tooltip tooltip-bottom': tooltip}]"
    role="img"
    :aria-label="$t(label)"
    :title="tooltip ? undefined : $t(label)"
    :data-tooltip="tooltip ? $t(label) : undefined"></span>
</template>

<script setup lang="ts">
import {computed} from 'vue';
import {Resource} from '@/common/Resource';

const props = defineProps<{resource: Resource, tooltip?: boolean}>();
const labels: Record<Resource, string> = {
  megacredits: 'MegaCredits (M€)',
  steel: 'Steel',
  titanium: 'Titanium',
  plants: 'Plants',
  energy: 'Energy',
  heat: 'Heat',
};
const label = computed(() => labels[props.resource]);
</script>
