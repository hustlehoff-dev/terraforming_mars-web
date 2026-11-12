<template>
  <div class="card-tag" :class="`tag-${type}`" role="img" :aria-label="$t(label)" :title="$t(label)"></div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {Tag} from '@/common/cards/Tag';

export default defineComponent({
  name: 'CardTag',
  computed: {
    label(): string {
      return this.type === 'asterisk' ? 'Tags' : this.type.charAt(0).toUpperCase() + this.type.slice(1);
    },
  },
  props: {
    index: {
      type: Number,
      required: true,
      validator: (i: number) => i < 4,
    },
    type: {
      type: String,
      required: true,
      validator: (type: Tag | 'asterisk') => type === 'asterisk' || Object.values(Tag).includes(type),
    },
  },
});

</script>
