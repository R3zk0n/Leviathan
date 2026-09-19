import { ref } from 'vue'

export function useNotifications() {
  const notifications = ref([])
  let notificationId = 0

  const showNotification = (message, type = 'info', duration = 3000) => {
    const id = ++notificationId
    const notification = {
      id,
      message,
      type,
      progress: 100
    }

    notifications.value.push(notification)

    // Animate progress bar
    const interval = setInterval(() => {
      const notif = notifications.value.find(n => n.id === id)
      if (notif) {
        notif.progress -= (100 / (duration / 50))
        if (notif.progress <= 0) {
          clearInterval(interval)
          removeNotification(id)
        }
      } else {
        clearInterval(interval)
      }
    }, 50)

    return id
  }

  const removeNotification = (id) => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  const getNotificationIcon = (type) => {
    const icons = {
      success: 'mdi-check-circle',
      error: 'mdi-alert-circle',
      warning: 'mdi-alert',
      info: 'mdi-information'
    }
    return icons[type] || icons.info
  }

  return {
    notifications,
    showNotification,
    removeNotification,
    getNotificationIcon
  }
}
