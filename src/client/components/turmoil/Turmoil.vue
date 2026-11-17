<template>
  <div class="turmoil">
    <!-- For a first game: what the parts of the Turmoil board mean, in a few lines. -->
    <details class="turmoil-legend" :open="legendOpen" @toggle="rememberLegend">
      <summary v-i18n>How does Turmoil work?</summary>
      <ul>
        <li><b v-i18n>Delegate</b> <span v-i18n>Send one to a party: 5 M€ from your reserve, or free once per generation from the lobby. More delegates in a party = more say.</span></li>
        <li><b v-i18n>Ruling party</b> <span v-i18n>The party with the most delegates rules the next generation: its policy applies to everyone, and its leader becomes the chairman (+1 TR).</span></li>
        <li><b v-i18n>Influence</b> <span v-i18n>1 for the chairman, +1 for the leader of the dominant party (most delegates now), +1 for another delegate of yours there. Global events and some cards count it.</span></li>
        <li><b v-i18n>Global events</b> <span v-i18n>Distant, coming, current: at the end of each generation the current event happens to every player. Influence counts in most of them.</span></li>
        <li><b v-i18n>Reds</b> <span v-i18n>While they rule, each step of TR you raise costs 3 M€.</span></li>
      </ul>
    </details>
    <div class="events-board" :title="$t('Global events: distant, coming, current')">
      <GlobalEvent v-if="turmoil.distant" :globalEventName="turmoil.distant" type="distant" :showDistance="true" />
      <GlobalEvent v-if="turmoil.coming" :globalEventName="turmoil.coming" type="coming" :showDistance="true" />
      <GlobalEvent v-if="turmoil.current" :globalEventName="turmoil.current" type="current" :showDistance="true" />
    </div>

    <div class="turmoil-board">
      <div class="turmoil-header">
        <div class="turmoil-lobby" :title="$t('Lobby: one free delegate per player each generation')">
          <div class="lobby-spot" v-for="n in 5" :key="n">
            <div v-if="turmoil.lobby.length >= n" :class="'player-token '+turmoil.lobby[n-1]"></div>
          </div>
        </div>
        <div class="dominant-party-name" :title="$t('Ruling party: its policy applies to everyone this generation')">
          <div :class="'party-name party-name--'+partyNameToCss(turmoil.ruling)" v-i18n>{{ turmoil.ruling }}</div>
        </div>
        <div class="dominant-party-bonus">
          <TurmoilAgenda v-if="turmoil.ruling" :id="getPolicy(turmoil.ruling)" />
        </div>
        <div class="policy-user-cubes">
          <template v-for="n in turmoil.policyActionUsers" :key="n.color">
            <div v-if="n.turmoilPolicyActionUsed" :class="'policy-use-marker board-cube--'+n.color"></div>
            <div v-if="n.politicalAgendasActionUsedCount > 0" :class="'policy-use-marker board-cube--'+n.color">{{ n.politicalAgendasActionUsedCount }}</div>
          </template>
        </div>
        <div class="chairman-spot" :title="$t('Chairman: +1 TR and 1 influence')"><div v-if="turmoil.chairman" :class="'player-token '+turmoil.chairman"></div></div>
        <div class="turmoil-reserve" :title="$t('Reserve: delegates still free, 5 M€ each to send')">
          <div class="lobby-spot" v-for="n in turmoil.reserve.length" :key="n">
            <div v-if="turmoil.reserve.length >= n" :class="'player-token '+turmoil.reserve[n-1].color">{{ turmoil.reserve[n-1].number }}</div>
          </div>
        </div>
        <div class="policies">
          <div class="policies-title">
            <a class="policies-clickable" href="#" @click.prevent="toggleMe()" v-i18n>Policies</a>
          </div>
          <div v-show="isVisible()" class="policies-global">
            <div v-for="party in turmoil.parties" :key="party.name" class="policy-block">
              <div :class="'party-name party-name--'+partyNameToCss(party.name)" v-i18n>{{ party.name }}</div>

              <div class="party-bonus">
                <TurmoilAgenda :id="getPolicy(party.name)" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid-leaders">
        <div v-for="party in turmoil.parties" :key="party.name" :class="['leader-spot', 'leader-spot--'+partyNameToCss(party.name), {'player-token-new-leader': (party.name === turmoil.dominant)}]">
          <div class="delegate-spot">
            <div v-if="party.partyLeader" :class="['player-token', party.partyLeader]"></div>
          </div>
        </div>
      </div>

      <div class="grid-parties">
        <div v-for="party in turmoil.parties" :key="party.name" :class="'board-party board-party--'+partyNameToCss(party.name)"
          :title="$t('Delegates in this party: the one with the most rules next generation')">
          <div class="grid-delegates">
            <div class="delegate-spot" v-for="n in 6" :key="n">
              <div v-if="party.delegates.length >= n" :class="'player-token '+party.delegates[n-1].color">{{ party.delegates[n-1].number }}</div>
            </div>
          </div>
          <div :class="'party-name party-name--'+partyNameToCss(party.name)" v-i18n>{{ party.name }}</div>
          <div class="party-bonus">
            <TurmoilAgenda type="party-bonus" :id="getBonus(party.name)" />
          </div>
        </div>
      </div>

      <div class="turmoil-party-transition-arrow-grid">
        <div class="turmoil-party-transition-arrow"></div>
        <div class="turmoil-party-transition-arrow"></div>
        <div class="turmoil-party-transition-arrow"></div>
        <div class="turmoil-party-transition-arrow"></div>
        <div class="turmoil-party-transition-arrow"></div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {vueRoot} from '@/client/components/vueRoot';
import {PartyName} from '@/common/turmoil/PartyName';
import {TurmoilModel} from '@/common/models/TurmoilModel';
import TurmoilAgenda from '@/client/components/turmoil/TurmoilAgenda.vue';
import GlobalEvent from '@/client/components/turmoil/GlobalEvent.vue';
import {BonusId, PolicyId} from '@/common/turmoil/Types';

const LEGEND_KEY = 'turmoil-legend-folded';

export default defineComponent({
  name: 'Turmoil',
  props: {
    turmoil: {
      type: Object as () => TurmoilModel,
      required: true,
    },
  },
  data() {
    let folded = false;
    try {
      folded = window.localStorage.getItem(LEGEND_KEY) === '1';
    } catch {
      // Open by default.
    }
    return {legendOpen: !folded};
  },
  methods: {
    rememberLegend(event: Event) {
      this.legendOpen = (event.target as HTMLDetailsElement).open;
      try {
        window.localStorage.setItem(LEGEND_KEY, this.legendOpen ? '0' : '1');
      } catch {
        // Only for this page.
      }
    },
    partyNameToCss(party: PartyName | undefined): string {
      if (party === undefined) {
        console.warn('no party provided');
        return '';
      }
      return party.toLowerCase().split(' ').join('_');
    },
    getBonus(party: PartyName): BonusId {
      const politicalAgendas = this.turmoil.politicalAgendas;
      if (politicalAgendas === undefined) {
        throw new Error('Political agendas not defined');
      }
      switch (party) {
      case PartyName.MARS:
        return politicalAgendas.marsFirst.bonusId;
      case PartyName.SCIENTISTS:
        return politicalAgendas.scientists.bonusId;
      case PartyName.UNITY:
        return politicalAgendas.unity.bonusId;
      case PartyName.KELVINISTS:
        return politicalAgendas.kelvinists.bonusId;
      case PartyName.REDS:
        return politicalAgendas.reds.bonusId;
      case PartyName.GREENS:
        return politicalAgendas.greens.bonusId;
      }
    },
    getPolicy(partyName: PartyName): PolicyId {
      const politicalAgendas = this.turmoil.politicalAgendas;
      if (politicalAgendas === undefined) {
        throw new Error('Political agendas not defined');
      }
      switch (partyName) {
      case PartyName.MARS:
        return politicalAgendas.marsFirst.policyId;
      case PartyName.SCIENTISTS:
        return politicalAgendas.scientists.policyId;
      case PartyName.UNITY:
        return politicalAgendas.unity.policyId;
      case PartyName.KELVINISTS:
        return politicalAgendas.kelvinists.policyId;
      case PartyName.REDS:
        return politicalAgendas.reds.policyId;
      case PartyName.GREENS:
        return politicalAgendas.greens.policyId;
      default:
        throw new Error(`Unknown party name ${partyName}`);
      }
    },
    toggleMe() {
      const currentState: boolean = this.isVisible();
      vueRoot(this).setVisibilityState('turmoil_parties', ! currentState);
    },
    isVisible() {
      return vueRoot(this).getVisibilityState('turmoil_parties');
    },
  },
  components: {
    GlobalEvent,
    TurmoilAgenda,
  },
});

</script>

<style lang="less">
// The Turmoil legend: dark panel above the board, readable on any background.
.turmoil-legend {
  margin: 0 0 12px;
  padding: 10px 16px;
  border: 1px solid #e2c27f66;
  border-radius: 10px;
  background: #0b141cf0;
  color: #cfe0e6;
  font-size: 0.95rem;
  line-height: 1.35;
  text-align: start;

  summary {
    color: #f6e2b8;
    font-weight: 800;
    cursor: pointer;
  }

  ul {
    display: grid;
    gap: 5px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }

  b {
    display: inline-block;
    min-width: 130px;
    color: #a2eeff;
  }
}
</style>
