# Agent Reviewer Dashboard

A comprehensive admin dashboard for the GitLab merge request review automation system built with Vue.js 3 and TailwindCSS.

## Features

### Authentication
- Secret key-based authentication system
- JWT token management
- Session persistence
- Secure logout functionality

### Dashboard Pages
1. **Dashboard Overview** - System health, key metrics, and quick actions
2. **Review History** - Complete history with filtering, search, and export
3. **Current Status** - Real-time system status and queue monitoring
4. **Analytics** - Review trends, performance metrics, and insights

### Key Components
- Responsive design for all screen sizes
- Real-time data updates
- Export functionality for review data
- Comprehensive error handling
- Loading states and user feedback

## Technology Stack

- **Vue.js 3** - Progressive JavaScript framework with Composition API
- **TypeScript** - Type-safe development
- **TailwindCSS** - Utility-first CSS framework
- **Pinia** - State management
- **Vue Router** - Client-side routing
- **Axios** - HTTP client
- **Date-fns** - Date manipulation
- **Vite** - Build tool and dev server

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── BaseButton.vue
│   ├── BaseCard.vue
│   ├── BaseInput.vue
│   ├── BaseTable.vue
│   ├── BasePagination.vue
│   ├── BaseModal.vue
│   └── BaseAlert.vue
├── layouts/            # Layout components
│   └── DashboardLayout.vue
├── views/              # Page components
│   ├── LoginView.vue
│   ├── DashboardView.vue
│   ├── ReviewHistoryView.vue
│   ├── CurrentStatusView.vue
│   ├── AnalyticsView.vue
│   └── NotFoundView.vue
├── stores/             # Pinia stores
│   ├── auth.ts
│   ├── reviews.ts
│   ├── status.ts
│   └── analytics.ts
├── services/           # API services
│   └── api.ts
├── types/              # TypeScript type definitions
│   └── index.ts
├── router/             # Vue Router configuration
│   └── index.ts
├── style.css           # Global styles
└── main.ts             # Application entry point
```

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
cd frontend
npm install
```

### Development Server
```bash
npm run dev
```

The development server will start on `http://localhost:5173` with hot reload enabled.

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## Configuration

### Environment Variables
The frontend uses Vite's proxy configuration to connect to the backend API. The proxy is configured in `vite.config.ts` to forward `/api` requests to `http://localhost:3000`.

### Backend Integration
The dashboard connects to the agent-reviewer backend API endpoints:
- `/api/auth/*` - Authentication endpoints
- `/api/reviews` - Review history data
- `/api/analytics` - Analytics data
- `/api/system/health` - System health status
- `/api/queue/status` - Queue status information

## Authentication

The dashboard uses a simple secret key-based authentication system:

1. User enters the admin secret key on the login page
2. Backend validates the secret key and returns a JWT token
3. Frontend stores the token and includes it in subsequent API requests
4. Token is automatically refreshed and validated

## Features in Detail

### Review History
- Paginated table with sorting capabilities
- Filter by project, date range, and status
- Search by project name or merge request ID
- Export filtered results to CSV
- Direct links to GitLab merge requests

### Current Status
- Real-time system health monitoring
- Queue statistics and job status
- Auto-refresh every 30 seconds
- Visual indicators for system components

### Analytics
- Configurable date ranges (7, 30, 90 days, or custom)
- Key performance metrics
- Review trends visualization
- Top projects by activity
- Success rates and processing times

### Responsive Design
- Mobile-first approach
- Responsive navigation with mobile menu
- Adaptive layouts for different screen sizes
- Touch-friendly interface elements

## API Integration

The frontend communicates with the backend through a centralized API service that handles:
- Request/response interceptors
- Authentication token management
- Error handling and user feedback
- Type-safe API calls

## Error Handling

Comprehensive error handling includes:
- Network error detection
- API error responses
- User-friendly error messages
- Automatic token refresh on authentication errors
- Graceful degradation for missing data

## Performance Considerations

- Lazy loading of route components
- Debounced search inputs
- Efficient state management with Pinia
- Optimized bundle size with Vite
- Responsive images and assets

## Browser Support

The dashboard supports all modern browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Follow the existing code style and patterns
2. Use TypeScript for type safety
3. Implement responsive design for all new components
4. Add proper error handling and loading states
5. Test on multiple screen sizes and browsers

## Deployment

The frontend can be deployed as static files after building:

1. Build the project: `npm run build`
2. Deploy the `dist` folder to your web server
3. Configure your web server to serve the SPA correctly
4. Ensure the backend API is accessible from the frontend domain

For production deployment, consider:
- Setting up proper HTTPS
- Configuring CORS on the backend
- Setting up proper caching headers
- Using a CDN for static assets
