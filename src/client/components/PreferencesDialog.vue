<template>
  <div class="preferences_panel">
    <PreferenceFields :preferencesManager="preferencesManager" />
    <div class="preferences_panel_actions">
      <button class="btn btn-lg btn-primary" @click="emit('okButtonClicked')" v-i18n>Ok</button>
      <button class="btn btn-lg btn-primary" @click="bugDialog?.show()" v-i18n>Report a bug</button>
    </div>
    <BugReportDialog ref="bugDialog" />
  </div>
</template>

<script setup lang="ts">
import {ref} from 'vue';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import BugReportDialog from '@/client/components/BugReportDialog.vue';
import PreferenceFields from '@/client/components/PreferenceFields.vue';

defineProps<{preferencesManager: PreferencesManager}>();
const emit = defineEmits<{'okButtonClicked': []}>();
const bugDialog = ref<InstanceType<typeof BugReportDialog>>();
</script>
