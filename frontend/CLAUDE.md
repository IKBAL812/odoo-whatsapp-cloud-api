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

## 🔄 Real-Time Updates with SSE

The project uses Server-Sent Events for real-time message and thread updates:

### SSE Hook Usage

```typescript
import { useSSE } from "@/app/hooks/use-sse";

const { isConnected } = useSSE(
  {
    onThreadsUpdate: (threads) => { /* handle update */ },
    onMessagesUpdate: (messages, threadId) => { /* handle update */ },
    onError: (error) => { /* handle error */ },
    onReconnect: () => { /* connection restored */ },
  },
  {
    threadId: "123", // Optional: specific thread
    enabled: !!sessionId,
  }
);
```

### SSE Endpoint

Located at `/api/events`, streams:
- Thread updates every 5 seconds
- Message updates every 2 seconds
- Heartbeat every 30 seconds

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
   - Does it work on desktop?
   - Does it work on mobile?
   - Are all texts translatable?
   - Does it handle loading/error states?

## 🎨 Styling Guidelines

- **Tailwind utility classes** for all styling
- **Color scheme**: Dark theme with purple accents
  - Background: `bg-black`, `bg-white/10`
  - Text: `text-white`, `text-white/50`
  - Accent: Purple tones
  - Hover: `hover:bg-white/20`

- **Common patterns**:
  ```typescript
  // Button
  className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"

  // Input
  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg"

  // Card
  className="bg-white/10 rounded-lg p-4"
  ```

## 🧩 State Management Patterns

### Context Providers

The app uses multiple context providers for different concerns:

1. **AuthProvider**: User authentication and session
2. **ChatsProvider**: Chat list and thread management
3. **CurrentChatProvider**: Active chat and messages
4. **ContactsProvider**: Contact list
5. **TranslationProvider**: i18n support
6. **ConnectionProvider**: Connection status and errors
7. **MobileNavigationProvider**: Mobile UI state

### Custom Hooks

Always use custom hooks to access context:
```typescript
import { useAuth } from "@/app/hooks/use-auth";
import { useChats } from "@/app/hooks/use-chats";
import { useCurrentChat } from "@/app/hooks/use-current-chat";
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
2. Works on both mobile and desktop
3. Ask me about the Odoo API structure first
4. Work piece by piece

Claude, refactor the chat header to show user status. Remember to:
- Use the translation system for all text
- Test responsive design
- Ask about Odoo fields before starting

Claude, fix this TypeScript error in contact-header.tsx

Claude, add Turkish translations for the new button feature
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
- [ ] Tested on mobile viewport (< 768px)
- [ ] Tested on desktop viewport (>= 768px)
- [ ] No TypeScript errors (`yarn build` succeeds)
- [ ] No ESLint warnings
- [ ] Used `yarn` (not npm/pnpm)
- [ ] Asked backend developer about Odoo API if needed
- [ ] Followed incremental development (piece by piece)

## 🎯 Key Principles (Summary)

1. **Translations**: Always use `t()` for user-facing text
2. **Backend Communication**: Ask before implementing Odoo-dependent features
3. **Package Manager**: Use `yarn` exclusively
4. **Usability**: Mobile and desktop support is mandatory
5. **Incremental Development**: Work piece by piece, test frequently

---

For questions or clarifications, consult the backend developer or refer to existing components as examples.
