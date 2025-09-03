<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Navigation -->
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <div class="flex-shrink-0 flex items-center">
              <div class="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <svg class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span class="ml-3 text-xl font-semibold text-gray-900">Agent Reviewer</span>
            </div>
            <!-- Desktop Navigation -->
            <div class="hidden lg:ml-6 lg:flex lg:space-x-4 xl:space-x-8">
              <!-- Primary Navigation Items -->
              <div class="hidden xl:flex xl:space-x-8">
                <router-link
                  to="/"
                  class="flex items-center border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                  active-class="border-primary-500 text-primary-600"
                >
                  Dashboard
                </router-link>
                <router-link
                  to="/merge-requests"
                  class="flex items-center border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                  active-class="border-primary-500 text-primary-600"
                >
                  Merge Requests
                </router-link>
                <router-link
                  to="/status"
                  class="flex items-center border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                  active-class="border-primary-500 text-primary-600"
                >
                  Status
                </router-link>
                <router-link
                  to="/analytics"
                  class="flex items-center border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                  active-class="border-primary-500 text-primary-600"
                >
                  Analytics
                </router-link>
              </div>

              <!-- More Dropdown for Secondary Items -->
              <div class="relative" :class="{ 'block': !showMoreDropdown, 'hidden': showMoreDropdown }">
                <button
                  @click="showMoreDropdown = !showMoreDropdown"
                  class="flex items-center border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                  :class="{ 'border-primary-500 text-primary-600': isMoreDropdownActive }"
                >
                  More
                  <svg class="ml-1 h-4 w-4" :class="{ 'rotate-180': showMoreDropdown }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                <!-- Dropdown Menu -->
                <div
                  v-show="showMoreDropdown"
                  class="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200"
                >
                  <router-link
                    to="/repository-embedding"
                    class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    @click="showMoreDropdown = false"
                  >
                    Repository Embedding
                  </router-link>
                  <router-link
                    to="/documentation"
                    class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    @click="showMoreDropdown = false"
                  >
                    Documentation
                  </router-link>
                  <router-link
                    to="/auto-review-settings"
                    class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    @click="showMoreDropdown = false"
                  >
                    Auto Review Settings
                  </router-link>
                </div>
              </div>

              <!-- Medium Screen Navigation (shows all items but more compact) -->
              <div class="hidden lg:flex xl:hidden space-x-4">
                <router-link
                  to="/"
                  class="flex items-center border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                  active-class="border-primary-500 text-primary-600"
                >
                  Dashboard
                </router-link>
                <router-link
                  to="/merge-requests"
                  class="flex items-center border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                  active-class="border-primary-500 text-primary-600"
                >
                  MRs
                </router-link>
                <router-link
                  to="/status"
                  class="flex items-center border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                  active-class="border-primary-500 text-primary-600"
                >
                  Status
                </router-link>
                <router-link
                  to="/analytics"
                  class="flex items-center border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                  active-class="border-primary-500 text-primary-600"
                >
                  Analytics
                </router-link>
                <router-link
                  to="/repository-embedding"
                  class="flex items-center border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                  active-class="border-primary-500 text-primary-600"
                >
                  Embedding
                </router-link>
                <router-link
                  to="/documentation"
                  class="flex items-center border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                  active-class="border-primary-500 text-primary-600"
                >
                  Docs
                </router-link>
                <router-link
                  to="/auto-review-settings"
                  class="flex items-center border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                  active-class="border-primary-500 text-primary-600"
                >
                  Auto Review
                </router-link>
              </div>
            </div>

            <!-- Compact Navigation for Smaller Screens -->
            <div class="hidden sm:flex lg:hidden ml-4">
              <router-link
                to="/"
                class="flex items-center border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                active-class="border-primary-500 text-primary-600"
              >
                Dashboard
              </router-link>
              <router-link
                to="/merge-requests"
                class="flex items-center border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                active-class="border-primary-500 text-primary-600"
              >
                MRs
              </router-link>
              <router-link
                to="/status"
                class="flex items-center border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                active-class="border-primary-500 text-primary-600"
              >
                Status
              </router-link>
              <router-link
                to="/analytics"
                class="flex items-center border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                active-class="border-primary-500 text-primary-600"
              >
                Analytics
              </router-link>
            </div>
          </div>
          <div class="hidden sm:ml-6 sm:flex sm:items-center">
            <div class="ml-3 relative">
              <div class="flex items-center space-x-4">
                <span class="text-sm text-gray-700">{{ authStore.user?.username }}</span>
                <button
                  @click="handleLogout"
                  class="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <span class="sr-only">Logout</span>
                  <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <!-- Mobile menu button -->
          <div class="sm:hidden flex items-center">
            <button
              @click="mobileMenuOpen = !mobileMenuOpen"
              class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
            >
              <span class="sr-only">Open main menu</span>
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile menu -->
      <div v-show="mobileMenuOpen" class="sm:hidden">
        <div class="pt-2 pb-3 space-y-1">
          <router-link
            to="/"
            class="bg-primary-50 border-primary-500 text-primary-700 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
            active-class="bg-primary-50 border-primary-500 text-primary-700"
            inactive-class="border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800"
          >
            Dashboard
          </router-link>
          <router-link
            to="/reviews"
            class="border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
            active-class="bg-primary-50 border-primary-500 text-primary-700"
          >
            Review History
          </router-link>
          <router-link
            to="/merge-requests"
            class="border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
            active-class="bg-primary-50 border-primary-500 text-primary-700"
          >
            Merge Requests
          </router-link>
          <router-link
            to="/status"
            class="border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
            active-class="bg-primary-50 border-primary-500 text-primary-700"
          >
            Current Status
          </router-link>
          <router-link
            to="/analytics"
            class="border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
            active-class="bg-primary-50 border-primary-500 text-primary-700"
          >
            Analytics
          </router-link>
          <router-link
            to="/repository-embedding"
            class="border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
            active-class="bg-primary-50 border-primary-500 text-primary-700"
          >
            Repository Embedding
          </router-link>
          <router-link
            to="/documentation"
            class="border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
            active-class="bg-primary-50 border-primary-500 text-primary-700"
          >
            Documentation
          </router-link>
          <router-link
            to="/auto-review-settings"
            class="border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
            active-class="bg-primary-50 border-primary-500 text-primary-700"
          >
            Auto Review Settings
          </router-link>
        </div>
        <div class="pt-4 pb-3 border-t border-gray-200">
          <div class="flex items-center px-4">
            <div class="flex-shrink-0">
              <div class="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span class="text-sm font-medium text-primary-600">{{ authStore.user?.username?.charAt(0).toUpperCase() }}</span>
              </div>
            </div>
            <div class="ml-3">
              <div class="text-base font-medium text-gray-800">{{ authStore.user?.username }}</div>
              <div class="text-sm font-medium text-gray-500">Administrator</div>
            </div>
          </div>
          <div class="mt-3 space-y-1">
            <button
              @click="handleLogout"
              class="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 w-full text-left"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main content -->
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const mobileMenuOpen = ref(false)
const showMoreDropdown = ref(false)

// Check if current route is in the "More" dropdown to highlight the dropdown
const isMoreDropdownActive = computed(() => {
  const moreRoutes = ['/repository-embedding', '/documentation', '/auto-review-settings']
  return moreRoutes.includes(route.path)
})

// Close dropdown when clicking outside
const closeDropdowns = (event: MouseEvent) => {
  const dropdown = document.querySelector('.relative')
  if (dropdown && !dropdown.contains(event.target as Node)) {
    showMoreDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeDropdowns)
})

// Clean up event listener
onUnmounted(() => {
  document.removeEventListener('click', closeDropdowns)
})

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}

onMounted(() => {
  // Authentication is handled at the app and router level
  // No need for additional checks here
})
</script>
