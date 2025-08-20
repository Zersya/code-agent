import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import LoginView from '@/views/LoginView.vue'
import DashboardView from '@/views/DashboardView.vue'
import ReviewHistoryView from '@/views/ReviewHistoryView.vue'
import CurrentStatusView from '@/views/CurrentStatusView.vue'
import AnalyticsView from '@/views/AnalyticsView.vue'
import RepositoryEmbeddingView from '@/views/RepositoryEmbeddingView.vue'
import DocumentationManagementView from '@/views/DocumentationManagementView.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: LoginView,
      meta: { requiresGuest: true }
    },
    {
      path: '/',
      component: DashboardLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'Dashboard',
          component: DashboardView
        },
        {
          path: '/reviews',
          name: 'ReviewHistory',
          component: ReviewHistoryView
        },
        {
          path: '/status',
          name: 'CurrentStatus',
          component: CurrentStatusView
        },
        {
          path: '/analytics',
          name: 'Analytics',
          component: AnalyticsView
        },
        {
          path: '/repository-embedding',
          name: 'RepositoryEmbedding',
          component: RepositoryEmbeddingView
        },
        {
          path: '/documentation',
          name: 'DocumentationManagement',
          component: DocumentationManagementView
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: NotFoundView
    }
  ]
})

// Navigation guards
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  // Initialize authentication state if needed
  if (authStore.token && !authStore.user) {
    try {
      await authStore.initialize()
    } catch (error) {
      console.error('Authentication initialization failed in router guard:', error)
    }
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if (to.meta.requiresGuest && authStore.isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
