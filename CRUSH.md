# Agent Reviewer Development Guide

## Build & Test Commands
- `cd agent-reviewer && bun test` - Run all tests
- `cd agent-reviewer && bun test src/test/completion-rate.test.ts` - Run single test file
- `cd agent-reviewer && bun test --watch` - Watch mode for tests
- `cd agent-reviewer && bun build` - TypeScript compilation
- `cd agent-reviewer && bun dev` - Development server
- `cd agent-reviewer/frontend && npm run dev` - Frontend dev server
- `cd agent-reviewer/frontend && npm run build` - Frontend build

## Code Style Guidelines

### TypeScript (Backend)
- Use ES2022 target with ESNext modules
- Strict TypeScript enabled
- Interfaces over types for extendability
- camelCase for files/functions, PascalCase for classes
- Import style: `import { Module } from 'module'`
- Error handling: try/catch with proper logging

### Vue/Frontend
- Composition API with `<script setup lang="ts">`
- Use Pinia for state management with `storeToRefs`
- Components in PascalCase (`MyComponent.vue`)
- Use Tailwind CSS classes for styling
- SVG icons from `components/icon/`

### Testing
- Test files end with `.test.ts`
- Use Bun test framework
- Test structure: describe/test/expect
- Mock external dependencies

### Database/API
- Use PostgreSQL with pgvector
- API routes follow REST conventions
- Environment variables via dotenv
- Proper error responses with status codes

### Project Structure
- Services in `src/services/`
- Controllers in `src/controllers/`
- Types in `src/types/`
- Tests in `src/test/`
- Frontend in `frontend/src/`