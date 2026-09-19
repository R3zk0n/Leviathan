<template>
  <div class="platform-section">
    <div class="platform-header" @click="$emit('toggle')">
      <v-icon class="section-icon" :class="{ rotated: expanded }">
        mdi-chevron-right
      </v-icon>
      <v-icon class="platform-icon">{{ icon }}</v-icon>
      <span class="platform-title">{{ title }}</span>
      <v-chip size="x-small" class="ml-auto" :color="getActiveCount > 0 ? 'green' : 'grey'">
        {{ getActiveCount }} active
      </v-chip>
    </div>

    <div v-show="expanded" class="platform-content">
      <CategorySection
        v-for="category in categories"
        :key="category.id"
        :platform="platform"
        :category="category.id"
        :title="category.title"
        :icon="category.icon"
        :expanded="expandedCategories[category.id]"
        :status="getCategoryStatus(category.id)"
        :session-id="sessionId"
        @toggle="$emit('toggle-category', platform, category.id)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import CategorySection from './CategorySection.vue'

const props = defineProps({
  platform: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  expanded: {
    type: Boolean,
    default: false
  },
  categories: {
    type: Array,
    required: true
  },
  expandedCategories: {
    type: Object,
    default: () => ({})
  },
  features: {
    type: Object,
    default: () => ({})
  },
  sessionId: {
    type: String,
    default: ''
  }
})

defineEmits(['toggle', 'toggle-category'])

// Computed properties
const getActiveCount = computed(() => {
  let count = 0
  Object.values(props.features).forEach(category => {
    if (typeof category === 'object' && category !== null) {
      Object.values(category).forEach(feature => {
        if (feature === true) count++
      })
    }
  })
  return count
})

const getCategoryStatus = (categoryId) => {
  const categoryFeatures = props.features[categoryId] || {}
  const activeFeatures = Object.values(categoryFeatures).filter(v => v === true).length

  if (activeFeatures > 0) {
    return {
      color: 'green',
      text: `${activeFeatures} active`
    }
  }

  return { color: 'grey', text: 'Available' }
}
</script>

<style scoped>
.platform-section {
  margin-bottom: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
  transition: all 0.3s ease;
}

.platform-section:hover {
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.platform-header {
  background: linear-gradient(135deg, #242424 0%, #1e1e1e 100%);
  padding: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.3s ease;
  border-left: 4px solid transparent;
}

.platform-header:hover {
  background: linear-gradient(135deg, #2d2d2d 0%, #262626 100%);
  border-left-color: #58a6ff;
}

.section-icon {
  transition: transform 0.3s ease;
  margin-right: 16px;
  color: #888;
}

.section-icon.rotated {
  transform: rotate(90deg);
  color: #58a6ff;
}

.platform-icon {
  margin-right: 20px;
  color: #58a6ff;
  font-size: 24px;
}

.platform-title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.platform-content {
  background: linear-gradient(180deg, #1a1a1a 0%, #161616 100%);
  padding: 16px;
}
</style>
