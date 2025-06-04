#!/usr/bin/env tsx

import { documentationService } from '../src/services/documentation.js';
import { dbService } from '../src/services/database.js';

/**
 * Setup script to add default documentation sources
 */
async function setupDocumentation() {
  try {
    console.log('Setting up default documentation sources...');

    // Initialize database
    await dbService.initialize();

    // Add Nuxt.js documentation source
    const nuxtSource = await documentationService.addDocumentationSource({
      name: 'Nuxt.js Official Documentation',
      description: 'Official Nuxt.js framework documentation optimized for LLMs',
      url: 'https://nuxt.com/llms-full.txt',
      framework: 'nuxt',
      version: '3.x',
      isActive: true,
      refreshIntervalDays: 7,
      lastFetchedAt: undefined,
      lastEmbeddedAt: undefined,
      fetchStatus: 'pending',
      fetchError: undefined
    });

    console.log(`✅ Added Nuxt.js documentation source: ${nuxtSource.id}`);

    // Add Vue.js documentation source (example)
    // const vueSource = await documentationService.addDocumentationSource({
    //   name: 'Vue.js Official Documentation',
    //   description: 'Official Vue.js framework documentation',
    //   url: 'https://vuejs.org/guide/introduction.html', // This would need to be an LLM-optimized version
    //   framework: 'vue',
    //   version: '3.x',
    //   isActive: false, // Disabled by default since we don't have an LLM-optimized version
    //   refreshIntervalDays: 7,
    //   lastFetchedAt: undefined,
    //   lastEmbeddedAt: undefined,
    //   fetchStatus: 'pending',
    //   fetchError: undefined
    // });

    // console.log(`✅ Added Vue.js documentation source: ${vueSource.id} (disabled)`);

    // Add React documentation source (example)
    // const reactSource = await documentationService.addDocumentationSource({
    //   name: 'React Official Documentation',
    //   description: 'Official React library documentation',
    //   url: 'https://react.dev/learn', // This would need to be an LLM-optimized version
    //   framework: 'react',
    //   version: '18.x',
    //   isActive: false, // Disabled by default since we don't have an LLM-optimized version
    //   refreshIntervalDays: 7,
    //   lastFetchedAt: undefined,
    //   lastEmbeddedAt: undefined,
    //   fetchStatus: 'pending',
    //   fetchError: undefined
    // });

    // console.log(`✅ Added React documentation source: ${reactSource.id} (disabled)`);

    console.log('\n📚 Documentation sources setup completed!');
    console.log('\nNext steps:');
    console.log('1. The Nuxt.js documentation will be automatically embedded when first used');
    console.log('2. Enable other documentation sources when LLM-optimized versions are available');
    console.log('3. Use the API endpoints to manage documentation sources:');
    console.log('   - GET /api/documentation/sources - List all sources');
    console.log('   - POST /api/documentation/sources/:id/reembed - Trigger re-embedding');
    console.log('   - POST /api/projects/:projectId/documentation - Map project to documentation');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up documentation sources:', error);
    process.exit(1);
  }
}

// Run the setup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDocumentation();
}

export { setupDocumentation };
