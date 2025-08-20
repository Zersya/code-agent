<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full text-center">
      <div class="mx-auto h-24 w-24 flex items-center justify-center rounded-full bg-gray-100">
        <svg class="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h1 class="mt-6 text-3xl font-extrabold text-gray-900">404</h1>
      <p class="mt-2 text-lg text-gray-600">Page not found</p>
      <p class="mt-1 text-sm text-gray-500">
        The page you're looking for doesn't exist.
      </p>
      <div class="mt-6">
        <router-link
          to="/"
          class="btn btn-primary btn-md"
        >
          Go back to dashboard
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 404 Not Found page
</script>
