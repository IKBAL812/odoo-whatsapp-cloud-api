# CLAUDE.md - Odoo WhatsApp Cloud API Frontend

## 🛠️ Development Environment

- **Language**: TypeScript (`^5.0.0`)
- **Framework**: Next.js 15.3.2 (App Router with Turbopack)
- **Styling**: Tailwind CSS
- **Icons**: Phosphor Icons (`@phosphor-icons/react`)
- **State Management**: React Context API
- **Real-time Updates**: Server-Sent Events (SSE)
- **Backend Integration**: Odoo JSON-RPC
- **Package Manager**: `yarn` (required - do not use npm or pnpm)
- **Linting**: ESLint with TypeScript support

## 📂 Project Structure

- **`src/app/api/`** - API routes that proxy requests to Odoo backend
- **`src/app/components/`** - React components (UI elements)
- **`src/app/context/`** - React Context providers (state management)
- **`src/app/hooks/`** - Custom React hooks
- **`src/app/lib/`** - Utilities and helpers (including Odoo JSON-RPC client)
- **`src/app/locales/`** - Translation files (`en.json`, `tr.json`)
- **`public/`** - Static assets (images, sounds, etc.)

## ⚙️ Dev Commands

- **Dev server**: `yarn dev` (runs on port 3000 or next available)
- **Build**: `yarn build`
- **Start production**: `yarn start`
- **Lint**: `yarn lint`
- **Docker build**: `docker compose up -d --build`
- **Docker logs**: `docker compose logs -f`

## 🌍 Translation System (CRITICAL)

### ⚠️ ALWAYS use translatable text when developing the frontend!

**Never hardcode user-facing strings.** Always use the translation system:

```typescript
import { useTranslations } from "@/app/context/translation-provider";

function MyComponent() {
  const { t } = useTranslations();

  return <button>{t("common.submit")}</button>;
}
```

### Adding New Translations

1. Add the key to **both** language files:
   - `src/app/locales/en.json`
   - `src/app/locales/tr.json`

2. Use nested structure:

```json
{
  "chat": {
    "openInOdoo": "Odoo Page",
    "statusOnline": "online"
  }
}
```

3. Access with dot notation: `t("chat.openInOdoo")`

### Translation File Locations

- English: `src/app/locales/en.json`
- Turkish: `src/app/locales/tr.json`

## 🔌 Odoo Backend Integration

### ⚠️ ALWAYS ask the backend developer before implementing features that depend on Odoo API!

The backend developer will happily help you understand:

- Available Odoo models and fields
- Required parameters for API calls
- Data structure returned from Odoo
- Permissions and access control

### Odoo JSON-RPC Client

Located in `src/app/lib/odoo/jsonrpc.ts`, provides:

- `OdooClient`: Main client for JSON-RPC calls
- `searchRead()`: Fetch records
- `create()`, `write()`, `unlink()`: CRUD operations
- Session management with cookies

### Environment Variables

Required in `.env` or `.env.local`:

```bash
ODOO_JSONRPC_HOST=localhost
ODOO_JSONRPC_PORT=8069
ODOO_JSONRPC_PROTOCOL=http
ODOO_JSONRPC_DATABASE=your_database

# Webhook secret for real-time updates (generate with: openssl rand -hex 32)
ODOO_WEBHOOK_SECRET=your_webhook_secret_key_here
```

### API Routes Structure

API routes in `src/app/api/` act as a proxy to Odoo:

1. Validate session from headers: `x-session-id`
2. Create Odoo client
3. Call Odoo methods
4. Return JSON response

Example:

```typescript
const sessionId = request.headers.get("x-session-id");
const odooClient = new OdooClient({ host, port, protocol });
const sessionClient = odooClient.createSession(sessionId);
const records = await sessionClient.searchRead("model.name", domain, options);
```

## 📱 Responsive Design (CRITICAL)

### ⚠️ Usability is the MOST important thing!

This project supports **both desktop and mobile** devices. When adding or refactoring components:

1. **Always test on both desktop and mobile** viewports
2. Use the `useResponsive()` hook to detect screen size:

   ```typescript
   const { isMobile } = useResponsive();

   return (
     <>
       {isMobile && <MobileComponent />}
       {!isMobile && <DesktopComponent />}
     </>
   );
   ```

3. **Mobile-first Tailwind classes**:

   ```typescript
   // Mobile by default, desktop with md: prefix
   <div className="flex-col md:flex-row">
   ```

4. **Common responsive patterns**:
   - Chat list: Full width on mobile, sidebar on desktop
   - Back buttons: Only visible on mobile
   - Touch-friendly targets: Minimum 44px × 44px on mobile

5. **Mobile Navigation Provider**: Use `useMobileNavigation()` for chat list toggling

## 🔄 Real-Time Updates with Webhooks + SSE

The project uses a webhook-driven architecture with Server-Sent Events (SSE) for real-time message and thread updates.

### Architecture Overview

```
Odoo Backend → Webhook → Next.js → EventBroadcaster → SSE Streams → Frontend
```

**How it works**:

1. Odoo sends webhooks when messages/threads are created or updated
2. Next.js webhook endpoint validates signature and broadcasts to active SSE connections
3. Frontend receives updates instantly (0-500ms latency)
4. Heartbeat checks for missed webhooks every 30s
5. User refresh (F5) always fetches latest data via REST API

### Webhook Events

The system supports 3 webhook event types:

1. **`thread.created`** - New conversation started
2. **`thread.updated`** - Thread metadata changed (name, unread count, last message preview)
3. **`message.created`** - New message received or sent

### Webhook Endpoint

**Location**: `/api/webhooks/whatsapp`

**Security**: HMAC-SHA256 signature verification using `ODOO_WEBHOOK_SECRET`

**Health Check**: `GET /api/webhooks/whatsapp` returns active channels and listener count

### SSE Hook Usage

```typescript
import { useSSE } from "@/app/hooks/use-sse";

const { isConnected } = useSSE(
  {
    onThreadsUpdate: (threads) => {
      /* handle update */
    },
    onMessagesUpdate: (messages, threadId) => {
      /* handle update */
    },
    onError: (error) => {
      /* handle error */
    },
    onReconnect: () => {
      /* connection restored */
    },
  },
  {
    threadId: "123", // Optional: specific thread
    enabled: !!sessionId,
  }
);
```

### SSE Endpoint

Located at `/api/events`, provides:

- **Webhook event streaming** - Instant updates when webhooks arrive
- **Heartbeat** - Every 30 seconds with drift detection
- **Drift detection** - Compares `write_date` to detect missed webhooks
- **Auto-sync** - Sends `sync_required` event if drift detected, triggering REST API refresh

### Event Broadcasting System

**Location**: `src/app/lib/events/broadcaster.ts`

In-memory pub/sub system for single-instance deployments. For multi-instance (horizontal scaling), replace with Redis pub/sub.

**Channels**:

- `threads` - Global thread events (thread.created, thread.updated)
- `messages` - Global message events
- `messages:${threadId}` - Thread-specific message events

### Configuring Odoo Webhooks

**Ask your backend developer to configure Odoo to send webhooks to the frontend.**

Required webhook URL (add to Odoo configuration):

```bash
# Local development
http://localhost:3000/api/webhooks/whatsapp

# Production
https://your-domain.com/api/webhooks/whatsapp
```

The backend must send webhooks for:

- `whatsapp.thread` model: `create()` and `write()` triggers
- `whatsapp.message` model: `create()` and `write()` triggers

See "Backend Webhook Integration" section below for payload structure and signature generation.

## 🏗️ Development Workflow

### ⚠️ Work piece by piece when implementing features!

**DO NOT** try to implement everything at once. Follow this workflow:

1. **Plan with TodoWrite tool**:

   ```typescript
   // Break down the task into small steps
   1. Add translation keys
   2. Create the component structure
   3. Add API integration
   4. Test on mobile
   5. Test on desktop
   ```

2. **Implement incrementally**:
   - Start with UI structure
   - Add state management
   - Connect to API
   - Add error handling
   - Test responsiveness

3. **Test each piece before moving on**:
   - Does it work in dark theme?
   - Does it work in light theme?
   - Does it work on desktop?
   - Does it work on mobile?
   - Are all texts translatable?
   - Does it handle loading/error states?

## 🎨 Styling Guidelines

- **Tailwind utility classes** for all styling
- **Theme system**: CSS variables defined in `globals.css`
- **ALWAYS use CSS variables** for colors to support both dark and light themes

## 🌓 Dark/Light Theme System (CRITICAL)

### ⚠️ ALWAYS use theme-aware CSS variables when adding or modifying UI elements

The application supports **both dark and light themes** with user preference persisted in localStorage. The theme is managed through CSS variables that automatically adapt based on the `data-theme` attribute on the root element.

### Theme Provider

Use the `useTheme` hook to access or control the theme:

```typescript
import { useTheme } from "@/app/hooks/use-theme";

function MyComponent() {
  const { theme, setTheme, toggleTheme } = useTheme();

  return (
    <button onClick={toggleTheme}>
      Current theme: {theme}
    </button>
  );
}
```

### CSS Variables Pattern

**CRITICAL**: All colors MUST use CSS variables from `src/app/globals.css`. These variables automatically change when the theme switches.

**Tailwind syntax for CSS variables**:

```typescript
// Background with opacity
className = "bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))]";

// Solid background
className = "bg-[rgb(var(--bg-primary))]";

// Text color
className = "text-[rgb(var(--text-primary))]";

// Border
className = "border-[rgb(var(--border-primary)/var(--border-primary-opacity))]";
```

### Available CSS Variables

Refer to `src/app/globals.css` for the complete list. Common variables include:

**Backgrounds**:

- `--bg-primary` - Main background (black in dark, white in light)
- `--bg-secondary` / `--bg-secondary-opacity` - Secondary surfaces
- `--bg-sidebar` / `--bg-sidebar-opacity` - Sidebar background
- `--bg-chat-outgoing` - Outgoing message bubbles
- `--bg-chat-incoming` / `--bg-chat-incoming-opacity` - Incoming message bubbles
- `--bg-input` / `--bg-input-opacity` - Input fields
- `--bg-button-secondary` / `--bg-button-secondary-opacity` - Secondary buttons

**Text**:

- `--text-primary` - Primary text (white in dark, black in light)
- `--text-secondary` / `--text-secondary-opacity` - Secondary/muted text
- `--text-message-time` / `--text-message-time-opacity` - Timestamps

**Borders**:

- `--border-primary` / `--border-primary-opacity` - Primary borders
- `--border-secondary` / `--border-secondary-opacity` - Secondary borders

**Accents**:

- `--accent-primary` - Primary accent color (emerald green)
- `--accent-active` - Active state
- `--accent-hover` / `--accent-hover-opacity` - Hover state

**Status**:

- `--status-error` - Error messages
- `--status-success` - Success messages
- `--status-info` - Info messages

### Common Patterns

```typescript
// ✅ CORRECT: Using CSS variables
// Button
className =
  "px-3 py-2 bg-[rgb(var(--bg-button-secondary)/var(--bg-button-secondary-opacity))] hover:bg-[rgb(var(--accent-hover)/var(--accent-hover-opacity))] rounded-lg transition-colors";

// Input
className =
  "w-full px-4 py-2 bg-[rgb(var(--bg-input)/var(--bg-input-opacity))] border border-[rgb(var(--border-primary)/var(--border-primary-opacity))] rounded-lg text-[rgb(var(--text-primary))]";

// Card/Panel
className =
  "bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] rounded-lg p-4";

// Primary text
className = "text-[rgb(var(--text-primary))]";

// Secondary/muted text
className = "text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))]";

// ❌ WRONG: Hard-coded colors (will not adapt to theme)
className = "bg-black text-white";
className = "bg-white/10 text-white/50";
className = "border-gray-300";
```

### Testing Themes

When implementing or modifying UI components, ALWAYS test both themes:

1. **Test in dark mode** (default theme)
2. **Test in light mode** (toggle via theme switcher in app)
3. **Verify all colors use CSS variables** (not hard-coded)
4. **Check hover/active states** work in both themes
5. **Verify transitions** between themes are smooth

### Adding New CSS Variables

If you need a new color that doesn't exist:

1. Add it to **both** theme sections in `src/app/globals.css`:
   - `:root[data-theme="dark"]`
   - `:root[data-theme="light"]`

2. Use RGB values without `rgb()` wrapper:

   ```css
   --my-new-color: 255 255 255;
   --my-new-color-opacity: 0.5;
   ```

3. Use in components:

   ```typescript
   className = "bg-[rgb(var(--my-new-color)/var(--my-new-color-opacity))]";
   ```

## 🧩 State Management Patterns

### Context Providers

The app uses multiple context providers for different concerns:

1. **AuthProvider**: User authentication and session
2. **ChatsProvider**: Chat list and thread management
3. **CurrentChatProvider**: Active chat and messages
4. **ContactsProvider**: Contact list
5. **TranslationProvider**: i18n support
6. **ThemeProvider**: Dark/light theme management
7. **ConnectionProvider**: Connection status and errors
8. **MobileNavigationProvider**: Mobile UI state

### Custom Hooks

Always use custom hooks to access context:

```typescript
import { useAuth } from "@/app/hooks/use-auth";
import { useChats } from "@/app/hooks/use-chats";
import { useCurrentChat } from "@/app/hooks/use-current-chat";
import { useTheme } from "@/app/hooks/use-theme";
import { useTranslations } from "@/app/context/translation-provider";
```

## 🐛 Debugging Tips

- **Console logs**: Use prefix tags for filtering

  ```typescript
  console.log("[SSE]", "Message received");
  console.log("[Contact Header Debug]", partnerId);
  ```

- **React DevTools**: Inspect context values and state
- **Network tab**: Check API responses and SSE events
- **Responsive mode**: Test mobile layout (F12 → Toggle device toolbar)

## 🔒 Security Considerations

- Session ID passed via headers: `x-session-id`
- No credentials stored in localStorage
- CORS handled by Next.js API routes
- File uploads validated and proxied through backend

## 📝 Code Style Standards

- **Prefer arrow functions** for components
- **Destructure props** in component signatures
- **TypeScript strict mode**: Avoid `any`, use proper types
- **Import order**: React → Next.js → External libraries → Local imports
- **File naming**: kebab-case for files, PascalCase for components

## 🧪 Common Patterns

### Message Component Pattern

```typescript
export type Message = {
  id?: string;
  contactId: string;
  message: string;
  timestamp: number;
  isSentFromUser: boolean;
  attachment?: Attachment;
  replyTo?: ReplyMetadata;
};
```

### API Route Pattern

```typescript
export async function GET(request: NextRequest) {
  const sessionId = request.headers.get("x-session-id");
  if (!sessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const odooClient = new OdooClient({ host, port, protocol });
  const sessionClient = odooClient.createSession(sessionId);

  try {
    const data = await sessionClient.searchRead(/* ... */);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

## 📌 Prompt Examples for Claude

```
Claude, add a new feature to display message reactions. Make sure:
1. All text is translatable
2. All colors use CSS variables
3. Works in both dark and light themes
4. Works on both mobile and desktop
5. Ask me about the Odoo API structure first
6. Work piece by piece

Claude, refactor the chat header to show user status. Remember to:
- Use the translation system for all text
- Use CSS variables for all colors
- Test in both dark and light themes
- Test responsive design
- Ask about Odoo fields before starting

Claude, fix this TypeScript error in contact-header.tsx

Claude, add Turkish translations for the new button feature

Claude, I added a new button but it doesn't look good in light theme. Can you fix it?
```

## 🚀 Deployment

### Production Build

```bash
yarn build
```

### Docker Deployment

```bash
# Build and start
docker compose up -d --build

# Check logs
docker compose logs -f frontend

# Update running container
docker compose up -d --build --no-deps frontend
```

### Environment Variables in Production

Set in `.env.production`:

- `ODOO_JSONRPC_HOST`
- `ODOO_JSONRPC_PORT`
- `ODOO_JSONRPC_PROTOCOL`
- `ODOO_JSONRPC_DATABASE`

## ✅ Pre-Commit Checklist

Before committing any changes, verify:

- [ ] All user-facing text uses `t()` translation function
- [ ] Added translations to both `en.json` and `tr.json`
- [ ] All colors use CSS variables (no hard-coded colors)
- [ ] Tested in dark theme
- [ ] Tested in light theme
- [ ] Tested on mobile viewport (< 768px)
- [ ] Tested on desktop viewport (>= 768px)
- [ ] No TypeScript errors (`yarn build` succeeds)
- [ ] No ESLint warnings
- [ ] Used `yarn` (not npm/pnpm)
- [ ] Asked backend developer about Odoo API if needed
- [ ] Followed incremental development (piece by piece)

## 🎯 Key Principles (Summary)

1. **Translations**: Always use `t()` for user-facing text
2. **Theme Support**: Always use CSS variables for colors, test both dark and light themes
3. **Backend Communication**: Ask before implementing Odoo-dependent features
4. **Package Manager**: Use `yarn` exclusively
5. **Usability**: Mobile and desktop support is mandatory
6. **Incremental Development**: Work piece by piece, test frequently

---

For questions or clarifications, consult the backend developer or refer to existing components as examples.
